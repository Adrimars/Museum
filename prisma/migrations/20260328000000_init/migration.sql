-- Migration: 20260328000000_init
-- Full schema initialization for MuseumQuest v1.0

-- Extensions (also in docker init.sql, safe to run again)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ENUMS
CREATE TYPE "UserRole" AS ENUM ('user', 'content_editor', 'museum_admin', 'super_admin');
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published');
CREATE TYPE "GameState" AS ENUM (
  'IDLE', 'CLUE_ACTIVE', 'QR_SCANNED', 'ANSWER_SUBMITTED',
  'CORRECT', 'INCORRECT', 'FINAL_CODE', 'COMPLETED', 'EXPIRED'
);
CREATE TYPE "RewardType" AS ENUM ('badge', 'certificate', 'discount_code');
CREATE TYPE "RewardTriggerType" AS ENUM ('game_completion', 'quiz_threshold');
CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');
CREATE TYPE "AiFlagStatus" AS ENUM ('unflagged', 'flagged', 'dismissed');

-- TABLE: museums
CREATE TABLE "museums" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        VARCHAR(200) NOT NULL,
  "slug"        VARCHAR(200) NOT NULL,
  "description" TEXT,
  "logo_url"    VARCHAR(500),
  "address"     JSONB       NOT NULL,
  "settings"    JSONB       NOT NULL DEFAULT '{}',
  "is_active"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"  TIMESTAMPTZ,
  CONSTRAINT "museums_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "museums_slug_key" ON "museums"("slug");

-- TABLE: users
CREATE TABLE "users" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "email"         VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255),
  "display_name"  VARCHAR(50)  NOT NULL,
  "avatar_url"    VARCHAR(500),
  "role"          "UserRole"   NOT NULL DEFAULT 'user',
  "museum_id"     UUID,
  "total_points"  INTEGER      NOT NULL DEFAULT 0,
  "preferences"   JSONB        NOT NULL DEFAULT '{}',
  "date_of_birth" DATE         NOT NULL,
  "is_banned"     BOOLEAN      NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "deleted_at"    TIMESTAMPTZ,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_museum_id_idx" ON "users"("museum_id");

-- TABLE: refresh_tokens
CREATE TABLE "refresh_tokens" (
  "jti"         UUID         NOT NULL,
  "user_id"     UUID         NOT NULL,
  "token_hash"  VARCHAR(64)  NOT NULL,
  "device_hint" VARCHAR(255),
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "is_revoked"  BOOLEAN      NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("jti"),
  CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- TABLE: artifacts
CREATE TABLE "artifacts" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"           UUID         NOT NULL,
  "name"                VARCHAR(300) NOT NULL,
  "description"         TEXT,
  "historical_context"  TEXT,
  "period"              VARCHAR(100),
  "media_urls"          JSONB        NOT NULL DEFAULT '[]',
  "audio_guide_url"     VARCHAR(500),
  "audio_transcript"    TEXT,
  "location_hint"       VARCHAR(300),
  "embedding"           vector(1536),
  "metadata"            JSONB        NOT NULL DEFAULT '{}',
  "suggested_questions" JSONB        NOT NULL DEFAULT '[]',
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "deleted_at"          TIMESTAMPTZ,
  CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "artifacts_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "idx_artifacts_museum_id" ON "artifacts"("museum_id");
-- IVFFlat index: created after data load (requires rows for training)
-- CREATE INDEX "idx_artifacts_embedding" ON "artifacts" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
-- GIN index for pg_trgm full-text search
CREATE INDEX "idx_artifacts_search" ON "artifacts" USING GIN (
  (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", '')))
);
CREATE INDEX "idx_artifacts_trgm_name" ON "artifacts" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "idx_artifacts_trgm_description" ON "artifacts" USING GIN ("description" gin_trgm_ops);

-- TABLE: qr_codes
CREATE TABLE "qr_codes" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"   UUID         NOT NULL,
  "artifact_id" UUID         NOT NULL,
  "code_hash"   VARCHAR(128) NOT NULL,
  "kid"         VARCHAR(50)  NOT NULL,
  "image_url"   VARCHAR(500) NOT NULL,
  "scan_count"  INTEGER      NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "qr_codes_artifact_id_key" UNIQUE ("artifact_id"),
  CONSTRAINT "qr_codes_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id"),
  CONSTRAINT "qr_codes_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id")
);
CREATE UNIQUE INDEX "qr_codes_code_hash_key" ON "qr_codes"("code_hash");

