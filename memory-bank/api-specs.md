# MuseumQuest — API Specifications

**Version:** 1.0
**Last Updated:** 2026-03-28
**Source:** PRD v1.0 (Sections 8, 10, 13, 14)
**Base Path:** `/api/v1/`

---

## Conventions

### Authentication Headers

| Token | Transport | Details |
|---|---|---|
| Access Token | `Authorization: Bearer {token}` header | JWT RS256, 15 min expiry |
| Refresh Token | `httpOnly`, `Secure`, `SameSite=Strict` cookie named `refreshToken` | 7-day expiry, SHA-256 hashed in DB |
| Guest Token | `Authorization: Bearer {guestToken}` header | Session-scoped JWT, `type: "guest"` |
| WebSocket | Socket.io `auth` handshake object | **NEVER** in URL query parameters |

### Access Token Payload

```json
{
  "sub": "user-uuid",
  "role": "user | content_editor | museum_admin | super_admin",
  "museumId": "museum-uuid | null",
  "iat": 1711584000,
  "exp": 1711584900
}
```

### Error Envelope (All Errors)

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

### Success Envelope

```json
{
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-03-28T12:00:00.000Z"
}
```

### Pagination

**Cursor-based (public feeds):**
```json
{ "data": [...], "cursor": "eyJpZCI6IjEyMyJ9", "hasMore": true }
```

**Offset-based (admin tables):**
```json
{ "data": [...], "total": 156, "page": 1, "limit": 20 }
```

### Rate Limits

| Scope | Limit | Mechanism |
|---|---|---|
| Public (unauthenticated) | 100 req/min per IP | Redis sliding window |
| Authenticated | 1,000 req/min per user | Redis sliding window |
| AI Chat | 3 req/min per user ⚙️ | Redis sliding window (per museum config) |
| Login Attempts | 5 attempts / 15 min per account | Redis counter with TTL |

### Role Shorthand

| Symbol | Meaning |
|---|---|
| `public` | No auth required |
| `guest+` | Guest JWT or higher |
| `user+` | Authenticated user or higher |
| `content_editor+` | content_editor, museum_admin, or super_admin |
| `museum_admin+` | museum_admin or super_admin |
| `super_admin` | super_admin only |
| `(own)` | Scoped to actor's own `museum_id` |

---

## Auth Endpoints

### `POST /auth/register`

| Field | Value |
|---|---|
| Auth | `public` |
| Request | `{ email: string, password: string, displayName: string, dateOfBirth: string (ISO 8601) }` |
| Validation | email: valid + unique; password: min 8, 1 upper, 1 lower, 1 digit, 1 special; displayName: 2–50 chars, XSS sanitized; dateOfBirth: valid date |
| Success (201) | `{ accessToken, user: { id, email, displayName, role } }` + `refreshToken` in httpOnly cookie |
| Error | `409 AUTH_EMAIL_EXISTS` |

### `POST /auth/login`

| Field | Value |
|---|---|
| Auth | `public` |
| Request | `{ email: string, password: string }` |
| Success (200) | `{ accessToken, user: { id, email, displayName, role } }` + `refreshToken` in cookie |
| Errors | `401 AUTH_INVALID_CREDENTIALS`, `429 AUTH_ACCOUNT_LOCKED` (after 5 failures, 15 min lockout) |
| Notes | Only 1 active refresh token per user. New login revokes previous. |

### `POST /auth/refresh`

| Field | Value |
|---|---|
| Auth | Refresh token from `httpOnly` cookie |
| Request | Empty body (token read from cookie) |
| Success (200) | `{ accessToken }` + new `refreshToken` in cookie. Old token revoked (rotation). |
| Error | `401 AUTH_TOKEN_INVALID` |

### `POST /auth/logout`

| Field | Value |
|---|---|
| Auth | `user+` |
| Request | Empty body |
| Success (200) | `{ message: "Logged out" }`. Refresh token `jti` → Redis blocklist. Cookie cleared. |

### `POST /auth/forgot-password`

| Field | Value |
|---|---|
| Auth | `public` |
| Request | `{ email: string }` |
| Success (200) | Always returns `200 OK` regardless of email existence (prevents enumeration). Sends email via SendGrid with reset link. Token in Redis with 15-min TTL. |

