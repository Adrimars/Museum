import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import {
  ARTIFACT_EMBEDDING_QUEUE,
  type ArtifactEmbeddingJob,
  EmbeddingService,
} from '../embedding.service';

@Processor(ARTIFACT_EMBEDDING_QUEUE)
export class ArtifactEmbeddingProcessor {
  private readonly logger = new Logger(ArtifactEmbeddingProcessor.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  // Bull calls this for every job added to ARTIFACT_EMBEDDING_QUEUE.
  @Process()
  async handle(job: Job<ArtifactEmbeddingJob>): Promise<void> {
    this.logger.log(`Processing embedding job for artifact ${job.data.artifactId}`);
    await this.embeddingService.generateAndStore(job.data.artifactId);
  }
}
