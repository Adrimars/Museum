# MuseumQuest — Development Plan

**Version:** 1.0
**Last Updated:** 2026-03-28
**Source:** PRD v1.0 (Sections 5, 8–15)

---

## Sprint Overview

| Sprint | Weeks | Phase | Focus |
|---|---|---|---|
| 1 | 1–2 | Foundation | Monorepo, schema, auth, museums, RBAC |
| 2 | 3–4 | Foundation | Tenant middleware, admin scaffold, user management |
| 3 | 5–6 | Core Content | Artifacts, QR system, media pipeline |
| 4 | 7–8 | Core Content | Embedding pipeline, artifact search, QR admin |
| 5 | 9–10 | Gamification | Treasure Hunt state machine, game sessions |
| 6 | 11–12 | Gamification | Quiz module, leaderboard, rewards & badges |
| 7 | 13–14 | AI & Analytics | AI RAG pipeline, analytics ingestion, dashboards |
| 8 | 15–16 | Polish & Launch | i18n, accessibility, security audit, load testing, deploy |

**Total:** 8 sprints × 2 weeks = 16 weeks (guideline, not hard deadline)

---

## Phase 1: Foundation (Sprints 1–2)

### Sprint 1 — Project Bootstrap & Auth

| ID | Task | Module | Priority |
|---|---|---|---|
| S1-01 | Initialize Turborepo monorepo structure (`apps/web`, `apps/admin`, `apps/api`, `packages/*`) | Infra | P0 |
| S1-02 | Configure Docker Compose: PostgreSQL 16 (pgvector, pg_trgm, TimescaleDB) + Redis 7 | Infra | P0 |
| S1-03 | Set up Prisma schema with all 17 tables (initial migration) | Database | P0 |
| S1-04 | Seed script: default museum settings JSONB, super_admin account | Database | P0 |
| S1-05 | Implement AuthModule: registration, login, JWT RS256, refresh token rotation | AuthModule | P0 |
| S1-06 | Implement password hashing (bcrypt cost 12) and account lockout (5 attempts / 15 min) | AuthModule | P0 |
| S1-07 | Implement token refresh endpoint with rotation and Redis blocklist | AuthModule | P0 |
| S1-08 | Implement logout (revoke refresh token, clear cookie) | AuthModule | P0 |
| S1-09 | Implement Google OAuth2 flow (no auto-merge with existing email accounts) | AuthModule | P1 |
| S1-10 | Set up ESLint, TypeScript strict mode, shared configs in `packages/config` | Infra | P0 |
| S1-11 | Set up GitHub Actions: type-check + unit test CI gates (direct pushes to main allowed) | Infra | P0 |

### Sprint 2 — Museums, RBAC, Tenant Isolation

| ID | Task | Module | Priority |
|---|---|---|---|
| S2-01 | Implement MuseumsModule: CRUD endpoints, settings JSONB seeding | MuseumsModule | P0 |
| S2-02 | Build `MuseumTenantMiddleware` (global): resolve `museumId` from JWT or URL param | MuseumsModule | P0 |
| S2-03 | Implement `RolesGuard` with full RBAC permission matrix | AuthModule | P0 |
| S2-04 | Museum enable/disable endpoints (super_admin only) | MuseumsModule | P0 |
| S2-05 | Implement UsersModule: profile CRUD, role assignment, user ban | UsersModule | P0 |
| S2-06 | Scaffold `apps/admin` React app with routing, auth flow, shared `packages/ui` | AdminModule | P1 |
| S2-07 | Implement unified error envelope: `{ statusCode, message, errorCode, requestId, timestamp, path }` | Backend | P0 |
| S2-08 | Set up Winston/Pino structured JSON logging | Backend | P1 |
| S2-09 | Implement rate limiting middleware (Redis sliding window) | Backend | P0 |
| S2-10 | Password reset flow: forgot-password + reset-password + SendGrid email | AuthModule | P1 |

---

## Phase 2: Core Content (Sprints 3–4)

### Sprint 3 — Artifacts & QR System