### `POST /auth/reset-password`

| Field | Value |
|---|---|
| Auth | `public` |
| Request | `{ token: string, newPassword: string }` |
| Success (200) | Password updated. All refresh tokens revoked. Single-use token deleted from Redis. |
| Error | `400 AUTH_RESET_TOKEN_INVALID` |

### `GET /auth/google`

| Field | Value |
|---|---|
| Auth | `public` |
| Response | `302 Redirect` to Google consent screen |

### `GET /auth/google/callback`

| Field | Value |
|---|---|
| Auth | Google OAuth2 callback |
| Success (200) | `{ accessToken, user }` + `refreshToken` in cookie. Creates user if new. |
| Error | `409 AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER` (no auto-merge) |

### `POST /auth/link-guest`

| Field | Value |
|---|---|
| Auth | `public` or `user+` |
| Request | `{ guestToken: string, email?: string, password?: string, displayName?: string }` |
| Success (200) | Guest game session linked to user account. Progress preserved. `{ accessToken, user }` |

---

## User Endpoints

### `GET /users/me`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | `{ id, email, displayName, avatarUrl, role, museumId, totalPoints, preferences, dateOfBirth, createdAt }` |

### `PATCH /users/me`

| Field | Value |
|---|---|
| Auth | `user+` |
| Request | `{ displayName?: string, preferences?: object, language?: string }` |
| Success (200) | Updated user object |

### `POST /users/me/avatar`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | `{ uploadUrl: string, cdnUrl: string, expiresIn: number }` (pre-signed S3 URL) |
| Limits | Max 2 MB. JPEG, PNG, WebP only. |

### `DELETE /users/me`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | Soft-delete. Sets `deleted_at`. 30-day grace period begins. |

### `POST /users/me/restore`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | Clears `deleted_at`. Cancels scheduled hard-delete. |

### `GET /users/me/export`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | JSON export of user's profile, quiz scores, game sessions, rewards (GDPR portability) |

### `GET /users/me/rewards`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | `{ data: [{ id, rewardId, name, type, assetUrl, discountCode, isRedeemed, earnedVia, issuedAt }] }` |

### `GET /users` (Admin)

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` or `super_admin (all)` |
| Params | `search`, `page`, `limit` |
| Success (200) | Paginated user list (offset-based). museum_admin sees own museum users only. |

### `PATCH /users/:id/role` (Admin)

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` or `super_admin` |
| Request | `{ role: "content_editor" | "museum_admin" }` |
| Rules | museum_admin can assign content_editor or museum_admin within own museum. super_admin can assign any role. NEVER promote to super_admin. |

