import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { ArtifactsService } from './artifacts.service';
import { EmbeddingService } from './embedding.service';

const mockPrisma = {
  museum: { findUnique: jest.fn() },
  artifact: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  qrCode: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockQrService = { generateForArtifact: jest.fn().mockResolvedValue(undefined) };
const mockEmbeddingService = { embedArtifact: jest.fn().mockResolvedValue(undefined) };

const superAdmin = { sub: 'user-1', role: 'super_admin' as const, museumId: undefined as unknown as string, iat: 0, exp: 0 };
const museumAdmin = { sub: 'user-2', role: 'museum_admin' as const, museumId: 'museum-uuid', iat: 0, exp: 0 };
const otherAdmin = { sub: 'user-3', role: 'museum_admin' as const, museumId: 'other-museum', iat: 0, exp: 0 };

describe('ArtifactsService', () => {
  let service: ArtifactsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QrService, useValue: mockQrService },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: getQueueToken('artifact-embedding'), useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get(ArtifactsService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { museumId: 'museum-uuid', name: 'Vase' };

    it('throws 404 when museum does not exist', async () => {
      mockPrisma.museum.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, museumAdmin, '127.0.0.1')).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when actor belongs to a different museum', async () => {
      mockPrisma.museum.findUnique.mockResolvedValue({ id: 'museum-uuid' });
      await expect(service.create(dto, otherAdmin, '127.0.0.1')).rejects.toThrow(ForbiddenException);
    });

    it('creates artifact and fires QR generation', async () => {
      mockPrisma.museum.findUnique.mockResolvedValue({ id: 'museum-uuid' });
      const artifact = { id: 'art-1', museumId: 'museum-uuid', name: 'Vase' };
      mockPrisma.artifact.create.mockResolvedValue(artifact);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.create(dto, museumAdmin, '127.0.0.1');

      expect(result).toEqual(artifact);
      expect(mockQrService.generateForArtifact).toHaveBeenCalledWith('museum-uuid', 'art-1');
    });

    it('super_admin can create in any museum', async () => {
      mockPrisma.museum.findUnique.mockResolvedValue({ id: 'museum-uuid' });
      const artifact = { id: 'art-2', museumId: 'museum-uuid', name: 'Vase' };
      mockPrisma.artifact.create.mockResolvedValue(artifact);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.create(dto, superAdmin, '127.0.0.1')).resolves.toEqual(artifact);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws 404 for missing artifact', async () => {
      mockPrisma.artifact.findFirst.mockResolvedValue(null);
      await expect(service.findOne('no-such-id')).rejects.toThrow(NotFoundException);
    });

    it('returns artifact with qrCode relation', async () => {
      const artifact = { id: 'art-1', name: 'Vase', qrCode: { id: 'qr-1', isActive: true } };
      mockPrisma.artifact.findFirst.mockResolvedValue(artifact);
      await expect(service.findOne('art-1')).resolves.toEqual(artifact);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 403 when editor belongs to a different museum', async () => {
      mockPrisma.artifact.findFirst.mockResolvedValue({ id: 'art-1', museumId: 'museum-uuid', deletedAt: null });
      await expect(service.update('art-1', { name: 'New' }, otherAdmin, '127.0.0.1')).rejects.toThrow(ForbiddenException);
    });

    it('updates artifact fields', async () => {
      const artifact = { id: 'art-1', museumId: 'museum-uuid', deletedAt: null };
      const updated = { ...artifact, name: 'New Name' };
      mockPrisma.artifact.findFirst.mockResolvedValue(artifact);
      mockPrisma.artifact.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.update('art-1', { name: 'New Name' }, museumAdmin, '127.0.0.1')).resolves.toEqual(updated);
      expect(mockPrisma.artifact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'New Name' } }),
      );
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes artifact and deactivates QR codes', async () => {
      const artifact = { id: 'art-1', museumId: 'museum-uuid', deletedAt: null };
      mockPrisma.artifact.findFirst.mockResolvedValue(artifact);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.remove('art-1', museumAdmin, '127.0.0.1');

      expect(result.message).toContain('soft-deleted');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated list without search', async () => {
      mockPrisma.artifact.count.mockResolvedValue(5);
      mockPrisma.artifact.findMany.mockResolvedValue([{ id: 'art-1' }]);

      const result = await service.findAll('museum-uuid', { page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it('delegates to raw SQL when search is provided', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'art-1', museum_id: 'museum-uuid', name: 'Vase', description: null, period: null, location_hint: null, media_urls: [], created_at: new Date() }])
        .mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await service.findAll('museum-uuid', { search: 'vase' });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    });
  });
});