| ID | Task | Module | Priority |
|---|---|---|---|
| S3-01 | Implement ArtifactsModule: CRUD endpoints with museum scoping | ArtifactsModule | P0 |
| S3-02 | Artifact text search: configure pg_trgm GIN indexes on `name`, `description` | ArtifactsModule | P0 |
| S3-03 | Implement QRModule: auto-generate QR on artifact creation (HMAC-SHA256 + kid) | QRModule | P0 |
| S3-04 | QR scan validation endpoint: signature verify, code_hash lookup, scan_count increment | QRModule | P0 |
| S3-05 | Implement MediaModule: pre-signed S3 upload URL generation | MediaModule | P0 |
| S3-06 | Image optimization Bull queue: convert to WebP, 3 variants (400px, 1200px, full) | MediaModule | P1 |
| S3-07 | CDN configuration: Cloudflare with immutable cache headers | Infra | P1 |
| S3-08 | Implement `POST /api/v1/media/presign` with file size/type validation | MediaModule | P0 |
| S3-09 | Admin UI: artifact list, create, edit forms with image upload | AdminModule | P1 |

### Sprint 4 — Embeddings & QR Admin

| ID | Task | Module | Priority |
|---|---|---|---|
| S4-01 | Implement artifact embedding pipeline: concatenate → chunk → OpenAI embed → pgvector store | ArtifactsModule | P0 |
| S4-02 | Bull queue for async embedding generation (never blocks API response) | ArtifactsModule | P0 |
| S4-03 | Re-embedding trigger on artifact text field updates | ArtifactsModule | P1 |
| S4-04 | Configure pgvector IVFFlat index on `artifacts.embedding` | Database | P0 |
| S4-05 | QR key versioning: support 2 most recent HMAC secrets via `kid` | QRModule | P1 |
| S4-06 | QR admin endpoints: view, deactivate, bulk-generate (async Bull job → ZIP) | QRModule | P1 |
| S4-07 | Admin UI: QR code management, download, deactivation | AdminModule | P1 |
| S4-08 | Admin UI: artifact detail view with QR preview and media gallery | AdminModule | P1 |

---

## Phase 3: Gamification (Sprints 5–6)

### Sprint 5 — Treasure Hunt Engine

| ID | Task | Module | Priority |
|---|---|---|---|
| S5-01 | Implement GameModule: game session creation, state machine (IDLE → COMPLETED) | GameModule | P0 |
| S5-02 | Guest token endpoint: session-scoped JWT with no DB user record | GameModule | P0 |
| S5-03 | QR scan validation within game context: match expected clue artifact | GameModule | P0 |
| S5-04 | Answer submission: scoring formula (base + time bonus), attempt tracking | GameModule | P0 |
| S5-05 | Hint reveal logic on Nth failed attempt (configurable ⚙️) | GameModule | P0 |
| S5-06 | Force-skip on max attempts exceeded (0 points, advance to next clue) | GameModule | P0 |
| S5-07 | Final code verification and session completion | GameModule | P0 |
| S5-08 | Redis hot-path caching: session state, question hidden until QR scanned (anti-cheat) | GameModule | P0 |
| S5-09 | Session timeout: 4-hour ⚙️ expiry, state → EXPIRED | GameModule | P1 |
| S5-10 | Game scenario CRUD for admins (draft/published lifecycle) | GameModule | P1 |
| S5-11 | Visitor-facing UI: game lobby, clue view, QR scan trigger, answer form, progress | Frontend | P1 |

### Sprint 6 — Quiz, Leaderboard, Rewards

| ID | Task | Module | Priority |
|---|---|---|---|
| S6-01 | Implement QuizModule: session creation, random question selection by difficulty | QuizModule | P0 |
| S6-02 | Quiz answer endpoint: scoring, server-side timer enforcement | QuizModule | P0 |
| S6-03 | Quiz completion: upsert museum_quiz_scores (personal best logic) | QuizModule | P0 |
| S6-04 | Leaderboard: Redis sorted set per museum, all_time reads | QuizModule | P0 |
| S6-05 | Leaderboard: weekly/monthly via TimescaleDB continuous aggregates | QuizModule | P1 |
| S6-06 | Quiz question bank CRUD (draft/published lifecycle) | QuizModule | P1 |
| S6-07 | Implement RewardsModule: reward definitions, issuance triggers | RewardsModule | P0 |
| S6-08 | Discount code generation: 8-char uppercase alphanumeric, unique, single-use | RewardsModule | P0 |
| S6-09 | Discount code verification endpoint (ticket desk use) | RewardsModule | P1 |
| S6-10 | Guest-to-account linking: merge guest game session to new user | AuthModule | P1 |
| S6-11 | Visitor-facing UI: quiz flow, timer, leaderboard, rewards gallery | Frontend | P1 |