### `POST /users/:id/ban` (Admin)

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` or `super_admin` |
| Success (200) | User banned. All tokens revoked immediately. |

---

## Museum Endpoints

### `GET /museums`

| Field | Value |
|---|---|
| Auth | `public` |
| Params | `page`, `limit` (cursor-based) |
| Success (200) | List of active museums. `{ data: [{ id, name, slug, logoUrl, address }], cursor, hasMore }` |
| Filter | Only `is_active = true` museums shown |

### `GET /museums/:id`

| Field | Value |
|---|---|
| Auth | `public` |
| Success (200) | Full museum detail including `settings` (theme, enabled modules). |
| Error | `404 MUSEUM_NOT_FOUND` |

### `POST /museums`

| Field | Value |
|---|---|
| Auth | `super_admin` |
| Request | `{ name: string, slug: string, description: string, address: object }` |
| Success (201) | Created museum with seeded default `settings` JSONB |

### `PATCH /museums/:id`

| Field | Value |
|---|---|
| Auth | `museum_admin (own)` or `super_admin` |
| Request | `{ name?, description?, address?, settings? }` |
| Success (200) | Updated museum |

### `DELETE /museums/:id`

| Field | Value |
|---|---|
| Auth | `super_admin` |
| Success (200) | Soft-delete |

### `POST /admin/museums/:id/enable`

| Field | Value |
|---|---|
| Auth | `super_admin` |
| Success (200) | Sets `is_active = true`. Museum appears in public listings. |

### `POST /admin/museums/:id/disable`

| Field | Value |
|---|---|
| Auth | `super_admin` |
| Success (200) | Sets `is_active = false`. Hidden from listings. Visitor features return `403 MUSEUM_INACTIVE`. Admin panel still accessible. |

---

## Artifact Endpoints

### `GET /museums/:museumId/artifacts`

| Field | Value |
|---|---|
| Auth | `public` |
| Params | `search` (pg_trgm fuzzy), `period`, `page`, `limit` |
| Success (200) | Paginated artifact list (cursor-based) |

### `GET /artifacts/:id`

| Field | Value |
|---|---|
| Auth | `public` |
| Success (200) | Full artifact: `{ id, name, description, historicalContext, period, mediaUrls, audioGuideUrl, audioTranscript, locationHint, metadata, suggestedQuestions }` |

### `POST /artifacts`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Request | `{ museumId: string, name: string, description: string, historicalContext?: string, period?: string, locationHint?: string, metadata?: object }` |
| Success (201) | Created artifact. **Triggers async:** (1) embedding pipeline (Bull), (2) QR auto-generation |

### `PATCH /artifacts/:id`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Request | Partial artifact fields |
| Success (200) | Updated artifact. If `name`, `description`, or `historicalContext` changed → re-runs embedding pipeline. |

### `DELETE /artifacts/:id`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | Soft-delete. Associated QR code deactivated. |

### `GET /artifacts/:id/qr`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Success (200) | `{ id, imageUrl, scanCount, isActive, kid, createdAt }` |

---

## QR Code Endpoints

### `POST /qr/validate`

| Field | Value |
|---|---|
| Auth | `public` |
| Request | `{ codeHash: string }` |
| Success (200) | Validated artifact data. `scan_count` incremented. `qr_scan_success` event emitted (fire-and-forget). |
| Errors | `400 QR_INVALID_SIGNATURE`, `404 QR_NOT_FOUND`, `410 QR_DEACTIVATED` |
| **SLA** | **p95 < 200ms** |

### `GET /qr/:id`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Success (200) | QR image URL, scan count, status, metadata |

### `PATCH /qr/:id/deactivate`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | QR set to `is_active = false`. Future scans return `410 QR_DEACTIVATED`. |

### `POST /qr/bulk-generate`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (202) | `{ jobId: string }`. Async Bull job generates ZIP of all QR PNGs. Download via pre-signed S3 URL on completion. |

---

## Game (Treasure Hunt) Endpoints

### `POST /game/guest-token`

| Field | Value |
|---|---|
| Auth | `public` |
| Success (200) | `{ guestToken: string }`. Session-scoped JWT with `type: "guest"`. No DB user record. No PII. |

### `POST /game/sessions`

| Field | Value |
|---|---|
| Auth | `guest+` |
| Request | `{ scenarioId: string }` |
| Success (201) | `{ sessionId, storyIntro, currentClueIndex, state: "IDLE" }` |
| Error | `409 GAME_SESSION_ACTIVE` (only 1 active session per user/guest) |

### `GET /game/sessions/:id`

| Field | Value |
|---|---|
| Auth | Session owner |
| Success (200) | `{ id, state, currentClueIndex, score, clueNarrative, locationHint }`. Question is `null` unless state = `QR_SCANNED`. |

### `POST /game/sessions/:id/scan`

| Field | Value |
|---|---|
| Auth | Session owner |
| Request | `{ qrCodeHash: string }` |
| Success (200) | State → `QR_SCANNED`. Question revealed. `{ question: { text, options[] }, state }` |
| Errors | `400 QR_CLUE_MISMATCH` (wrong QR, counts as incorrect attempt), `400 QR_INVALID_SIGNATURE` |

### `POST /game/sessions/:id/answer`

| Field | Value |
|---|---|
| Auth | Session owner |
| Request | `{ selectedOptionIndex: number, timeSpentMs: number }` |
| Success (200) | `{ isCorrect, pointsEarned, hintText (if applicable), nextState }` |
| States | `CORRECT` → next clue or `FINAL_CODE`. `INCORRECT` → retry or hint. Max attempts exceeded → force-skip (0 pts). |
| **SLA** | **p95 < 300ms** (shares with quiz answer SLA) |

### `POST /game/sessions/:id/final-code`

| Field | Value |
|---|---|
| Auth | Session owner |
| Request | `{ code: string }` |
| Success (200) | State → `COMPLETED`. Reward issued. `{ reward, totalScore, state }` |
| Error | `400 GAME_INVALID_FINAL_CODE` |

### Game Scenario Admin

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/game/scenarios` | POST | `content_editor+ (own)` | Create scenario in `draft`. Payload: `{ title, storyIntro, difficulty, clues[], finalCode, rewardId? }` |
| `/game/scenarios` | GET | `content_editor+ (own)` | List scenarios. Admin sees draft + published. Visitors only `published`. |
| `/game/scenarios/:id` | PATCH | `content_editor+ (own)` | Update. Only `museum_admin+` can change `status` to `published`. |
| `/game/scenarios/:id` | DELETE | `museum_admin+ (own)` | Soft-delete. |