-- TABLE: rewards (before game_scenarios due to FK)
CREATE TABLE "rewards" (
  "id"                    UUID               NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"             UUID               NOT NULL,
  "name"                  VARCHAR(200)       NOT NULL,
  "type"                  "RewardType"       NOT NULL,
  "asset_url"             VARCHAR(500),
  "description"           TEXT,
  "trigger_type"          "RewardTriggerType" NOT NULL,
  "trigger_config"        JSONB              NOT NULL DEFAULT '{}',
  "linked_scenario_id"    UUID,
  "discount_validity_days" INTEGER,
  "created_at"            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "deleted_at"            TIMESTAMPTZ,
  CONSTRAINT "rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rewards_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "rewards_museum_id_idx" ON "rewards"("museum_id");

-- TABLE: game_scenarios
CREATE TABLE "game_scenarios" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"   UUID           NOT NULL,
  "title"       VARCHAR(300)   NOT NULL,
  "story_intro" TEXT           NOT NULL,
  "difficulty"  "Difficulty"   NOT NULL,
  "status"      "ContentStatus" NOT NULL DEFAULT 'draft',
  "clues"       JSONB          NOT NULL DEFAULT '[]',
  "final_code"  VARCHAR(50)    NOT NULL,
  "reward_id"   UUID,
  "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "deleted_at"  TIMESTAMPTZ,
  CONSTRAINT "game_scenarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_scenarios_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id"),
  CONSTRAINT "game_scenarios_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id")
);
CREATE INDEX "game_scenarios_museum_id_idx" ON "game_scenarios"("museum_id");

-- Add self-referential FK on rewards after game_scenarios is created
ALTER TABLE "rewards"
  ADD CONSTRAINT "rewards_linked_scenario_id_fkey"
  FOREIGN KEY ("linked_scenario_id") REFERENCES "game_scenarios"("id");

-- TABLE: game_sessions
CREATE TABLE "game_sessions" (
  "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                 UUID,
  "guest_token_jti"         VARCHAR(128),
  "scenario_id"             UUID        NOT NULL,
  "museum_id"               UUID        NOT NULL,
  "state"                   "GameState" NOT NULL DEFAULT 'IDLE',
  "current_clue_index"      INTEGER     NOT NULL DEFAULT 0,
  "score"                   INTEGER     NOT NULL DEFAULT 0,
  "attempts_on_current_clue" INTEGER    NOT NULL DEFAULT 0,
  "completed_at"            TIMESTAMPTZ,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "game_sessions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "game_scenarios"("id"),
  CONSTRAINT "game_sessions_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "idx_game_sessions_user_state" ON "game_sessions"("user_id", "state");

-- TABLE: quiz_questions
CREATE TABLE "quiz_questions" (
  "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"     UUID           NOT NULL,
  "artifact_id"   UUID,
  "question_text" TEXT           NOT NULL,
  "options"       JSONB          NOT NULL,
  "explanation"   TEXT,
  "difficulty"    "Difficulty"   NOT NULL,
  "status"        "ContentStatus" NOT NULL DEFAULT 'draft',
  "created_at"    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "deleted_at"    TIMESTAMPTZ,
  CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_questions_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id"),
  CONSTRAINT "quiz_questions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id")
);
CREATE INDEX "quiz_questions_museum_id_idx" ON "quiz_questions"("museum_id");

-- TABLE: quiz_sessions
CREATE TABLE "quiz_sessions" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             UUID,
  "museum_id"           UUID         NOT NULL,
  "difficulty"          "Difficulty" NOT NULL,
  "total_score"         INTEGER      NOT NULL DEFAULT 0,
  "questions_answered"  INTEGER      NOT NULL DEFAULT 0,
  "correct_count"       INTEGER      NOT NULL DEFAULT 0,
  "completed_at"        TIMESTAMPTZ,
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quiz_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "quiz_sessions_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "quiz_sessions_museum_id_idx" ON "quiz_sessions"("museum_id");

-- TABLE: quiz_answers
CREATE TABLE "quiz_answers" (
  "session_id"      UUID        NOT NULL,
  "question_id"     UUID        NOT NULL,
  "selected_option" INTEGER     NOT NULL,
  "is_correct"      BOOLEAN     NOT NULL,
  "points_earned"   INTEGER     NOT NULL,
  "time_spent_ms"   INTEGER     NOT NULL,
  "answered_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("session_id", "question_id"),
  CONSTRAINT "quiz_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
  CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id")
);
CREATE INDEX "quiz_answers_session_id_idx" ON "quiz_answers"("session_id");

