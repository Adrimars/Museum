import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test } from '@nestjs/testing';

import { StorageService } from '../storage/storage.service';
import { IMAGE_OPTIMIZATION_QUEUE, MediaService } from './media.service';

const mockStorage = {
  createPresignedPost: jest.fn().mockResolvedValue({
    uploadUrl: 'https://s3.example.com/upload',
    fields: {},
    cdnUrl: 'https://cdn.example.com/key',
    expiresIn: 300,
  }),
  deleteObject: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = { add: jest.fn().mockResolvedValue({}) };

const MUSEUM_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_MUSEUM_ID = '22222222-2222-2222-2222-222222222222';
const ART_ID = '33333333-3333-3333-3333-333333333333';

const contentEditor = { sub: 'user-1', role: 'content_editor' as const, museumId: MUSEUM_ID, iat: 0, exp: 0 };
const museumAdmin = { sub: 'user-2', role: 'museum_admin' as const, museumId: MUSEUM_ID, iat: 0, exp: 0 };
const otherAdmin = { sub: 'user-3', role: 'museum_admin' as const, museumId: OTHER_MUSEUM_ID, iat: 0, exp: 0 };
const superAdmin = { sub: 'user-4', role: 'super_admin' as const, museumId: undefined as unknown as string, iat: 0, exp: 0 };

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: StorageService, useValue: mockStorage },
        { provide: getQueueToken(IMAGE_OPTIMIZATION_QUEUE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(MediaService);
  });

  // ── presign ────────────────────────────────────────────────────────────────

  describe('presign', () => {
    const baseDto = {
      fileName: 'photo.jpg',
      fileSize: 1_000_000,
      mimeType: 'image/jpeg' as const,
      context: 'artifact_image' as const,
      museumId: MUSEUM_ID,
      artifactId: ART_ID,
    };

    it('throws 400 for disallowed MIME type', async () => {
      await expect(
        service.presign({ ...baseDto, mimeType: 'application/pdf' as never }, contentEditor),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when file exceeds context size limit', async () => {
      await expect(
        service.presign({ ...baseDto, fileSize: 20 * 1024 * 1024 }, contentEditor),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when audio mime is used with image context', async () => {
      await expect(
        service.presign({ ...baseDto, mimeType: 'audio/mpeg' as never }, contentEditor),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when museumId is missing for artifact_image', async () => {
      const { museumId: _m, ...noMuseum } = baseDto;
      await expect(service.presign(noMuseum as never, contentEditor)).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when artifactId is missing for artifact_image', async () => {
      const { artifactId: _a, ...noArtifact } = baseDto;
      await expect(service.presign(noArtifact as never, contentEditor)).rejects.toThrow(BadRequestException);
    });

    it('throws 403 when content_editor uploads to a different museum', async () => {
      await expect(
        service.presign({ ...baseDto, museumId: OTHER_MUSEUM_ID }, contentEditor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('super_admin can presign for any museum', async () => {
      const result = await service.presign({ ...baseDto, museumId: OTHER_MUSEUM_ID }, superAdmin);
      expect(result.uploadUrl).toBeDefined();
    });

    it('returns presigned post data and enqueues optimization job', async () => {
      const result = await service.presign(baseDto, contentEditor);
      expect(result.uploadUrl).toBe('https://s3.example.com/upload');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ museumId: MUSEUM_ID, artifactId: ART_ID }),
        expect.objectContaining({ delay: 10_000 }),
      );
    });

    it('does not enqueue job for avatar context', async () => {
      await service.presign({ ...baseDto, context: 'avatar', museumId: undefined as never, artifactId: undefined as never }, contentEditor);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('audio_guide with audio mime succeeds', async () => {
      const result = await service.presign({
        fileName: 'guide.mp3',
        fileSize: 1_000_000,
        mimeType: 'audio/mpeg',
        context: 'audio_guide',
        museumId: MUSEUM_ID,
        artifactId: ART_ID,
      }, contentEditor);
      expect(result.uploadUrl).toBeDefined();
      expect(mockQueue.add).not.toHaveBeenCalled(); // audio_guide is not an IMAGE_CONTEXT
    });
  });

  // ── deleteAsset ────────────────────────────────────────────────────────────

  describe('deleteAsset', () => {
    const validKey = `museums/${MUSEUM_ID}/artifacts/${ART_ID}/thumb.webp`;

    it('throws 400 for a key with path traversal', async () => {
      await expect(service.deleteAsset('../etc/passwd', museumAdmin)).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for a key that does not match the museums/ prefix', async () => {
      await expect(service.deleteAsset('users/user-1/avatar/photo.jpg', museumAdmin)).rejects.toThrow(BadRequestException);
    });

    it('throws 403 when museum_admin tries to delete another museum\'s asset', async () => {
      await expect(service.deleteAsset(validKey, otherAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('deletes asset for museum_admin of the same museum', async () => {
      const result = await service.deleteAsset(validKey, museumAdmin);
      expect(mockStorage.deleteObject).toHaveBeenCalledWith(validKey);
      expect(result.message).toBe('Asset deleted.');
    });

    it('super_admin can delete any museum asset', async () => {
      const result = await service.deleteAsset(`museums/${OTHER_MUSEUM_ID}/qr/art.png`, superAdmin);
      expect(mockStorage.deleteObject).toHaveBeenCalled();
      expect(result.message).toBe('Asset deleted.');
    });
  });
});
