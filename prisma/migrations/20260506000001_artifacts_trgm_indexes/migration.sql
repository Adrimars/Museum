-- S3-02: GIN indexes for pg_trgm text search on artifacts
-- PRD §12.4 / §12.18 — idx_artifacts_search (GIN, pg_trgm)
-- Enables the % similarity operator used in ArtifactsService.findAllWithSearch()
-- Note: CONCURRENTLY removed — Prisma migrations run inside transactions.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_artifacts_name_trgm
  ON artifacts USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_artifacts_description_trgm
  ON artifacts USING GIN (description gin_trgm_ops);
