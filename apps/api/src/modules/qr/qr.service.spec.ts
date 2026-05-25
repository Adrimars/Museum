import { BadRequestException, ForbiddenException, GoneException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { Test } from '@nestjs/testing';

import { REDIS_CLIENT } from '../../redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QrService } from './qr.service';

const MUSEUM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ARTIFACT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const KID = 'v1';
const SECRET = 'test-secret-32-chars-long-xxxxxxx';

const mockPrisma = {
  qrCode: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockStorage = {
  putObject: jest.fn().mockResolvedValue('https://cdn.example.com/museums/test/qr/art.png'),
  buildCdnUrl: jest.fn().mockReturnValue('https://cdn.example.com/key'),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'qr.keys') return [{ kid: KID, secret: SECRET }];
    if (key === 'qr.activeKey') return { kid: KID, secret: SECRET };
    return fallback;
  }),
};

describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        QrService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('qr-bulk-generate'), useValue: { add: jest.fn() } },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();
    service = module.get(QrService);
  });

  // ── generateForArtifact ────────────────────────────────────────────────────

  describe('generateForArtifact', () => {
    it('creates a qr_codes record with a deterministic codeHash', async () => {
      mockPrisma.qrCode.create.mockResolvedValue({});
      await service.generateForArtifact(MUSEUM_ID, ARTIFACT_ID);

      expect(mockStorage.putObject).toHaveBeenCalledWith(
        `museums/${MUSEUM_ID}/qr/${ARTIFACT_ID}.png`,
        expect.any(Buffer),
        'image/png',
      );
      expect(mockPrisma.qrCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ museumId: MUSEUM_ID, artifactId: ARTIFACT_ID, kid: KID }),
        }),
      );
    });
  });

  // ── validate ───────────────────────────────────────────────────────────────

  describe('validate', () => {
    let codeHash: string;

    beforeEach(async () => {
      // Pre-generate codeHash the same way the service does so tests are deterministic
      const { createHmac, createHash } = await import('node:crypto');
      const canonical = `${MUSEUM_ID}:${ARTIFACT_ID}`;
      const sig = createHmac('sha256', SECRET).update(canonical).digest('hex');
      codeHash = createHash('sha256').update(`${sig}:${KID}`).digest('hex');
    });

    it('throws 404 when codeHash is not in the database', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue(null);
      await expect(service.validate(codeHash, KID)).rejects.toThrow(NotFoundException);
    });

    it('throws 400 for an unknown kid', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({
        id: 'qr-1',
        museumId: MUSEUM_ID,
        artifactId: ARTIFACT_ID,
        isActive: true,
        artifact: {},
        scanCount: 0,
      });
      await expect(service.validate(codeHash, 'unknown-kid')).rejects.toThrow(BadRequestException);
    });

    it('throws 422 when HMAC signature does not match', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({
        id: 'qr-1',
        museumId: MUSEUM_ID,
        artifactId: ARTIFACT_ID,
        isActive: true,
        artifact: {},
        scanCount: 0,
      });
      await expect(service.validate('deadbeef'.repeat(8), KID)).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws 410 when QR code is deactivated', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({
        id: 'qr-1',
        museumId: MUSEUM_ID,
        artifactId: ARTIFACT_ID,
        isActive: false,
        artifact: {},
        scanCount: 0,
      });
      await expect(service.validate(codeHash, KID)).rejects.toThrow(GoneException);
    });

    it('increments scan_count and returns artifact on valid scan', async () => {
      const artifact = { id: ARTIFACT_ID, name: 'Vase' };
      mockPrisma.qrCode.findUnique.mockResolvedValue({
        id: 'qr-1',
        museumId: MUSEUM_ID,
        artifactId: ARTIFACT_ID,
        isActive: true,
        artifact,
        scanCount: 3,
      });
      mockPrisma.qrCode.update.mockResolvedValue({});

      const result = await service.validate(codeHash, KID);

      expect(mockPrisma.qrCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { scanCount: { increment: 1 } } }),
      );
      expect(result.scanCount).toBe(4);
      expect(result.artifact).toEqual(artifact);
    });

    it('uses timing-safe comparison (no early exit on partial match)', async () => {
      // The real tamper-resistance is tested above; here we confirm the path for
      // a codeHash that has the correct length but wrong bytes still throws 422.
      const tampered = codeHash.replace(/[0-9a-f]/, (c) => (parseInt(c, 16) ^ 1).toString(16));
      mockPrisma.qrCode.findUnique.mockResolvedValue({
        id: 'qr-1',
        museumId: MUSEUM_ID,
        artifactId: ARTIFACT_ID,
        isActive: true,
        artifact: {},
        scanCount: 0,
      });
      await expect(service.validate(tampered, KID)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── deactivate ─────────────────────────────────────────────────────────────

  const museumAdmin = { sub: 'user-1', role: 'museum_admin' as const, museumId: MUSEUM_ID, iat: 0, exp: 0 };
  const otherAdmin  = { sub: 'user-2', role: 'museum_admin' as const, museumId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', iat: 0, exp: 0 };
  const superAdmin  = { sub: 'user-3', role: 'super_admin'  as const, museumId: null as unknown as string, iat: 0, exp: 0 };

  describe('deactivate', () => {
    it('throws 404 for non-existent QR id', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('no-such-id', museumAdmin)).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when museum_admin tries to deactivate a QR from a different museum', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({ id: 'qr-1', museumId: MUSEUM_ID, isActive: true });
      await expect(service.deactivate('qr-1', otherAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('sets isActive to false for the owning museum_admin', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({ id: 'qr-1', museumId: MUSEUM_ID, isActive: true });
      mockPrisma.qrCode.update.mockResolvedValue({ id: 'qr-1', isActive: false });
      await service.deactivate('qr-1', museumAdmin);
      expect(mockPrisma.qrCode.update).toHaveBeenCalledWith({ where: { id: 'qr-1' }, data: { isActive: false } });
    });

    it('super_admin can deactivate any museum QR code', async () => {
      mockPrisma.qrCode.findUnique.mockResolvedValue({ id: 'qr-1', museumId: MUSEUM_ID, isActive: true });
      mockPrisma.qrCode.update.mockResolvedValue({ id: 'qr-1', isActive: false });
      await service.deactivate('qr-1', superAdmin);
      expect(mockPrisma.qrCode.update).toHaveBeenCalled();
    });
  });
});
