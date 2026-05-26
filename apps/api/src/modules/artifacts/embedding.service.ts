import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { PrismaService } from '../../prisma/prisma.service';

// Queue name exported so the processor and module both reference one constant.
export const ARTIFACT_EMBEDDING_QUEUE = 'artifact-embedding';

export interface ArtifactEmbeddingJob {
  artifactId: string;
}

// PRD §8.3.2 — text-embedding-3-small produces 1536-dim vectors.
const EMBEDDING_MODEL = 'text-embedding-3-small' as const;

// Chunk parameters (PRD §8.3.2 "overlapping windows").
// 1 token ≈ 4 chars; 512 tokens ≈ 2 048 chars; OpenAI max ≈ 8 191 tokens ≈ 32 764 chars.
const CHUNK_CHARS = 2_000;
const OVERLAP_CHARS = 200;
const MAX_CHARS = 32_000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('openai.apiKey', '') });
  }

  // ── Core pipeline (PRD §8.3.2) ───────────────────────────────────────────

  async generateAndStore(artifactId: string): Promise<void> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      select: { id: true, name: true, description: true, historicalContext: true },
    });

    if (!artifact) {
      this.logger.warn(`Embedding skipped — artifact ${artifactId} not found`);
      return;
    }

    // 1. Concatenate text fields (PRD §8.3.2 step 1).
    const fullText = [artifact.name, artifact.description, artifact.historicalContext]
      .filter(Boolean)
      .join('\n\n');

    if (!fullText.trim()) {
      this.logger.warn(`Embedding skipped — artifact ${artifactId} has no embeddable text`);
      return;
    }

    // 2. Chunk with overlapping windows (PRD §8.3.2 step 2).
    const chunks = this.chunkText(fullText);

    // 3. Embed each chunk via OpenAI text-embedding-3-small (PRD §8.3.2 step 3).
    const embeddings = await Promise.all(
      chunks.map((chunk) =>
        this.openai.embeddings
          .create({ model: EMBEDDING_MODEL, input: chunk })
          .then((r) => r.data[0]!.embedding),
      ),
    );

    // Average chunk embeddings to produce one vector(1536) per artifact
    // (schema has a single embedding column — PRD §12.4).
    const vector = this.averageVectors(embeddings);

    // 4. Store via raw SQL — Prisma does not support the pgvector type natively.
    const vectorStr = `[${vector.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE artifacts
      SET embedding = ${vectorStr}::vector
      WHERE id = ${artifactId}::uuid
    `;

    this.logger.log(
      `Embedding stored for artifact ${artifactId} (${chunks.length} chunk(s), model=${EMBEDDING_MODEL})`,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private chunkText(text: string): string[] {
    const trimmed = text.slice(0, MAX_CHARS);
    if (trimmed.length <= CHUNK_CHARS) return [trimmed];

    const chunks: string[] = [];
    let start = 0;

    while (start < trimmed.length) {
      const end = Math.min(start + CHUNK_CHARS, trimmed.length);
      chunks.push(trimmed.slice(start, end));
      if (end >= trimmed.length) break;
      start += CHUNK_CHARS - OVERLAP_CHARS;
    }

    return chunks;
  }

  private averageVectors(vectors: number[][]): number[] {
    if (vectors.length === 1) return vectors[0]!;

    const dim = vectors[0]!.length;
    const sum = new Array<number>(dim).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        sum[i]! += vec[i]!;
      }
    }

    return sum.map((v) => v / vectors.length);
  }
}
