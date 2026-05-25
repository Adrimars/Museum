-- S4-01 / S4-04: Add pgvector embedding column and IVFFlat index to artifacts
-- PRD §8.3.2 (embedding pipeline), §12.4 (schema), §12.4 (idx_artifacts_embedding)

-- Ensure pgvector extension is loaded (may already exist from init migration).
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the 1536-dim embedding column (nullable until the async job fills it).
ALTER TABLE "artifacts" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- IVFFlat index for cosine similarity search used by the RAG pipeline (PRD §8.7.2).
-- lists = 100 is a standard default; tune with VACUUM ANALYZE after data is loaded.
CREATE INDEX IF NOT EXISTS "idx_artifacts_embedding"
  ON "artifacts"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
