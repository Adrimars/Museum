

# MuseumQuest Constitution

## Core Principles

### I. Multi-Tenant Isolation (NON-NEGOTIABLE)

Every API request that accesses or mutates data MUST be scoped to a specific `museum_id`. The
global `MuseumTenantMiddleware` MUST be applied on all routes that touch tenant data. All
repository methods MUST include an explicit `WHERE museum_id = :museumId` predicate — there are
no exceptions.

- Cross-museum data queries are forbidden for all roles except `super_admin` system-analytics
  endpoints.
- The `museum_id` for admin roles MUST be resolved from the JWT `museumId` claim, never from
  user-supplied request body parameters.
- A `museum_admin` MUST NOT be able to read, write, or infer data belonging to another museum
  through any code path.
- Row-Level Security (RLS) in PostgreSQL is deferred to Phase 2 as an additional hardening layer
  but MUST NOT be used as a reason to weaken application-level isolation in v1.0.

**Rationale:** MuseumQuest is a multi-tenant SaaS; a data leak between museums would be a
catastrophic trust and compliance failure.

### II. Privacy & Regulatory Compliance by Design (KVKK / GDPR)

All features that touch personally identifiable information (PII) MUST be designed with KVKK and
GDPR compliance as a first-class constraint, not an afterthought.

- **Data minimization:** Guest sessions MUST NOT collect or store any PII — no IP logging, no
  device fingerprinting.
- **Analytics pseudonymization:** `analytics_events.user_id_hash` MUST be a salted HMAC hash;
  it MUST NOT be a direct FK to `users.id`.
- **Right to erasure:** The 30-day soft-delete → hard-delete pipeline MUST purge all PII columns
  and unlink (set `user_id = NULL`) on game/quiz records rather than deleting them, to preserve
  aggregate analytics.
- **Admin exports** MUST NEVER contain direct PII. Users are referenced only by labels such as
  "Visitor #4821".
- **Data residency:** The AWS `eu-central-1` (Frankfurt) region MUST be used exclusively as the
  deployment target to satisfy KVKK/GDPR geographic requirements.
- Consent flows (cookie banner, registration checkbox) MUST be present and functional before any
  data collection begins.

**Rationale:** MuseumQuest operates under Turkish KVKK law and EU GDPR. Non-compliance carries
significant legal and financial risk.

### III. Configurable Defaults — Never Hard-Coded Constants

All game, quiz, and AI behavioral parameters MUST be stored in `museums.settings.limits` (JSONB)
and seeded at museum creation time. Engineers MUST NOT hard-code any value that the PRD marks
with ⚙️.

- Configurable examples include: `maxAnswerAttemptsPerClue`, `quizTimerSeconds`,
  `pointsPerCorrectByDifficulty`, `maxAiTurnsPerSession`, `aiRateLimitPerMinute`.
- All seeded default values MUST come from a single authoritative seed configuration; duplication
  across code and DB is prohibited.
- Game logic services MUST read these values from the database (or Redis cache) at runtime, not
  from environment variables or compiled constants.
- Any Pull Request that introduces a hard-coded game or scoring constant MUST be rejected.

**Rationale:** Museum administrators must be able to tune the product experience without a code
deploy. Hard-coding defeats the SaaS model.

### IV. Async-First for Non-Critical-Path Operations

Long-running or resource-intensive operations MUST be executed asynchronously via Bull (Redis-backed)
queues. API endpoints MUST return immediately (202 Accepted or the primary resource response)
and MUST NOT block waiting for these jobs.

- Covered operations include: artifact embedding generation, image optimization pipeline,
  QR bulk generation, analytics event ingestion, CSV/PDF export, and user segment calculation.
- Analytics tracking is fire-and-forget — failures in the analytics queue MUST NOT propagate
  errors to the user-facing API response.
- All Bull jobs MUST implement retry logic with exponential backoff. The AI module uses max
  2 retries before surfacing an error event.
- Job completion notifications (e.g., export ready) use pre-signed S3 URLs returned via a
  polling status endpoint.

**Rationale:** QR scan validation has a p95 target of <200ms. Synchronous embedding or image
processing would violate performance SLAs.

### V. Draft-First Content Lifecycle

All visitor-facing content (game scenarios, quiz questions) MUST be created in `draft` status
by default. Content MUST NOT become visible to visitors until explicitly published.

- Only `museum_admin` or `super_admin` MUST be able to transition content from `draft` →
  `published` or `published` → `draft`.
- `content_editor` MUST be able to create and edit `draft` content but MUST NOT publish it.
- Admins MUST be able to preview and test `draft` scenarios and questions within the admin panel
  before publishing.
- Any API endpoint serving visitor-facing content MUST filter by `status = 'published'`.

**Rationale:** Prevents accidental exposure of incomplete or incorrect museum content to
visitors, protecting the museum's reputation.

### VI. Performance SLAs Are Non-Negotiable

The following latency targets MUST be met before a feature is marked complete. Engineers MUST
verify against these targets using k6 or equivalent load-testing tooling:

| Endpoint / Metric | Target |
|---|---|
| `POST /api/v1/qr/validate` p95 | < 200ms |
| `POST /api/v1/quiz/sessions/:id/answer` p95 | < 300ms |
| AI Time-to-First-Token (TTFT) | < 1.5 seconds |
| Time to Interactive (mid-tier Android, 4G) | < 3.0 seconds |
| Lighthouse Mobile Score | ≥ 90 |

