# MuseumQuest — System Architecture

**Version:** 1.0
**Last Updated:** 2026-03-28
**Source:** PRD v1.0 (Sections 10, 11, 15)

---

## Architecture Pattern

**Modular Monolith** for Phase 1. Each NestJS module owns its controllers, services, repositories, DTOs, and tests. Modules communicate via direct NestJS DI service injection — NO inter-module HTTP calls.

Clear internal boundaries enable individual modules to be extracted into independent microservices in Phase 2 without a full rewrite.

---

## Module Inventory

| Module | Responsibility | Phase 2 Extraction |
|---|---|---|
| AuthModule | Registration, login, JWT issuance/refresh, OAuth2, password reset, guest tokens | No |
| UsersModule | Profile management, avatar, preferences, account deletion, role assignment | No |
| MuseumsModule | Museum CRUD, settings, multi-tenant isolation middleware | No |
| ArtifactsModule | Artifact metadata, media, embeddings, QR code linking | No |
| QRModule | QR code generation, signed URL validation, scan event logging | Yes |
| GameModule | Treasure Hunt state machine, clue progression, answer evaluation, scoring | Yes |
| QuizModule | Question bank, quiz sessions, scoring, leaderboard computation | No |
| AIModule | LLM prompt construction, RAG retrieval, streaming responses, chat history | Yes |
| RewardsModule | Digital reward issuance, discount code generation/verification | No |
| AnalyticsModule | Event ingestion, aggregation, dashboard metrics API, export jobs | Yes |
| AdminModule | Dashboard facade, system admin endpoints, content moderation | No |
| MediaModule | S3 pre-signed URL generation, image optimization pipeline | No |
| HealthModule | Liveness/readiness probes | No |

---

## Technology Stack

### Frontend

| Layer | Technology | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | Component model, PWA-ready |
| Mobile Wrapper | Capacitor.js | One codebase → web + iOS + Android |
| State | Zustand (global) + React Query (server) | Lightweight stores: GameStore, QuizStore, ChatStore, UserStore |
| Routing | React Router v6 | Code-splitting, lazy loading |
| UI | shadcn/ui + Tailwind CSS | Accessible, customizable |
| Animation | Framer Motion | Game-feel transitions |
| QR Scanning | html5-qrcode | Browser Camera API |
| Forms | React Hook Form + Zod | Type-safe validation |
| i18n | react-i18next | Turkish + English |
| Build | Vite | Fast HMR, optimized bundling |
| Charts | Recharts | Admin dashboards |
| Tables | TanStack Table v8 | Virtualized admin data tables |
| PWA | Vite PWA Plugin | Manifest, install prompt (offline deferred) |

### Backend

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | JS full-stack, non-blocking I/O |
| Framework | NestJS | Modular, decorator-based, DI, OpenAPI |
| API | REST + WebSocket (Socket.io) | REST for CRUD; WebSocket for AI chat + game events |
| Auth | JWT (RS256) + Passport.js | Stateless, social login ready |
| ORM | Prisma | Type-safe queries, migrations |
| Validation | class-validator + class-transformer | DTO-level input validation |
| Queues | Bull (Redis-backed) | Async jobs: embedding, images, analytics, exports |
| Storage | AWS S3 / Cloudflare R2 | QR images, media, exports |
| Email | Nodemailer + SendGrid | Password reset (sole v1.0 use case) |
| Logging | Winston + Pino | Structured JSON logs |

### AI / LLM

| Component | Technology | Notes |
|---|---|---|
| Primary LLM | Anthropic Claude (claude-sonnet) | Artifact Q&A, multi-language |
| Fallback | OpenAI GPT-4o-mini | Phase 2 cost optimization only — NO auto-switch in v1.0 |
| Embeddings | OpenAI text-embedding-3-small | 1536 dimensions |
| Vector Store | pgvector (PostgreSQL) | Collocated with relational data |
| Orchestration | LangChain.js | Chain management, retrieval |
| RAG Pipeline | Custom chunking + pgvector similarity | Top-3 chunks (K=3) |

### Database & Caching

| Layer | Technology | Rationale |
|---|---|---|
| Primary DB | PostgreSQL 16 (AWS RDS) | ACID, JSONB, pgvector, pg_trgm, TimescaleDB |
| Cache | Redis 7 (AWS ElastiCache) | JWT blocklist, leaderboard, game sessions, rate limits, Bull queues |
| Text Search | pg_trgm (GIN indexes) | Fuzzy artifact search |
| Semantic Search | pgvector (IVFFlat index) | RAG similarity |
| Analytics | TimescaleDB extension | Time-series hypertable, continuous aggregates |
| Migrations | Prisma Migrate | Version-controlled, CI-friendly |

---

## Monorepo Structure

```
/
├── apps/
│   ├── web/               # Visitor-facing PWA (React + Capacitor)
│   ├── admin/             # Museum & system admin dashboards
│   └── api/               # NestJS backend (all modules)
├── packages/
│   ├── ui/                # Shared component library (shadcn/ui)
│   ├── api-client/        # Auto-generated TypeScript client from OpenAPI
│   └── config/            # Shared ESLint, Tailwind, TypeScript configs
├── prisma/                # Schema + migrations
├── docker-compose.yml     # Local dev (PostgreSQL + Redis)
└── turbo.json             # Turborepo config
```

