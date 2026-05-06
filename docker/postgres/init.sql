-- Enable required PostgreSQL extensions
-- TimescaleDB is already loaded via timescaledb-ha image

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- pg_trgm similarity threshold for fuzzy search
SET pg_trgm.similarity_threshold = 0.3;