-- TABLE: museum_quiz_scores
CREATE TABLE "museum_quiz_scores" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        UUID,
  "museum_id"      UUID        NOT NULL,
  "best_score"     INTEGER     NOT NULL,
  "quiz_count"     INTEGER     NOT NULL DEFAULT 1,
  "last_played_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "museum_quiz_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "museum_quiz_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "museum_quiz_scores_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE UNIQUE INDEX "museum_quiz_scores_user_museum_key" ON "museum_quiz_scores"("user_id", "museum_id")
  WHERE "user_id" IS NOT NULL;
CREATE INDEX "museum_quiz_scores_museum_id_idx" ON "museum_quiz_scores"("museum_id");

-- TABLE: ai_chat_sessions
CREATE TABLE "ai_chat_sessions" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"              UUID        NOT NULL,
  "museum_id"            UUID        NOT NULL,
  "artifact_context_id"  UUID,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "ai_chat_sessions_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id"),
  CONSTRAINT "ai_chat_sessions_artifact_context_id_fkey" FOREIGN KEY ("artifact_context_id") REFERENCES "artifacts"("id")
);
CREATE INDEX "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");
CREATE INDEX "ai_chat_sessions_museum_id_idx" ON "ai_chat_sessions"("museum_id");

-- TABLE: ai_messages
CREATE TABLE "ai_messages" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "session_id"  UUID           NOT NULL,
  "role"        "AiMessageRole" NOT NULL,
  "content"     TEXT           NOT NULL,
  "tokens_used" INTEGER        NOT NULL DEFAULT 0,
  "flag_status" "AiFlagStatus"  NOT NULL DEFAULT 'unflagged',
  "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE
);
CREATE INDEX "ai_messages_session_id_idx" ON "ai_messages"("session_id");
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages"("created_at");

-- TABLE: user_rewards
CREATE TABLE "user_rewards" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       UUID        NOT NULL,
  "reward_id"     UUID        NOT NULL,
  "discount_code" VARCHAR(8),
  "is_redeemed"   BOOLEAN     NOT NULL DEFAULT false,
  "earned_via"    JSONB       NOT NULL,
  "expires_at"    TIMESTAMPTZ,
  "issued_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_rewards_discount_code_key" UNIQUE ("discount_code"),
  CONSTRAINT "user_rewards_user_reward_key" UNIQUE ("user_id", "reward_id"),
  CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "user_rewards_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id")
);
CREATE INDEX "user_rewards_user_id_idx" ON "user_rewards"("user_id");

-- TABLE: analytics_events (TimescaleDB hypertable)
CREATE TABLE "analytics_events" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "museum_id"    UUID,
  "user_id_hash" VARCHAR(128),
  "event_type"   VARCHAR(100) NOT NULL,
  "payload"      JSONB        NOT NULL DEFAULT '{}',
  "occurred_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id", "occurred_at"),
  CONSTRAINT "analytics_events_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");
CREATE INDEX "analytics_events_museum_occurred_idx" ON "analytics_events"("museum_id", "occurred_at");

-- Convert to TimescaleDB hypertable (partitioned by occurred_at, 7-day chunks)
SELECT create_hypertable('analytics_events', 'occurred_at', chunk_time_interval => INTERVAL '7 days');

-- Add TimescaleDB data retention policy (12 months)
SELECT add_retention_policy('analytics_events', INTERVAL '12 months');

-- TABLE: audit_logs
CREATE TABLE "audit_logs" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "actor_id"    UUID         NOT NULL,
  "actor_role"  VARCHAR(50)  NOT NULL,
  "action"      VARCHAR(100) NOT NULL,
  "target_type" VARCHAR(50)  NOT NULL,
  "target_id"   UUID         NOT NULL,
  "metadata"    JSONB        NOT NULL DEFAULT '{}',
  "museum_id"   UUID,
  "ip_address"  VARCHAR(45)  NOT NULL,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id"),
  CONSTRAINT "audit_logs_museum_id_fkey" FOREIGN KEY ("museum_id") REFERENCES "museums"("id")
);
CREATE INDEX "idx_audit_logs_museum_created" ON "audit_logs"("museum_id", "created_at");
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_id");