**Turborepo** orchestrates builds, linting, and testing across all packages.

---

## Data Flow Diagrams

### QR Scan → Treasure Hunt Flow

```
Visitor scans QR code
        │
        ▼
POST /api/v1/qr/validate
        │
        ├── Extract kid → select HMAC secret
        ├── Verify HMAC-SHA256 signature
        ├── Lookup qr_codes by code_hash
        ├── Check is_active
        ├── Increment scan_count
        ├── Emit qr_scan_success (Bull, fire-and-forget)
        │
        ▼
Return artifact data
        │
        ▼
POST /api/v1/game/sessions/:id/scan
        │
        ├── Validate QR matches expected clue artifact
        ├── Transition state: CLUE_ACTIVE → QR_SCANNED
        ├── Reveal question (was hidden — anti-cheat)
        ├── Update Redis (hot cache) → then PostgreSQL (async)
        │
        ▼
Display question to visitor
```

### AI RAG Pipeline

```
Visitor sends message (ai:send_message via WebSocket)
        │
        ▼
Content Safety Check (AG-02)
        │
        ├── Keyword blocklist scan (Redis)
        ├── LLM moderation pre-check
        ├── If VIOLATION → terminate session, emit ai:error
        │
        ▼ (SAFE)
Embed query → OpenAI text-embedding-3-small → 1536-dim vector
        │
        ▼
pgvector cosine similarity search
        │  WHERE museum_id = :museumId
        │  LIMIT 3 (top-K)
        │
        ▼
Construct prompt
        │
        ├── System: museum persona + language instruction
        ├── Context: top-3 artifact chunks
        ├── Focused artifact (if artifact_context_id set)
        ├── History: last N messages from ai_messages
        │
        ▼
Stream response → Anthropic Claude (claude-sonnet)
        │
        ├── ai:typing_start (before first token)
        ├── ai:token (each token)
        ├── ai:typing_end (final clean response)
        │
        ▼
Persist to ai_messages (tokens_used for cost tracking)
Emit ai_response_received analytics event (Bull, fire-and-forget)
```

### Analytics Event Ingestion

```
Any module emits event
        │
        ▼
Bull queue (fire-and-forget — failures never propagate)
        │
        ▼
Pseudonymize user_id → salted HMAC-SHA256 → user_id_hash
        │
        ▼
INSERT into analytics_events (TimescaleDB hypertable)
        │
        ▼
Continuous aggregates (hourly refresh)
        │
        ├── Daily rollups → trend charts
        ├── Weekly rollups → leaderboard (weekly/monthly)
        └── Artifact heatmap scores (weighted composite 0-100)
```

---

## API Design Principles

| Principle | Detail |
|---|---|
| Base Path | `/api/v1/` — all endpoints versioned |
| Resource Naming | RESTful plural nouns: `/api/v1/{resource}` |
| Pagination (public) | Cursor-based (keyset) for consistent ordering |
| Pagination (admin) | Offset-based for TanStack Table compatibility |
| Rate Limiting | Redis sliding window: 100/min public, 1,000/min auth, 3/min AI ⚙️ |
| WebSocket | `/ws/game` (live game), `/ws/ai` (AI streaming) |
| API Docs | OpenAPI auto-generated via NestJS Swagger decorators at `/api/docs` |

### Error Envelope

Every error response follows:

```json
{
  "statusCode": 400,
  "message": "Human-readable description",
  "errorCode": "QR_CLUE_MISMATCH",
  "requestId": "req_abc123def456",
  "timestamp": "2026-03-28T12:00:00.000Z",
  "path": "/api/v1/game/sessions/xyz/scan"
}
```

No custom error shapes are permitted.

---

## WebSocket Architecture

### Namespaces

| Namespace | Purpose | Auth |
|---|---|---|
| `/ws/game` | Live game state events, clue transitions | Guest or User JWT in `auth` handshake |
| `/ws/ai` | AI chat streaming (token-by-token) | User JWT in `auth` handshake (no guests) |

### Reconnection Strategy

- **Algorithm:** Exponential backoff with jitter
- **Schedule:** 1s, 2s, 4s, 8s, 16s (±500ms jitter)
- **Max Retries:** 5
- **AI disconnect mid-stream:** Display partial response, show error, user retries manually
- **Game disconnect:** Reconnect → `GET /api/v1/game/sessions/:id` to resync state

**CRITICAL:** JWT tokens MUST be in the Socket.io `auth` handshake object, NEVER in URL query parameters.

---

## Caching Strategy

| Use Case | Redis Structure | TTL |
|---|---|---|
| JWT blocklist | SET keyed by `jti` | Remaining token lifetime |
| Game session (hot cache) | JSON object per session | `gameSessionTimeoutHours` ⚙️ |
| Leaderboard (all_time) | Sorted set `leaderboard:{museumId}` | Persistent |
| Rate limiting | Sliding window counters | Per-window TTL |
| Login attempt lockout | Counter `login_attempts:{userId}` | 15 minutes |
| AI suggested questions | `suggested_q:{artifactId}:{lang}` | 24 hours |
| Password reset tokens | `password_reset:{sha256(token)}` | 15 minutes |
| Content safety blocklist | SET of blocked keywords | Persistent |