### Game Configurable Defaults ⚙️

| Parameter | Default | Source |
|---|---|---|
| `maxAnswerAttemptsPerClue` | 3 | `museums.settings.limits` |
| `hintsPerClue` | 1 | `museums.settings.limits` |
| `hintRevealOnAttempt` | 2 | `museums.settings.limits` |
| `gameSessionTimeoutHours` | 4 | `museums.settings.limits` |
| `gameClueTimerSeconds` | 60 | `museums.settings.limits` |
| `timeBonusEnabled` | true | `museums.settings.limits` |
| `timeBonusMax` | 10 | `museums.settings.limits` |
| Scoring per difficulty | easy: 10, medium: 20, hard: 30 | `museums.settings.limits.pointsPerCorrectByDifficulty` |

### Scoring Formula

```
basePoints  = pointsPerCorrectByDifficulty[scenario.difficulty]
timerMs     = gameClueTimerSeconds × 1000
timeBonus   = timeBonusEnabled ? floor(timeBonusMax × (1 − (timeSpentMs / timerMs))) : 0
timeBonus   = max(0, timeBonus)
totalPoints = basePoints + timeBonus
```

---

## Quiz Endpoints

### `POST /quiz/sessions`

| Field | Value |
|---|---|
| Auth | `user+` |
| Request | `{ museumId: string, difficulty: "easy" | "medium" | "hard" }` |
| Success (201) | `{ sessionId, firstQuestion: { id, text, options[], questionNumber } }`. Randomly selects questions from published bank. |

### `POST /quiz/sessions/:id/answer`

| Field | Value |
|---|---|
| Auth | Session owner |
| Request | `{ questionId: string, selectedOptionIndex: number, timeSpentMs: number }` |
| Success (200) | `{ isCorrect, correctOptionIndex, explanation, pointsEarned, totalScore }` |
| Timer | Server rejects if `timeSpentMs > quizTimerSeconds × 1000` → scored as incorrect |
| **SLA** | **p95 < 300ms** |

### `POST /quiz/sessions/:id/complete`

| Field | Value |
|---|---|
| Auth | Session owner |
| Success (200) | `{ totalScore, rank, accuracy, xpEarned }`. Upserts `museum_quiz_scores` (personal best only). Updates Redis sorted set. |

### `GET /quiz/leaderboard/:museumId`

| Field | Value |
|---|---|
| Auth | `public` |
| Params | `period` (`all_time`, `weekly`, `monthly`), `limit` (default 50) |
| Success (200) | `{ data: [{ rank, displayName, bestScore, quizCount }] }`. `all_time` from Redis. `weekly/monthly` from TimescaleDB. |