- Redis MUST be used for hot-path session reads (game state, leaderboard).
- Database indexes MUST be verified in the plan phase before any feature touching a
  performance-critical query is implemented.
- Any feature that degrades measured p95 beyond the targets MUST be blocked until resolved.

**Rationale:** Visitor experience in a physical museum context is time-sensitive. Slow responses
break immersion and reduce engagement.

## Security & Compliance Requirements

All code MUST pass an OWASP Top 10 review. The following controls are mandatory and MUST be
present in every feature that touches the relevant boundary:

- **Input validation (MUST):** All incoming DTOs MUST use `class-validator` decorators.
  No unvalidated data reaches service logic.
- **XSS prevention (MUST):** User-supplied text fields MUST be sanitized server-side
  (equivalent of `sanitize-html`) before persistence or rendering.
- **SQL injection prevention (MUST):** Raw SQL is prohibited. Prisma parameterized queries
  MUST be used exclusively.
- **JWT security (MUST):** Access tokens use RS256 (asymmetric), expire in 15 minutes.
  Refresh tokens are stored as SHA-256 hashes. Token rotation MUST be enforced on every
  refresh. The `jti` of revoked tokens MUST be added to the Redis blocklist immediately.
- **WebSocket token hygiene (MUST):** JWT tokens MUST NEVER be passed in WebSocket URL
  query parameters. They MUST be passed in the Socket.io `auth` handshake object.
- **Secrets management (MUST):** All API keys, HMAC secrets, and credentials MUST reside in
  AWS Secrets Manager. `.env` files are prohibited in production. No secrets in Git.
- **CORS (MUST):** Wildcards (`*`) are prohibited in production CORS configuration. Only the
  exact production domain is allowed.
- **Rate limiting (MUST):** Redis sliding-window rate limits MUST be applied: 100 req/min
  (public), 1,000 req/min (authenticated), 3 req/min (AI chat, configurable).
- **Audit logging (MUST):** All actions listed in Section 14.5 of the PRD MUST be recorded in
  `audit_logs`. The audit log table is append-only — no delete or update operations are allowed.
- **Password hashing (MUST):** bcrypt with cost factor 12 MUST be used. No MD5, SHA-1, or
  unsalted hashes.
- **QR HMAC (MUST):** HMAC-SHA256 with AWS Secrets Manager-managed keys. Key rotation MUST
  preserve the 2 most recent `kid` values to keep existing printed QR codes valid.

## Development Workflow & Quality Gates

- **Monorepo:** The project MUST use the established Turborepo structure:
  `apps/web`, `apps/admin`, `apps/api`, `packages/ui`, `packages/api-client`, `packages/config`,
  `prisma/`. New top-level directories require team consensus.
- **API versioning (MUST):** All endpoints MUST be under `/api/v1/`. Introducing `/api/v2/`
  requires a formal deprecation plan.
- **Error envelope (MUST):** Every error response MUST use the unified envelope:
  `{ statusCode, message, errorCode, requestId, timestamp, path }`. Bespoke error shapes
  are prohibited.
- **CI gates:** TypeScript type-check and unit tests run on every push and PR via GitHub
  Actions. Both MUST pass. Lint is not a required gate. Direct pushes to `main` are allowed.
- **Deployment (MUST):** Blue/Green deployment via AWS CodeDeploy + ECS. Zero-downtime deploys
  are required.
- **Observability (MUST):** Structured JSON logging via Winston/Pino MUST be present in every
  new service. Sentry error tracking MUST be initialized in both `apps/web` and the NestJS
  backend. No silent `catch` blocks that swallow errors without logging.
- **OpenAPI documentation (MUST):** All new NestJS endpoints MUST have NestJS Swagger
  decorators so the auto-generated spec at `/api/docs` stays current.
- **MVP-STUB discipline:** Any `[MVP-STUB]` item MUST have the data model, API endpoint, and
  admin UI surface built. Business logic placeholders MUST be clearly marked with a code
  comment referencing the stub designation.
- **Out-of-scope enforcement:** Features listed in PRD Section 16 (e.g., offline mode, billing,
  NFT, AR) MUST NOT be scaffolded. Accidental stubs waste sprint capacity and complicate
  Phase 2 planning.

## Governance

This constitution supersedes all other development practices, wikis, and ad-hoc conventions
for MuseumQuest. In cases of conflict, this document wins.

**Amendment procedure:**
1. Propose the amendment with clear rationale in a PR that modifies this file.
2. The proposing engineer must also update affected plan, spec, and tasks templates in the same PR.
3. At least one senior engineer or product lead must approve before merging.
4. The `CONSTITUTION_VERSION` MUST be incremented per the semantic versioning policy below.

**Versioning policy:**
- **MAJOR**: Backward-incompatible governance change — removal or redefinition of an
  existing principle that would invalidate already-approved plans.
- **MINOR**: New principle or section added; material expansion of existing guidance.
- **PATCH**: Clarifications, wording fixes, typo corrections, non-semantic refinements.

**Compliance review:** All plan.md documents generated by speckit.plan MUST include a
"Constitution Check" section that explicitly enumerates which principles apply and confirms
compliance for the feature in question.

**Version**: 1.0.0 | **Ratified**: 2026-03-28 | **Last Amended**: 2026-03-28