### Game Session Cache Pattern

- **Write:** Redis first (immediate), PostgreSQL second (async)
- **Read:** Redis for hot path (sub-millisecond), PostgreSQL as source of truth
- **Anti-cheat:** Question data stays `null` in Redis cache until correct QR scanned

---

## Async Processing (Bull Queues)

| Queue | Trigger | Job | Retry |
|---|---|---|---|
| `embedding` | Artifact create/update | Generate pgvector embedding via OpenAI | 2x exponential backoff |
| `image-optimization` | Media upload complete | Convert to WebP, generate 3 variants (400px, 1200px, full) | 2x |
| `analytics` | Any tracked user action | Pseudonymize + insert into TimescaleDB | No retry (fire-and-forget) |
| `export` | Admin export request | Generate CSV/PDF, upload to S3, return pre-signed URL | 2x |
| `qr-bulk` | Admin bulk generate | Generate QR PNGs, ZIP, upload to S3 | 2x |
| `user-segmentation` | Nightly cron (03:00 UTC) | Classify users into behavioral segments | Next nightly run |
| `user-cleanup` | Daily cron | Hard-delete users past 30-day soft-delete grace period | Next daily run |
| `ai-message-cleanup` | Daily cron | Hard-delete ai_messages older than 7 days | Next daily run |

---

## Infrastructure

### AWS Services

| Component | Service | Configuration |
|---|---|---|
| Compute | ECS Fargate | Min 2, max 10 tasks. Auto-scale at CPU > 70%. |
| Database | RDS PostgreSQL 16 | Multi-AZ. pgvector + pg_trgm + TimescaleDB. PITR (5-min granularity). |
| Cache | ElastiCache Redis 7 | Multi-AZ. |
| Storage | S3 / Cloudflare R2 | QR images, media, exports. Lifecycle rules. |
| Registry | ECR | Docker images. Vulnerability scanning. |
| Load Balancer | ALB | Application Load Balancer |
| CDN / WAF | Cloudflare | CDN, WAF, DDoS protection, DNS, SSL |
| SSL | ACM + Cloudflare SSL | |
| Secrets | AWS Secrets Manager | All API keys, HMAC secrets, credentials |
| Monitoring | CloudWatch + Grafana | Metrics, dashboards, alerting |
| IaC | Terraform | All infrastructure as code |
| Region | `eu-central-1` (Frankfurt) | KVKK/GDPR data residency |

### CI/CD Pipeline

```
PR opened
    │
    ▼
GitHub Actions
    ├── Lint (ESLint)
    ├── TypeScript type-check
    └── Unit tests
    │
    ▼ (all pass)
Merge to main
    │
    ▼
Build Docker image → Push to ECR
    │
    ▼
AWS CodeDeploy (Blue/Green)
    │
    ▼
Zero-downtime deployment to ECS
```

- Direct pushes to `main` are **prohibited**.
- All three CI gates MUST pass before merge.

---

## Monitoring & Observability

| Concern | Tool | Details |
|---|---|---|
| Error Tracking | Sentry | Frontend (`apps/web`, `apps/admin`) + backend |
| Metrics | CloudWatch + Grafana | API latency (p50/p95/p99), error rates, DB pool, Redis hit rate, ECS utilization, AI token cost |
| Logging | Winston + Pino → CloudWatch Logs | Structured JSON. No silent `catch` blocks. |
| Alerting | CloudWatch Alarms → SNS | Team notifications on threshold breaches |

### Key Grafana Panels

- API latency per endpoint (p50, p95, p99)
- Error rate (4xx, 5xx) per endpoint
- Database connection pool utilization
- Redis memory usage and hit rate
- ECS task count + CPU/memory utilization
- AI token cost per day (broken down by museum)

---

## Multi-Tenant Isolation

```
Request arrives
    │
    ▼
MuseumTenantMiddleware (global)
    │
    ├── Admin routes: resolve museumId from JWT claim
    ├── Public routes: resolve museumId from URL path parameter
    │
    ▼
museumId injected into request context
    │
    ▼
All repository methods: WHERE museum_id = :museumId
```

- Cross-museum queries are **forbidden** for all roles except `super_admin` system analytics.
- `museum_id` for admin roles comes from JWT `museumId` claim, **never** from request body.
- Row-Level Security (RLS) deferred to Phase 2 as additional hardening.

---

## Performance Targets

| Metric | Target |
|---|---|
| `POST /api/v1/qr/validate` p95 | < 200ms |
| `POST /api/v1/quiz/sessions/:id/answer` p95 | < 300ms |
| AI Time-to-First-Token (TTFT) | < 1.5s |
| Time to Interactive (mid-tier Android, 4G) | < 3.0s |
| Lighthouse Mobile Score | ≥ 90 |
| Uptime SLA | 99.9% |
| RPO | 1 hour |
| RTO | 4 hours |

---

*End of architecture.md*