### Quiz Question Admin

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/quiz/questions` | POST | `content_editor+ (own)` | Create in `draft`. `{ museumId, artifactId?, questionText, options[], difficulty, explanation }` |
| `/quiz/questions` | GET | `content_editor+ (own)` | List by museum, difficulty, status |
| `/quiz/questions/:id` | PATCH | `content_editor+ (own)` | Update. Only `museum_admin+` can publish. |
| `/quiz/questions/:id` | DELETE | `museum_admin+ (own)` | Soft-delete |

### Quiz Configurable Defaults ⚙️

| Parameter | Default | Source |
|---|---|---|
| `quizTimerSeconds` | 30 | `museums.settings.limits` |
| Questions per quiz | easy: 10, medium: 15, hard: 20 | `museums.settings.limits.questionsPerQuizByDifficulty` |
| Scoring per difficulty | easy: 10, medium: 20, hard: 30 | `museums.settings.limits.pointsPerCorrectByDifficulty` |
| `timeBonusMax` | 10 | `museums.settings.limits` |

---

## AI Chat Endpoints

### `POST /ai/chat/sessions`

| Field | Value |
|---|---|
| Auth | `user+` |
| Request | `{ museumId: string, artifactContextId?: string }` |
| Success (201) | `{ sessionId }` |
| Error | `403 AI_MODULE_DISABLED` (if `ai_config.isEnabled = false`) |

### `GET /ai/chat/sessions`

| Field | Value |
|---|---|
| Auth | `user+` |
| Success (200) | User's chat sessions for a museum |

### `GET /ai/chat/sessions/:id/messages`

| Field | Value |
|---|---|
| Auth | Session owner |
| Params | Cursor-based (default 30 messages, most recent first, infinite scroll up) |
| Success (200) | `{ data: [{ id, role, content, tokensUsed, createdAt }], cursor, hasMore }` |

### WebSocket: `/ws/ai`

| Event | Direction | Payload | Description |
|---|---|---|---|
| `ai:send_message` | client→server | `{ sessionId, content }` | Send user message. Triggers RAG pipeline. |
| `ai:typing_start` | server→client | `{}` | After RAG retrieval, before first LLM token |
| `ai:token` | server→client | `{ token: string }` | Each streamed LLM token |
| `ai:typing_end` | server→client | `{ content: string }` | Full clean response on completion |
| `ai:error` | server→client | `{ errorCode, message }` | Rate limit, content violation, API failure |

**Auth:** JWT in Socket.io `auth` handshake object. NEVER in URL params.
**TTFT Target:** < 1.5 seconds.

### AI Errors

| Code | Trigger |
|---|---|
| `AI_RATE_LIMITED` | Exceeded `aiRateLimitPerMinute` ⚙️ (default 3) |
| `AI_MAX_TURNS_REACHED` | Exceeded `maxAiTurnsPerSession` ⚙️ (default 5) |
| `AI_CONTENT_VIOLATION` | Content safety check failed. Session terminated silently. |
| `AI_SERVICE_UNAVAILABLE` | Claude API failed after 2 retries |
| `AI_MODULE_DISABLED` | `ai_config.isEnabled = false` for this museum |

---

## Reward Endpoints

### `POST /rewards`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Request | `{ museumId, name, type: "badge" | "certificate" | "discount_code", assetUrl?, description? }` |
| Success (201) | Created reward definition |

### `GET /rewards`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Success (200) | List reward definitions for the museum |

### `PATCH /rewards/:id`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Success (200) | Updated reward |

### `DELETE /rewards/:id`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | Deleted |

### `POST /rewards/issue` (Internal)

| Field | Value |
|---|---|
| Auth | Internal (called by GameModule / QuizModule) |
| Request | `{ userId, rewardId, earnedVia: { type, sessionId } }` |
| Notes | Unique constraint `(user_id, reward_id)` prevents duplicate badges. Discount codes: random 8-char uppercase alphanumeric. |

### `POST /rewards/:id/verify`

| Field | Value |
|---|---|
| Auth | `content_editor+ (own)` |
| Request | `{ code: string }` |
| Success (200) | `{ valid: boolean, rewardName, userName }`. Marks as redeemed if valid. |

---

## Analytics Endpoints

### `GET /analytics/:museumId/overview`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` or `super_admin` |
| Params | `from`, `to` (ISO dates) |
| Success (200) | KPI summary: total visitors, QR scans, quiz completions, AI queries. JSON for Recharts. |

### `GET /analytics/:museumId/heatmap`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | Artifact heatmap: `[{ artifactId, name, compositeScore (0-100), scans, aiQueries, pageViews, avgDwellTime }]` |

### `GET /analytics/:museumId/funnels`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | 5 conversion funnels with stage counts and drop-off rates |

### `GET /analytics/:museumId/segments`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | `{ explorer: count, scholar: count, passive: count, newcomer: count }` |

### `GET /analytics/:museumId/ai-performance`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | `{ sessionContinuationRate, suggestedQuestionTapRate, thumbsUp, thumbsDown, totalTokenCost }` |