---

## Phase 4: AI & Analytics (Sprint 7)

### Sprint 7 — AI RAG Pipeline & Analytics

| ID | Task | Module | Priority |
|---|---|---|---|
| S7-01 | Implement AIModule: chat session creation, message persistence | AIModule | P0 |
| S7-02 | RAG pipeline: embed query → pgvector similarity (top-3) → prompt construction | AIModule | P0 |
| S7-03 | Claude streaming integration via WebSocket (`/ws/ai` namespace) | AIModule | P0 |
| S7-04 | AI rate limiting: per-user, per-minute (Redis sliding window, configurable ⚙️) | AIModule | P0 |
| S7-05 | Max conversation turns enforcement (configurable ⚙️) | AIModule | P0 |
| S7-06 | Content safety: keyword blocklist + LLM pre-check. Violation → session terminate. | AIModule | P0 |
| S7-07 | Suggested question generation: lazy, on-demand, Redis-cached 24h | AIModule | P1 |
| S7-08 | AI disabled per museum: `ai_config.isEnabled` → 403, hide all AI UI | AIModule | P1 |
| S7-09 | AI message flagging (MVP-STUB): flag_status ENUM, flag/dismiss UI surface | AIModule | P1 |
| S7-10 | Implement AnalyticsModule: Bull queue event ingestion → TimescaleDB | AnalyticsModule | P0 |
| S7-11 | Analytics pseudonymization: salted HMAC on user_id before storage | AnalyticsModule | P0 |
| S7-12 | Continuous aggregates: daily/weekly rollups, hourly refresh | AnalyticsModule | P1 |
| S7-13 | Artifact heatmap: weighted composite score (40% scans, 30% AI, 20% views, 10% dwell) | AnalyticsModule | P1 |
| S7-14 | Conversion funnels: 5 tracked funnels | AnalyticsModule | P1 |
| S7-15 | User segmentation: nightly Bull cron job (Explorer, Scholar, Passive, Newcomer) | AnalyticsModule | P2 |
| S7-16 | Visitor-facing UI: AI chat interface, streaming display, suggested question chips | Frontend | P1 |

---

## Phase 5: Polish & Launch (Sprint 8)

### Sprint 8 — Admin Dashboards, i18n, Security, Deploy

| ID | Task | Module | Priority |
|---|---|---|---|
| S8-01 | Museum admin dashboard: KPI cards, trend charts, heatmap, funnels, segments | AdminModule | P0 |
| S8-02 | System admin panel: museum list, user management, AI log moderation, system analytics | AdminModule | P0 |
| S8-03 | Data export: async Bull job → CSV/PDF → pre-signed S3 URL (no PII) | AnalyticsModule | P1 |
| S8-04 | Admin data tables: TanStack Table v8 with server-side pagination, sort, filter | AdminModule | P1 |
| S8-05 | i18n: externalize all strings via react-i18next (Turkish + English) | Frontend | P0 |
| S8-06 | Accessibility audit: WCAG 2.1 AA, keyboard nav, ARIA labels, contrast ratios | Frontend | P0 |
| S8-07 | Accessibility preferences: `reducedMotion`, `highContrast` flags respected | Frontend | P1 |
| S8-08 | Account deletion: soft-delete → 30-day grace → hard-delete PII purge job | UsersModule | P0 |
| S8-09 | Account restoration: cancel deletion within grace period | UsersModule | P1 |
| S8-10 | Data portability: `GET /api/v1/users/me/export` (profile, scores, sessions, rewards) | UsersModule | P1 |
| S8-11 | OWASP Top 10 security audit across all modules | Security | P0 |
| S8-12 | Audit log: verify all critical admin actions are logged to `audit_logs` | Security | P0 |
| S8-13 | k6 load testing: 500 concurrent users on QR validate + quiz answer | QA | P0 |
| S8-14 | Verify performance SLAs: QR < 200ms p95, quiz < 300ms p95, AI TTFT < 1.5s | QA | P0 |
| S8-15 | Terraform: ECS Fargate, RDS, ElastiCache, S3, ALB, CodeDeploy | Infra | P0 |
| S8-16 | Blue/Green deployment pipeline (GitHub Actions → CodeDeploy → ECS) | Infra | P0 |
| S8-17 | Sentry integration (frontend + backend) | Infra | P1 |
| S8-18 | Grafana dashboards: latency, errors, DB pool, Redis, ECS, AI costs | Infra | P1 |
| S8-19 | Health endpoints: `/health/live`, `/health/ready` | HealthModule | P0 |
| S8-20 | Consent flows: cookie banner, registration checkbox | Frontend | P0 |
| S8-21 | Service Worker static-asset caching: app shell + core images precached via Vite PWA Plugin (stale-while-revalidate strategy) | Frontend | P1 |