### `GET /analytics/system/overview`

| Field | Value |
|---|---|
| Auth | `super_admin` |
| Success (200) | Cross-museum platform stats: total users, total scans, AI token costs, per-museum breakdown |

### `POST /analytics/:museumId/export`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Request | `{ format: "csv" | "pdf", reportType: "activity_log" | "artifact_heatmap" | "leaderboard" | "quiz_performance" }` |
| Success (202) | `{ jobId }`. Async Bull job. No PII in exports. |

### `GET /analytics/export/:jobId`

| Field | Value |
|---|---|
| Auth | Export requester |
| Success (200) | `{ status: "pending" | "processing" | "completed" | "failed", downloadUrl?: string }`. Pre-signed S3 URL (24h expiry). |

---

## Media Endpoints

### `POST /media/presign`

| Field | Value |
|---|---|
| Auth | `content_editor+` |
| Request | `{ fileName, fileSize, mimeType, context: "avatar" | "artifact_image" | "audio_guide" | "reward_asset" }` |
| Success (200) | `{ uploadUrl, cdnUrl, expiresIn: 300 }` (5 min pre-signed S3 URL) |
| Limits | Avatar: 2 MB. Artifact image: 15 MB. Audio guide: 50 MB. Formats: JPEG, PNG, WebP (images); MP3, AAC, OGG (audio). |
| Error | `400 MEDIA_FILE_TOO_LARGE`, `400 MEDIA_INVALID_TYPE` |

### `DELETE /media/:key`

| Field | Value |
|---|---|
| Auth | `museum_admin+ (own)` |
| Success (200) | Media deleted from S3. CDN cache invalidated. |

---

## Health Endpoints

### `GET /health/live`

| Field | Value |
|---|---|
| Auth | None |
| Success (200) | `{ status: "ok" }`. Process is running. ECS liveness probe. |

### `GET /health/ready`

| Field | Value |
|---|---|
| Auth | None |
| Success (200) | `{ status: "ok", checks: { postgres: "ok", redis: "ok", s3: "ok" } }`. ALL dependencies healthy. ECS readiness probe. |
| Failure (503) | `{ status: "degraded", checks: { ... } }` |

---

## WebSocket Namespaces

### `/ws/ai` — AI Chat Streaming

- **Auth:** `user+` JWT in `auth` handshake object
- **Events:** See AI Chat Endpoints section above
- **Reconnection:** Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s) max 5 retries
- **Mid-stream disconnect:** Partial response displayed as-is. Error shown. User retries manually.

### `/ws/game` — Game State Events

- **Auth:** `guest+` JWT in `auth` handshake object
- **Events:** State transitions mirroring the game state machine
- **Reconnection:** Same backoff strategy. On reconnect → `GET /game/sessions/:id` to resync.

---

## Error Code Registry

| Domain | Codes |
|---|---|
| Auth | `AUTH_EMAIL_EXISTS`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_ACCOUNT_LOCKED`, `AUTH_RESET_TOKEN_INVALID`, `AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER` |
| Museum | `MUSEUM_NOT_FOUND`, `MUSEUM_INACTIVE` |
| QR | `QR_INVALID_SIGNATURE`, `QR_NOT_FOUND`, `QR_DEACTIVATED`, `QR_CLUE_MISMATCH` |
| Game | `GAME_SESSION_ACTIVE`, `GAME_SESSION_EXPIRED`, `GAME_SESSION_NOT_FOUND`, `GAME_MAX_ATTEMPTS_EXCEEDED`, `GAME_INVALID_FINAL_CODE` |
| Quiz | `QUIZ_SESSION_NOT_FOUND`, `QUIZ_TIMER_EXCEEDED`, `QUIZ_ALREADY_COMPLETED` |
| AI | `AI_RATE_LIMITED`, `AI_MODULE_DISABLED`, `AI_MAX_TURNS_REACHED`, `AI_CONTENT_VIOLATION`, `AI_SERVICE_UNAVAILABLE` |
| Media | `MEDIA_FILE_TOO_LARGE`, `MEDIA_INVALID_TYPE` |
| General | `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL_ERROR` |

---

*End of api-specs.md*