---

## Milestones

| Milestone | Sprint | Acceptance Criteria |
|---|---|---|
| **M1: Auth & Multi-Tenancy** | 2 | User can register, login, refresh tokens. Museum CRUD works. Tenant middleware blocks cross-museum access. RBAC enforced. |
| **M2: Content Pipeline** | 4 | Artifacts created with QR auto-generation. Embedding pipeline runs async. Images optimized to WebP. Fuzzy search works. |
| **M3: Playable Game** | 5 | Visitor (or guest) can start Treasure Hunt, scan QR codes, answer questions, complete game, receive reward. State machine fully functional. |
| **M4: Quiz & Leaderboard** | 6 | Authenticated user can take quiz, see score, appear on per-museum leaderboard. Rewards issued on completion. |
| **M5: AI Chat Live** | 7 | User can chat with AI about artifacts. Streaming works. Rate limits enforced. Content safety blocks violations. |
| **M6: Analytics Available** | 7 | Admin dashboard shows KPIs, heatmaps, funnels. Events ingested via Bull → TimescaleDB. |
| **M7: Production Ready** | 8 | Security audit passed. Load test at 500 concurrent. Performance SLAs met. Blue/Green deploy operational. i18n complete. |

---

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| OpenAI Embedding API | Rate limits, latency spikes, cost | Async via Bull queue. Retry 2x. Monitor token usage. |
| Anthropic Claude API | Outages block AI chat | Retry 2x with backoff. Surface error to user. No auto-fallback in v1.0. |
| SendGrid | Email delivery for password reset | Only use case in v1.0. Low volume. Monitor delivery rates. |
| AWS Services (RDS, ElastiCache, ECS) | Service outages | Multi-AZ for RDS + Redis. ECS auto-scaling. CloudWatch alerting. |
| pgvector / TimescaleDB extensions | RDS compatibility | Verify extensions available on RDS before sprint 1. |
| QR key rotation | Printed QR codes in museums become invalid | Keep 2 most recent HMAC keys. Coordinate rotation with museums. |

---

## MVP-STUB Tracker

Items marked `[MVP-STUB]` in the PRD — data model + API + admin UI required, business logic finalized pre-launch:

| Stub | Location | What's Built | What's Deferred |
|---|---|---|---|
| AI Message Flagging | §8.9.4 | `flag_status` ENUM on `ai_messages`, flag/dismiss UI + API | Downstream logic (auto-suspend user, notify super_admin) |
| Age Gate Validation | §14.2 | `date_of_birth` field collected at registration | Actual blocking logic (COPPA/GDPR parental consent) |

---

## Definition of Done

A feature is "done" when:

1. Code passes all CI gates (lint, type-check, unit tests)
2. Code reviewed and approved by at least one team member
3. NestJS Swagger decorators present on all new endpoints
4. DTOs validated with `class-validator`
5. Multi-tenant isolation verified (integration test or manual)
6. No hard-coded configurable values (⚙️ items read from `museums.settings.limits`)
7. Structured logging on all error paths
8. Constitution principles verified (no violations)
9. Feature tested against relevant edge cases from PRD

---

*End of plan.md*
