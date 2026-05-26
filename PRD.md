# MuseumQuest — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-03-28
**Status:** Approved for Development
**Confidentiality:** Internal — Engineering & Product Teams Only

---

## Table of Contents

1. [Document Control](#1-document-control)
2. [Product Overview](#2-product-overview)
3. [Vision & Core Objectives](#3-vision--core-objectives)
4. [Monetization Model](#4-monetization-model)
5. [Launch Scope & Release Strategy](#5-launch-scope--release-strategy)
6. [User Personas](#6-user-personas)
7. [Roles & Permission Matrix (RBAC)](#7-roles--permission-matrix-rbac)
8. [Functional Requirements](#8-functional-requirements)
   - 8.1 [Authentication & Account Management](#81-authentication--account-management)
   - 8.2 [Museum Management & Onboarding](#82-museum-management--onboarding)
   - 8.3 [Artifact Management](#83-artifact-management)
   - 8.4 [QR Code System](#84-qr-code-system)
   - 8.5 [Treasure Hunt Game Engine](#85-treasure-hunt-game-engine)
   - 8.6 [Quiz Module & Leaderboard](#86-quiz-module--leaderboard)
   - 8.7 [AI Assistant (RAG Chat)](#87-ai-assistant-rag-chat)
   - 8.8 [Rewards & Badges](#88-rewards--badges)
   - 8.9 [Admin Panel](#89-admin-panel)
   - 8.10 [Analytics & Reporting](#810-analytics--reporting)
   - 8.11 [Media Management](#811-media-management)
   - 8.12 [Health & Monitoring](#812-health--monitoring)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture](#10-system-architecture)
11. [Technology Stack](#11-technology-stack)
12. [Database Schema](#12-database-schema)
13. [API Contracts & Error Handling](#13-api-contracts--error-handling)
14. [Security & Compliance](#14-security--compliance)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Explicitly Out of Scope (v1.0)](#16-explicitly-out-of-scope-v10)
17. [Future Roadmap (Phase 2+)](#17-future-roadmap-phase-2)
18. [Glossary](#18-glossary)

---

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | MuseumQuest — Product Requirements Document |
| Version | 1.0 |
| Created | 2026-03-28 |
| Architecture Pattern | Modular Monolith (Phase 1) |
| Primary Regulation | KVKK (Turkish Personal Data Protection Law) + GDPR |
| Target Environment | AWS eu-central-1 (Frankfurt) |

**Conventions used in this document:**
- ⚙️ = **Configurable Default** — This value ships as the factory default and must be modifiable by museum administrators via `museums.settings.limits`. Engineers must seed these values during museum creation but must not hard-code them.
- `[MVP-STUB]` = Feature is required for v1.0 release but the detailed behavioral logic will be finalized in a later design discussion. Engineers must build the data model, API endpoint, and admin UI surface; the business logic behind it will be patched before launch.
- `(own)` in the permission matrix = Scoped to the actor's own `museum_id` only.

---

## 2. Product Overview

MuseumQuest is a mobile-first, gamified web application that transforms traditional museum visits into interactive discovery experiences. Visitors engage through **Treasure Hunt** adventures, competitive **Quizzes**, and an **AI-powered artifact assistant** — all accessible by scanning QR codes positioned beside exhibits.

The platform serves three audiences simultaneously:

1. **Museum Visitors** — seeking immersive, game-driven engagement with exhibits.
2. **Museum Administrators** — managing content, gamification scenarios, and engagement analytics.
3. **Platform Operators (MuseumQuest Team)** — overseeing the multi-tenant SaaS infrastructure and onboarding museums.

---

## 3. Vision & Core Objectives

**Vision Statement:** Transform passive museum visits into active, game-driven discovery experiences that increase visitor dwell time, repeat visits, and interest in cultural heritage.

**Core Objectives for v1.0:**

| # | Objective |
|---|---|
| O-1 | Convert passive museum visits into active, game-driven discovery experiences via Treasure Hunts, Quizzes, and AI chat. |
| O-2 | Increase visitor dwell time, repeat visits, and archaeological interest through gamification mechanics (points, badges, leaderboards). |
| O-3 | Provide real-time, multi-language (Turkish + English) AI assistance for artifact exploration and route suggestions. |
| O-4 | Supply museum administrators with rich engagement analytics, content management tools, and artifact heatmaps. |
| O-5 | Build a scalable, multi-tenant SaaS foundation ready for future donation, digital ownership, and multiplayer modules. |

**Success Measurement (v1.0):** Platform adoption (museums onboarded, registered users), engagement (QR scans, game completions, AI query volume), and retention (repeat visit rate). Specific numeric KPIs (OKRs) are intentionally deferred — the v1.0 focus is building a stable, feature-complete MVP product. Analytics infrastructure will capture all data needed for post-launch KPI definition.

---

## 4. Monetization Model

MuseumQuest is a **monthly SaaS subscription** offered to museums.

| Component | Description |
|---|---|
| Installation Fee | One-time onboarding fee charged per museum at setup. Amount TBD — not blocking development. |
| Monthly Recurring Fee | Ongoing subscription for platform access, AI usage, and support. Amount TBD — not blocking development. |
| Billing System | Not in scope for v1.0. Museum activation/deactivation is managed manually by `super_admin` via the `museums.is_active` flag. |
| Visitor Cost | Free. Visitors never pay to use MuseumQuest. |

The platform must support toggling museum access (`is_active` boolean) as the primary mechanism for controlling SaaS entitlement until a billing system is built in Phase 2.

---

## 5. Launch Scope & Release Strategy

| Parameter | Value |
|---|---|
| Release Type | MVP (Minimum Viable Product) — first functional version |
| Public/Private Beta | No planned beta release; the goal is to build a complete v1.0 |
| Sprint Timeline | 8 sprints × 2 weeks = 16 weeks (guideline, not a hard deadline) |
| Target Museums at Launch | 5 |
| Target Registered Users | 10,000 |
| Target Peak Concurrent Users | 500 |

---

## 6. User Personas

### 6.1 Elif — The Curious Explorer (Authenticated Visitor)

| Attribute | Detail |
|---|---|
| Age Range | 22–35 |
| Occupation | University student or young professional |
| Tech Proficiency | High — daily smartphone user, comfortable with apps and QR scanning |
| Museum Frequency | Occasional (2–4 times per year) |
| Primary Motivation | Gamification, competition among friends, earning badges, sharing achievements on social media |
| Pain Point | Traditional museum visits feel passive and boring; information plaques are dry and non-interactive |
| Goal | Transform a routine museum outing into a challenging, rewarding, and share-worthy experience |
| Key Workflows | Register → Select museum → Start Treasure Hunt → Scan QR codes → Answer questions → Earn badge → Share result. Take Quiz → Climb leaderboard. Ask AI about an artifact → Get contextual, conversational answer. |

### 6.2 Mehmet — The Walk-in Tourist (Guest / Anonymous Visitor)

| Attribute | Detail |
|---|---|
| Age Range | 30–55 |
| Occupation | Tourist or first-time visitor, domestic or international |
| Tech Proficiency | Moderate — uses smartphone for maps, photos, and messaging; unfamiliar with PWAs |
| Museum Frequency | Rare (visiting as part of a trip) |
| Primary Motivation | Curiosity after seeing a QR code sign beside an exhibit; does not want to commit to registration |
| Pain Point | Registration barriers prevent spontaneous exploration; language barriers in foreign museums |
| Goal | Scan a QR code, play a quick Treasure Hunt without creating an account, and decide later whether to register |
| Key Workflows | See QR code → Scan → Receive guest token automatically → Play Treasure Hunt → Prompted to register at end to save progress and earn badge → Optionally link guest session to new account. |

### 6.3 Dr. Ayşe — The Digital Curator (Museum Admin)

| Attribute | Detail |
|---|---|
| Age Range | 35–50 |
| Occupation | Museum curator or marketing/engagement manager |
| Tech Proficiency | Moderate — comfortable with CMS-style web tools, spreadsheets, and dashboards; not a developer |
| Primary Motivation | Increase visitor engagement metrics, justify digital investment to the museum board, understand which exhibits attract attention |
| Pain Point | No existing tools to measure which exhibits visitors engage with or to create interactive content without developer help |
| Goal | Manage artifacts, create game scenarios and quizzes, view engagement analytics and artifact heatmaps, and manage staff accounts — all from a single dashboard |
| Key Workflows | Log in to Admin Panel → View dashboard KPIs → Create/edit artifacts → Build Treasure Hunt scenario (draft → test → publish) → Create quiz questions → View artifact heatmap → Export analytics CSV → Assign content_editor role to a colleague. |

### 6.4 Can — The Museum Assistant (Content Editor)

| Attribute | Detail |
|---|---|
| Age Range | 25–35 |
| Occupation | Museum staff member, intern, or volunteer |
| Tech Proficiency | Basic to moderate — comfortable with web forms and file uploads; no admin experience |
| Primary Motivation | Contributing to the visitor experience by keeping content fresh and accurate without risk of breaking things |
| Pain Point | Needs to update artifact descriptions, add quiz questions, and manage content quickly but lacks (and should not have) full admin privileges |
| Goal | Create and edit artifacts, manage quiz question banks, and draft game scenario content — without access to deletion, settings, or user management |
| Key Workflows | Log in (role assigned by museum_admin) → Navigate to Artifacts → Create new artifact (auto-generates QR code) → Upload images → Write quiz questions → Draft a game scenario clue → Submit for museum_admin to publish. View read-only analytics to understand engagement. |

### 6.5 Kerem — The Platform Operator (Super Admin)

| Attribute | Detail |
|---|---|
| Age Range | 28–40 |
| Occupation | MuseumQuest internal team member — engineering or operations |
| Tech Proficiency | High — full-stack developer or DevOps engineer |
| Primary Motivation | Platform stability, efficient museum onboarding, cost control (especially AI token spend), and cross-museum visibility |
| Pain Point | Needs a single pane of glass to monitor all museums, onboard new clients, manage billing status (is_active), moderate AI content, and view system-wide health |
| Goal | Create and configure new museums, provision initial museum_admin accounts, monitor platform KPIs, review flagged AI content, and manage infrastructure |
| Key Workflows | Log in to System Admin Panel → Create new museum → Create museum_admin account for client → Enable museum → Monitor system-wide analytics → Review flagged AI messages → Disable museum if SaaS subscription lapses. |

---

## 7. Roles & Permission Matrix (RBAC)

### 7.1 Role Definitions

| Role | Database ENUM Value | Scope | Created By |
|---|---|---|---|
| Visitor | `user` | Global (can access any public museum) | Self-registration or Google OAuth2 |
| Guest | No DB record; session-scoped JWT | Single game session | Auto-issued on Treasure Hunt start |
| Content Editor | `content_editor` | Single museum (`museum_id`) | Promoted by `museum_admin` of the same museum |
| Museum Admin | `museum_admin` | Single museum (`museum_id`) | Created by `super_admin` (initial) or promoted by another `museum_admin` of the same museum |
| Super Admin | `super_admin` | Platform-wide (all museums) | Seeded in database or created by another `super_admin` |

**Role Hierarchy:** `super_admin` > `museum_admin` > `content_editor` > `user` > `guest`

**Critical Constraints:**
- A `museum_admin` can ONLY create/promote accounts scoped to their own `museum_id`. The `museum_id` is automatically inherited from the acting `museum_admin`.
- A `museum_admin` can NEVER create or promote a `super_admin`.
- A `content_editor` can ONLY modify content within their assigned `museum_id`.
- A `museum_admin` cannot access, view, or modify data belonging to any other museum.
- There is NO email-based invitation flow. Role assignment is a direct action performed in the admin panel.

### 7.2 Full Permission Matrix

> Legend: ✅ = Allowed | ❌ = Denied | 🔒 = Own museum only | 👁️ = Read-only

| Module | Action | `super_admin` | `museum_admin` | `content_editor` | `user` | `guest` |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Museums** | Create museum | ✅ | ❌ | ❌ | ❌ | ❌ |
| | View museum list (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | View museum detail (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Update museum details | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Update museum settings (JSONB) | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Delete museum | ✅ | ❌ | ❌ | ❌ | ❌ |
| | Enable/Disable museum | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Artifacts** | Create artifact | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | View artifact (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Update artifact | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Delete artifact | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **QR Codes** | Auto-generated on artifact creation | System | System | System | — | — |
| | View / Download QR image | ✅ | 🔒 | 🔒 👁️ | ❌ | ❌ |
| | Deactivate QR code | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Scan QR code (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Game Scenarios** | Create scenario (draft) | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Update scenario | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Delete scenario | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Publish / Unpublish scenario | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Play Treasure Hunt | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Quiz** | Create question (draft) | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Update question | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Delete question | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Publish / Unpublish question | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Play quiz | ✅ | ✅ | ✅ | ✅ | ❌ |
| | View leaderboard (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Assistant** | Start chat session | ✅ | ✅ | ✅ | ✅ | ❌ |
| | View AI message logs | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Flag / Dismiss AI messages | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **Rewards** | Create reward definition | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Update reward definition | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | Delete reward definition | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | Verify discount code (ticket desk) | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| | View own earned rewards | — | — | — | ✅ | ❌ |
| **Users** | View own profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| | Update own profile | ✅ | ✅ | ✅ | ✅ | ❌ |
| | View user list | ✅ (all) | 🔒 | ❌ | ❌ | ❌ |
| | Assign roles (museum_admin, content_editor) | ✅ (any museum) | 🔒 | ❌ | ❌ | ❌ |
| | Ban user | ✅ (any) | 🔒 | ❌ | ❌ | ❌ |
| | Delete account (own) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Analytics** | View museum analytics | ✅ (all) | 🔒 | 🔒 👁️ | ❌ | ❌ |
| | View system-wide analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| | Export CSV / PDF | ✅ (all) | 🔒 | ❌ | ❌ | ❌ |
| **Admin Panel** | Museum dashboard | ✅ | 🔒 | ❌ | ❌ | ❌ |
| | System admin panel | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Audit Log** | View audit entries | ✅ (all) | 🔒 👁️ | ❌ | ❌ | ❌ |

---

## 8. Functional Requirements

### 8.1 Authentication & Account Management

#### 8.1.1 Registration

| Field | Rule |
|---|---|
| `email` | Required. Must be a valid email format. Must be unique across the platform. |
| `password` | Required. Minimum 8 characters. At least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character. |
| `display_name` | Required. 2–50 characters. Sanitized for XSS. |
| `date_of_birth` | Required. ISO 8601 date (YYYY-MM-DD). Collected for future age-gate validation (see Section 14.2). No age-based blocking logic is enforced in v1.0 — the field is stored for when the policy is finalized. |

- **Endpoint:** `POST /api/v1/auth/register`
- On success: creates a `user` record (role: `user`), issues an `access_token` (JWT, 15 min expiry) and a `refresh_token` (7 day expiry, stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie).
- On duplicate email: returns `409 Conflict` with `errorCode: AUTH_EMAIL_EXISTS`.
- The `access_token` payload contains: `sub` (userId), `role`, `museumId` (null for visitors), `iat`, `exp`.

#### 8.1.2 Login

- **Endpoint:** `POST /api/v1/auth/login`
- **Payload:** `{ email, password }`
- On success: issues `access_token` + `refresh_token` (same as registration).
- **Account Lockout:** After 5 consecutive failed login attempts, the account is locked for 15 minutes. A Redis key `login_attempts:{userId}` tracks the count with a 15-minute TTL. After lockout expires, the counter resets.
- On lockout: returns `429 Too Many Requests` with `errorCode: AUTH_ACCOUNT_LOCKED`.
- **Device Limit:** Only 1 active refresh token is allowed per user. Issuing a new refresh token revokes the previous one (the old `jti` is added to the Redis blocklist and the DB row is marked `is_revoked = true`).

#### 8.1.3 Token Refresh

- **Endpoint:** `POST /api/v1/auth/refresh`
- The `refresh_token` is read from the `httpOnly` cookie (not the request body).
- The server validates: (a) token signature, (b) `jti` is not in the Redis blocklist, (c) `is_revoked = false` in the database, (d) not expired.
- **Refresh Token Rotation:** On every successful refresh, a new `refresh_token` with a new `jti` is issued. The old `jti` is immediately added to the Redis blocklist and the old DB row is marked `is_revoked = true`.
- If validation fails: returns `401 Unauthorized` with `errorCode: AUTH_TOKEN_INVALID`.

#### 8.1.4 Logout

- **Endpoint:** `POST /api/v1/auth/logout`
- Adds the current refresh token's `jti` to the Redis blocklist.
- Marks the `refresh_tokens` DB row as `is_revoked = true`.
- Clears the `httpOnly` cookie.

#### 8.1.5 Password Reset

- **Step 1 — Request Reset:** `POST /api/v1/auth/forgot-password` with `{ email }`.
  - Generates a cryptographically random token.
  - Stores in Redis: key `password_reset:{sha256(rawToken)}`, value `{ userId, email, createdAt }`, TTL **15 minutes**.
  - Sends an email (via SendGrid) containing a reset link with the raw token as a URL parameter.
  - Always returns `200 OK` regardless of whether the email exists (prevents email enumeration).
- **Step 2 — Execute Reset:** `POST /api/v1/auth/reset-password` with `{ token, newPassword }`.
  - Validates the token against Redis. If expired or not found: `400 Bad Request` with `errorCode: AUTH_RESET_TOKEN_INVALID`.
  - Updates the user's `password_hash`.
  - **Single-use:** The Redis key is deleted immediately on successful reset.
  - All existing refresh tokens for the user are revoked (forced re-login on all devices).

#### 8.1.6 Google OAuth2

- **Endpoint:** `GET /api/v1/auth/google` — redirects to Google consent screen.
- **Callback:** `GET /api/v1/auth/google/callback` — processes Google's response.
- If the Google profile's email matches an existing account that was registered via email/password: **the system returns an error**. Accounts are NOT auto-merged. Returns `409 Conflict` with `errorCode: AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER`.
- If the email does not exist: creates a new `user` record (with `password_hash = null` to indicate social-only account).
- Issues `access_token` + `refresh_token` as per standard login.

#### 8.1.7 Guest Token (Anonymous Treasure Hunt)

- **Endpoint:** `POST /api/v1/game/guest-token`
- No credentials required.
- Issues a session-scoped JWT containing: `sub` (randomly generated UUID — not linked to any user record), `type: "guest"`, `iat`, `exp` (same as game session timeout).
- No user record is created in the database. The guest UUID is stored only on the `game_sessions.guest_token_jti` field.
- **No PII is collected or stored** for guest sessions (no IP address logging, no device fingerprinting). Only the game session state is persisted.

#### 8.1.8 Guest-to-Account Linking

- **Endpoint:** `POST /api/v1/auth/link-guest`
- **Payload:** `{ guestToken, email, password, displayName }` (or `{ guestToken }` if the user is already logged in).
- Creates a new user account (or uses the authenticated user).
- Finds the `game_sessions` record matching the guest token's `jti`.
- Updates `game_sessions.user_id` to the new user's UUID.
- Nullifies `game_sessions.guest_token_jti`.
- All game progress (score, current clue index, session state) is preserved under the new account.
- Returns standard `access_token` + `refresh_token`.

#### 8.1.9 Account Deletion (Soft Delete → Hard Delete)

- **Endpoint:** `DELETE /api/v1/users/me`
- Immediately sets `users.deleted_at` to the current timestamp (soft delete).
- **30-day grace period:** during this period, the user can log in normally. On login, the system presents a banner: "Your account is scheduled for deletion on {date}. Cancel deletion?"
- **Cancel deletion:** `POST /api/v1/users/me/restore` — clears `deleted_at`.
- **After 30 days (automated job):** Hard-delete all PII:
  - Remove `email`, `display_name`, `avatar_url`, `password_hash`, `preferences` from the `users` record (or delete the row entirely).
  - Delete all `ai_messages` where `session.user_id` = this user.
  - Delete all `ai_chat_sessions` for this user.
  - **Unlink (anonymize) game/quiz data:** Set `user_id = NULL` on `game_sessions`, `quiz_sessions`, `quiz_answers`, and `museum_quiz_scores` rows. This preserves aggregate analytics without retaining PII.
  - Remove leaderboard entries from Redis sorted sets.
  - Delete all `user_rewards` entries.
  - Log the deletion event in `audit_logs`.

#### 8.1.10 User Profile Management

- **View Profile:** `GET /api/v1/users/me` — returns user data, preferences, role, museum_id (if admin), total_points.
- **Update Profile:** `PATCH /api/v1/users/me` — updatable fields: `display_name`, `preferences` (JSONB), `language`.
- **Avatar Upload:** `POST /api/v1/users/me/avatar` — triggers a pre-signed S3 upload URL via MediaModule. Max file size: **2 MB**. Accepted formats: JPEG, PNG, WebP.
- **Admin-Only User Endpoints:**
  - `GET /api/v1/users` — paginated user list with search (email, display_name). Scoped by `museum_id` for `museum_admin`.
  - `PATCH /api/v1/users/:id/role` — change a user's role. `museum_admin` can assign `museum_admin` or `content_editor` within their museum. `super_admin` can assign any role.
  - `POST /api/v1/users/:id/ban` — bans a user, revoking all their tokens immediately.

---

### 8.2 Museum Management & Onboarding

#### 8.2.1 Onboarding Flow

Museum onboarding is **manual** and performed exclusively by `super_admin`:

1. `super_admin` creates the museum record via `POST /api/v1/museums`.
2. `super_admin` creates the initial `museum_admin` account via `POST /api/v1/users` with `role: museum_admin` and `museum_id` set to the new museum.
3. The `museum_admin` receives their credentials directly from the `super_admin` (no email invitation system in v1.0).
4. The `museum_admin` logs in and begins configuring content (artifacts, scenarios, quizzes).

There is NO self-service museum registration in v1.0.

#### 8.2.2 Museum CRUD Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/museums` | GET | Public | List all active museums (paginated). Returns `id`, `name`, `slug`, `logo_url`, `address`. |
| `/api/v1/museums/:id` | GET | Public | Museum detail. Returns full museum data including `settings` (theme, enabled modules). |
| `/api/v1/museums` | POST | `super_admin` | Create a new museum. Required: `name`, `slug`, `description`, `address`. Seeds default `settings` JSONB. |
| `/api/v1/museums/:id` | PATCH | `museum_admin` (own) or `super_admin` | Update museum details and settings. |
| `/api/v1/museums/:id` | DELETE | `super_admin` | Soft-delete a museum. |

#### 8.2.3 Museum Enable / Disable

- **Endpoint:** `POST /api/v1/admin/museums/:id/enable` and `POST /api/v1/admin/museums/:id/disable`
- **Auth:** `super_admin` only.
- Toggles the `museums.is_active` boolean.
- **Operational Constraint:** Museum disabling is performed **outside of the museum's active operating hours**. Therefore, there will never be in-progress visitor sessions at the time of disabling. No active session termination logic is required.
- When a museum is disabled:
  - The museum is **hidden from public museum listings** (`GET /api/v1/museums` filters `is_active = true`).
  - All visitor-facing features (Treasure Hunt, Quiz, AI Chat) return `403 Forbidden` with `errorCode: MUSEUM_INACTIVE`.
  - Admin panel access remains functional so the `museum_admin` can still view historical data.

#### 8.2.4 Multi-Tenant Isolation

- A global `MuseumTenantMiddleware` is applied to all routes.
- The middleware resolves `museumId` from the request context (from the JWT `museumId` claim for admin routes, or from the URL path parameter for public routes).
- All downstream repository methods are forced to include `WHERE museum_id = :museumId` in their queries.
- **There are NO cross-museum data queries** except for `super_admin` system analytics endpoints.
- Row-Level Security (RLS) in PostgreSQL is deferred to Phase 2 as an additional hardening layer.

#### 8.2.5 Sandbox / Draft Mode

Game scenarios and quiz questions support a `status` field with values `draft` or `published`:

- **Draft items** are only visible in the admin panel. They do not appear in visitor-facing APIs.
- `content_editor` creates items in `draft` status by default.
- Only `museum_admin` (or `super_admin`) can transition an item from `draft` → `published` or `published` → `draft`.
- Admins can preview/test draft scenarios and questions directly from the admin panel before publishing them live.

---

### 8.3 Artifact Management

#### 8.3.1 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/museums/:museumId/artifacts` | GET | Public | Paginated artifact list with text search (pg_trgm). Params: `search`, `period`, `page`, `limit`. |
| `/api/v1/artifacts/:id` | GET | Public | Full artifact detail including `media_urls`, `audio_guide_url`, `transcript`, `location_hint`, and `metadata`. |
| `/api/v1/artifacts` | POST | `content_editor`+ (own museum) | Create artifact. Required: `museum_id`, `name`, `description`. **Triggers:** (1) embedding pipeline, (2) QR code auto-generation. |
| `/api/v1/artifacts/:id` | PATCH | `content_editor`+ (own museum) | Update artifact. If `name`, `description`, or `historical_context` change → re-runs embedding pipeline. |
| `/api/v1/artifacts/:id` | DELETE | `museum_admin`+ (own museum) | Soft-delete artifact. Deactivates associated QR code. |
| `/api/v1/artifacts/:id/qr` | GET | `content_editor`+ (own museum) | Returns the associated QR code record (image URL, scan count, status). |

#### 8.3.2 Embedding Pipeline

On artifact create or update (if text fields change):
1. Concatenate `name`, `description`, and `historical_context` into a single text block.
2. Chunk the text (if longer than 512 tokens) using overlapping windows.
3. Send each chunk to the **OpenAI text-embedding-3-small** API.
4. Store the resulting `vector(1536)` in the `artifacts.embedding` column (pgvector).
5. This embedding is used by the AIModule's RAG pipeline for semantic similarity search.
6. Embedding generation is processed **asynchronously** via a Bull queue job to avoid blocking the API response.

#### 8.3.3 Artifact Search

- **Text Search:** PostgreSQL `pg_trgm` extension for fuzzy text matching on `name`, `description`, and `period`. Supports partial matches and typo tolerance.
- **Semantic Search:** pgvector cosine similarity on the `embedding` column. Used internally by the AI module, not exposed as a public API.

---

### 8.4 QR Code System

#### 8.4.1 Auto-Generation (Triggered on Artifact Creation)

When a new artifact is created (POST /api/v1/artifacts):
1. The system automatically generates a QR code without any manual action.
2. A signed payload is created: `/scan/{museumId}/{artifactId}?sig={hmac}&kid={keyId}`.
3. The HMAC-SHA256 signature is computed using the current active secret key.
4. The `kid` (Key ID) parameter identifies which secret was used for signing (supports key versioning).
5. The QR code is rendered as a PNG image via the `qrcode` npm package.
6. The PNG is uploaded to S3/R2 under the key: `museums/{museumId}/qr/{artifactId}.png`.
7. A `qr_codes` database record is created linking the artifact, museum, code hash, and image URL.

#### 8.4.2 QR Scan Validation

- **Endpoint:** `POST /api/v1/qr/validate`
- **Payload:** `{ codeHash }` (extracted from the scanned URL)
- **Auth:** Public (no authentication required) — allows guests and visitors to scan freely.
- **Validation Steps:**
  1. Extract `kid` from the payload to determine which HMAC secret to use.
  2. Verify HMAC-SHA256 signature against the payload data. If invalid: `400 Bad Request` with `errorCode: QR_INVALID_SIGNATURE`.
  3. Look up the `qr_codes` record by `code_hash`. If not found: `404 Not Found`.
  4. Check `is_active`. If deactivated: `410 Gone` with `errorCode: QR_DEACTIVATED`.
  5. Increment `scan_count`.
  6. Emit `qr_scan_success` analytics event (asynchronous, fire-and-forget via Bull queue).
  7. Return the associated artifact data.

#### 8.4.3 QR Key Versioning (Secret Rotation)

- HMAC secrets are stored in AWS Secrets Manager and referenced by `kid` (Key ID).
- On rotation: a new secret is added with a new `kid`. The old secret is retained in a buffer (recommended: keep the 2 most recent secrets).
- The backend validates using the `kid` embedded in the QR URL to select the correct secret. This ensures existing physical QR codes in museums remain functional after rotation.
- All **new** QR codes are signed with the latest secret.

#### 8.4.4 Admin QR Management

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/qr/:id` | GET | `content_editor`+ (own museum) | Returns QR image URL, scan count, status, and metadata. |
| `/api/v1/qr/:id/deactivate` | PATCH | `museum_admin`+ (own museum) | Sets `is_active = false`. Scans of this code will return `410 Gone`. |
| `/api/v1/qr/bulk-generate` | POST | `museum_admin`+ (own museum) | Triggers a bulk generation Bull job. Returns `202 Accepted` with `jobId`. On completion, a ZIP file of all QR PNGs is available for download via a pre-signed S3 URL. |

---

### 8.5 Treasure Hunt Game Engine

#### 8.5.1 Overview

The Treasure Hunt is MuseumQuest's core gamification feature. It operates as a **finite state machine** per session. **Authentication is NOT required** — visitors can play as anonymous guests via a guest token.

#### 8.5.2 State Machine

```
IDLE → CLUE_ACTIVE → QR_SCANNED → ANSWER_SUBMITTED
                                        ├─→ CORRECT → (next clue) → CLUE_ACTIVE
                                        │              └─→ (last clue) → FINAL_CODE
                                        └─→ INCORRECT → (retry or hint) → ANSWER_SUBMITTED
FINAL_CODE → COMPLETED
```

| State | Description |
|---|---|
| `IDLE` | Session created, story intro shown to player. |
| `CLUE_ACTIVE` | Player has received a clue with a narrative and location hint. They must navigate to the artifact and scan its QR code. The question is **NOT revealed** until the QR is scanned (anti-cheat). |
| `QR_SCANNED` | QR code validated against the expected clue. Question is now presented. |
| `ANSWER_SUBMITTED` | Player has submitted an answer. Transitions to `CORRECT` or `INCORRECT`. |
| `CORRECT` | Answer was correct. Points awarded. Next clue unlocked (or transition to `FINAL_CODE` if last clue). |
| `INCORRECT` | Answer was wrong. Retry allowed. Hint revealed on 2nd failed attempt (⚙️ configurable). |
| `FINAL_CODE` | All clues completed. Player must enter a deciphered final code to claim reward. |
| `COMPLETED` | Final code accepted. Reward issued. Session archived. |

#### 8.5.3 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/game/guest-token` | POST | None | Issues a guest JWT for anonymous play. |
| `/api/v1/game/sessions` | POST | Guest or User | Start a new hunt. Payload: `{ scenarioId }`. Returns `sessionId` and story intro. **Constraint:** Only 1 active session per user/guest at a time. If an active session exists, returns `409 Conflict` with `errorCode: GAME_SESSION_ACTIVE`. |
| `/api/v1/game/sessions/:id` | GET | Session owner | Returns current session state (state enum, current clue index, score, clue narrative — but NOT the question unless `QR_SCANNED`). |
| `/api/v1/game/sessions/:id/scan` | POST | Session owner | Validate a QR scan against the expected clue. Payload: `{ qrCodeHash }`. On success: transitions to `QR_SCANNED`, reveals question. On wrong QR: returns `400` with `errorCode: QR_CLUE_MISMATCH` — counted as an incorrect attempt. |
| `/api/v1/game/sessions/:id/answer` | POST | Session owner | Submit an answer. Payload: `{ selectedOptionIndex, timeSpentMs }`. Returns `{ isCorrect, pointsEarned, hintText (if applicable), nextState }`. |
| `/api/v1/game/sessions/:id/final-code` | POST | Session owner | Verify the final code. Payload: `{ code }`. On success: issues reward, transitions to `COMPLETED`. |

#### 8.5.4 Game Rules & Configurable Defaults

All values below are **museum-wide** settings stored in `museums.settings.limits`. All game scenarios within a museum follow the same limits.

| Parameter | Default Value ⚙️ | Description |
|---|---|---|
| `maxAnswerAttemptsPerClue` | 3 | Maximum wrong answers before the clue is force-skipped (0 points). |
| `hintsPerClue` | 1 | Number of hints available per clue. |
| `hintRevealOnAttempt` | 2 | Hint is revealed after this many failed attempts. |
| `gameSessionTimeoutHours` | 4 | Session expires after this many hours of inactivity. Expired sessions are marked `EXPIRED` (non-resumable). |
| `pointsPerCorrectByDifficulty.easy` | 10 | Base points for a correct answer in an easy scenario. |
| `pointsPerCorrectByDifficulty.medium` | 20 | Base points for a correct answer in a medium scenario. |
| `pointsPerCorrectByDifficulty.hard` | 30 | Base points for a correct answer in a hard scenario. |
| `gameClueTimerSeconds` | 60 | Reference time (in seconds) for the Treasure Hunt time-bonus decay calculation per clue. This is NOT a hard countdown — it defines the window within which a time bonus can be earned. |
| `timeBonusEnabled` | true | Whether a time bonus is awarded for fast answers. |
| `timeBonusMax` | 10 | Maximum additional points for the fastest possible answer. Decays linearly based on `timeSpentMs` relative to the reference timer. |
| `maxFinalCodeAttempts` | 5 | Maximum incorrect final code submissions before the session is expired. Prevents brute-force guessing. |

> ⚙️ All values above are configurable defaults. Engineers must seed these values when creating a museum but must never hard-code them in game logic.

#### 8.5.5 Session Persistence & Caching

- **Source of truth:** PostgreSQL `game_sessions` table.
- **Hot-path cache:** Redis mirrors the active session state for sub-millisecond reads. Clue data (narrative text, location hint) is embedded in the Redis session object. Questions remain `null` in the cache until the correct QR is scanned (anti-cheat measure).
- **On state transition:** Redis is updated first, then PostgreSQL is updated asynchronously.

#### 8.5.6 Edge Cases

| Scenario | Behavior |
|---|---|
| Wrong QR scanned (different artifact) | `400 Bad Request`, `errorCode: QR_CLUE_MISMATCH`. Counted as one incorrect attempt toward `maxAnswerAttemptsPerClue`. |
| QR scanned from a different museum | `400 Bad Request`, `errorCode: QR_INVALID_SIGNATURE` (signature mismatch due to different museum context). |
| Session timeout (4 hours ⚙️) | Session state transitions to `EXPIRED`. Player must start a new session. Progress is NOT resumable. |
| Player tries to start second session | `409 Conflict`, `errorCode: GAME_SESSION_ACTIVE`. Must complete or wait for timeout of current session. |
| Pause and resume across app launches | **Not supported.** Sessions are NOT pausable. The session lives in Redis and will expire per `gameSessionTimeoutHours`. If the player re-opens the app within the timeout window, they can continue from the current state. |
| Max attempts exceeded on a clue | Force-skip the clue with 0 points. Transition to next clue (or `FINAL_CODE` if last clue). |

#### 8.5.7 Admin: Game Scenario Management

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/game/scenarios` | POST | `content_editor`+ (own museum) | Create a scenario in `draft` status. Payload: `{ title, storyIntro, difficulty, clues[] }`. |
| `/api/v1/game/scenarios` | GET | `content_editor`+ (own museum) | List scenarios for the museum. Admin sees `draft` and `published`; visitors only see `published`. |
| `/api/v1/game/scenarios/:id` | PATCH | `content_editor`+ (own museum) | Update scenario. Only `museum_admin`+ can change `status` to `published`. |
| `/api/v1/game/scenarios/:id` | DELETE | `museum_admin`+ (own museum) | Soft-delete scenario. |

#### 8.5.8 Scoring Formula

```
basePoints  = museums.settings.limits.pointsPerCorrectByDifficulty[scenario.difficulty]
timerMs     = context === 'game'
                ? gameClueTimerSeconds × 1000
                : quizTimerSeconds × 1000
timeBonus   = timeBonusEnabled
                ? floor(timeBonusMax × (1 − (timeSpentMs / timerMs)))
                : 0
timeBonus   = max(0, timeBonus)  // never negative
totalPoints = basePoints + timeBonus
```

---

### 8.6 Quiz Module & Leaderboard

#### 8.6.1 Overview

The Quiz module provides competitive, scored quizzes per museum. **Authentication IS required** so scores are attributed to a user for leaderboard placement. Each museum has its own independent leaderboard.

#### 8.6.2 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/quiz/sessions` | POST | `user`+ | Create a quiz session. Payload: `{ museumId, difficulty }`. Randomly selects questions from the museum's published question bank based on difficulty. Returns `sessionId` and the first question. |
| `/api/v1/quiz/sessions/:id/answer` | POST | Session owner | Submit an answer. Payload: `{ questionId, selectedOptionIndex, timeSpentMs }`. Calculates points and time bonus. Returns `{ isCorrect, correctOptionIndex, explanation, pointsEarned, totalScore }`. |
| `/api/v1/quiz/sessions/:id/complete` | POST | Session owner | Finalize the session. Writes/upserts `museum_quiz_scores` (personal best logic). Updates Redis sorted set. Returns `{ totalScore, rank, accuracy, xpEarned }`. |
| `/api/v1/quiz/leaderboard/:museumId` | GET | Public | Returns top N entries for the museum. Params: `period` (`all_time`, `weekly`, `monthly`), `limit` (default 50). Hydrated with `display_name` from PostgreSQL. |

#### 8.6.3 Quiz Rules & Configurable Defaults

| Parameter | Default Value ⚙️ | Description |
|---|---|---|
| `quizTimerSeconds` | 30 | Time limit per question in seconds. **Enforced server-side** — if `timeSpentMs > quizTimerSeconds × 1000`, the answer is rejected and scored as incorrect. |
| `questionsPerQuizByDifficulty.easy` | 10 | Number of questions randomly selected for an easy quiz. |
| `questionsPerQuizByDifficulty.medium` | 15 | Number of questions for a medium quiz. |
| `questionsPerQuizByDifficulty.hard` | 20 | Number of questions for a hard quiz. |
| `pointsPerCorrectByDifficulty.easy` | 10 | Base points per correct answer (easy). |
| `pointsPerCorrectByDifficulty.medium` | 20 | Base points per correct answer (medium). |
| `pointsPerCorrectByDifficulty.hard` | 30 | Base points per correct answer (hard). |
| `timeBonusMax` | 10 | Maximum additional points for fastest answer (shared with game engine). |

> ⚙️ All quiz timing and scoring values are seeded as defaults and modifiable by `museum_admin` via `museums.settings.limits`.

#### 8.6.4 Timer Behavior

- A countdown timer is displayed per question on the frontend.
- Timer duration is read from `museums.settings.limits.quizTimerSeconds`.
- If the timer expires before the user submits: the frontend auto-submits` { selectedOptionIndex: -1 }` which the server scores as **incorrect** (0 points).
- The server independently validates `timeSpentMs` against `quizTimerSeconds` to prevent client-side timer manipulation.

#### 8.6.5 Leaderboard Logic

- **Data source:** `museum_quiz_scores` table holds one row per (user, museum) pair.
- **Personal best:** On quiz completion, the score is upserted. If `new_score > existing best_score`, the `best_score` is updated. Otherwise, only `quiz_count` is incremented and `last_played_at` is updated.
- **Displayed value:** The leaderboard always shows the user's **personal best score**, not their most recent attempt.
- **Redis sorted set:** Key `leaderboard:{museumId}`. Updated via `ZADD` on every quiz completion. Used for real-time rank reads. `all_time` reads come from Redis directly. `weekly` and `monthly` are pre-aggregated via TimescaleDB continuous aggregates.
- **Each museum has its own independent leaderboard.** There is no global cross-museum leaderboard.

#### 8.6.6 Question Bank Management

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/quiz/questions` | POST | `content_editor`+ (own museum) | Create a question in `draft` status. Payload: `{ museumId, artifactId (optional), questionText, options[], difficulty, points, explanation }`. |
| `/api/v1/quiz/questions` | GET | `content_editor`+ (own museum) | List questions filtered by museum, difficulty, and status. |
| `/api/v1/quiz/questions/:id` | PATCH | `content_editor`+ (own museum) | Update question. Only `museum_admin`+ can change `status` to `published`. |
| `/api/v1/quiz/questions/:id` | DELETE | `museum_admin`+ (own museum) | Soft-delete question. |

#### 8.6.7 Scoring Formula

Same formula as the Treasure Hunt (Section 8.5.8).

---

### 8.7 AI Assistant (RAG Chat)

#### 8.7.1 Overview

The AI Assistant provides a conversational, multi-language (Turkish + English) chat interface powered by a RAG (Retrieval-Augmented Generation) pipeline. It answers visitor questions about artifacts, provides historical context, and suggests visit routes. **Authentication IS required** (no guest access). The AI can be **disabled per museum** via `museums.settings.ai_config.isEnabled`.

#### 8.7.2 RAG Pipeline

On each user message:
1. **Embed the query:** Send the user's message to OpenAI `text-embedding-3-small` to get a 1536-dimensional vector.
2. **Retrieve context:** Run a pgvector cosine similarity search against the museum's artifact embeddings. Retrieve the **top-3** most relevant chunks (K=3).
3. **Construct the prompt:**
   - **System role:** Museum AI persona from `museums.settings.ai_config.personaName` and `systemPromptOverride`. Includes instruction to respond in the visitor's preferred language (from `users.preferences.language`).
   - **Context injection:** The top-3 retrieved artifact chunks are appended as context.
   - **Artifact focus:** If the chat session has `artifact_context_id` set (user is viewing a specific artifact), that artifact's full metadata is prepended to the context window.
   - **Conversation history:** The last N messages from `ai_messages` are included for continuity.
4. **Stream response:** Call the **Anthropic Claude API (claude-sonnet)** with streaming enabled. Forward each token over the WebSocket.
5. **Persist:** On stream completion, save the full assistant message to `ai_messages` with `tokens_used` for cost tracking.

#### 8.7.3 Endpoints

| Endpoint / Event | Type | Auth | Description |
|---|---|---|---|
| `POST /api/v1/ai/chat/sessions` | REST | `user`+ | Create a new chat session. Payload: `{ museumId, artifactContextId (optional) }`. Returns `sessionId`. |
| `GET /api/v1/ai/chat/sessions` | REST | `user`+ | List the user's chat sessions for a museum. |
| `GET /api/v1/ai/chat/sessions/:id/messages` | REST | Session owner | Message history with **cursor-based pagination** (default 30 messages, most recent first, infinite scroll up). |
| `/ws/ai` (connect) | WebSocket | `user`+ (token in `auth` handshake object, NOT in URL) | WebSocket connection for streaming. |
| `ai:send_message` | WS Event (client→server) | Session owner | Send a user message. Payload: `{ sessionId, content }`. |
| `ai:typing_start` | WS Event (server→client) | — | Emitted after RAG retrieval completes, before first LLM token. |
| `ai:token` | WS Event (server→client) | — | Each LLM token streamed individually. |
| `ai:typing_end` | WS Event (server→client) | — | Emitted after the full response is complete. Payload includes the final clean response string. |
| `ai:error` | WS Event (server→client) | — | Emitted on any error (rate limit, content violation, API failure). |

#### 8.7.4 Limits & Safety

| Parameter | Value | Configurability |
|---|---|---|
| Max conversation turns per session | 5 ⚙️ | Museum-wide via `museums.settings.limits.maxAiTurnsPerSession` |
| Rate limit | 3 requests/minute/user ⚙️ | Museum-wide via `museums.settings.limits.aiRateLimitPerMinute`. Enforced via Redis sliding window. |
| Content safety filter | **Hybrid** — strict keyword blocklist + LLM-based moderation (pre-check) | Platform-wide, not per-museum configurable. |
| Violation penalty | Silent block of the query + immediate termination of the active AI chat session. No warning shown — the session is ended and the user must start a new one. | Fixed behavior. |
| API failure fallback | The request is **queued for retry** (max 2 retries, exponential backoff). If all retries fail, return a standard error via `ai:error` event. The system does **NOT** auto-switch to GPT-4o-mini. | Fixed behavior. |
| Top-K context chunks (RAG) | 3 | Fixed — optimized for high relevance and minimal token usage. |
| Token usage tracking | Logged per message (`ai_messages.tokens_used`). Reported per-museum (for admins) and globally (for super_admins). | Read-only metric. |

#### 8.7.5 Suggested Questions

A **hybrid** system:
1. Admins can set pre-defined suggested questions per artifact via the admin panel (stored on the artifact record or a related table).
2. If no admin-defined questions exist for an artifact, the system **auto-generates** 3 suggested questions using the LLM based on the artifact's metadata.
3. Auto-generated questions are **cached** in Redis (per artifact, TTL 24 hours) to avoid repeated LLM calls.
4. Suggested questions are displayed as tappable chips below the chat input on the frontend.

#### 8.7.6 AI Disabled Per Museum

If `museums.settings.ai_config.isEnabled` is `false`:
- All AI-related UI elements are **hidden from the DOM** (not merely disabled — fully removed).
- API endpoints for that museum's AI return `403 Forbidden` with `errorCode: AI_MODULE_DISABLED`.
- Visitors see only standard, static exhibition content.

#### 8.7.7 Multi-Language AI Responses

The AI assistant responds in the visitor's preferred language as set in `users.preferences.language` (default: `"tr"` for Turkish).
- The system prompt explicitly instructs the LLM: "You must respond in {language}."
- Supported languages for v1.0: Turkish (`tr`) and English (`en`).
- The context chunks (artifact descriptions) are stored in their original language; the LLM translates its response accordingly.

---

### 8.8 Rewards & Badges

#### 8.8.1 Overview

Rewards are digital recognitions (badges, certificates, or discount codes) issued to visitors upon completing game objectives. Each reward is defined per museum by admins.

#### 8.8.2 Reward Types

| Type | Description |
|---|---|
| `badge` | A digital badge image (stored in S3) displayed in the user's profile gallery. |
| `certificate` | A digital certificate image. Static asset — not dynamically generated with the user's name in v1.0. |
| `discount_code` | A single-use, 8-character uppercase alphanumeric code (e.g., `A3F9KX2M`) redeemable at the museum ticket desk. |

#### 8.8.3 Rules

- A user can earn a specific badge **only once**. Duplicate issuance is prevented by a unique constraint on `(user_id, reward_id)` in the `user_rewards` table.
- Discount codes are **single-use**. Once verified via the verification endpoint, the code is marked as redeemed.
- Discount offerings vary by museum — museums can choose not to offer discounts.
- Discount code generation: The code is a randomly generated 8-character uppercase alphanumeric string (charset: `A-Z0-9`). Uniqueness is enforced at the database level.

#### 8.8.4 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/rewards` | POST | `content_editor`+ (own museum) | Create a reward definition. Payload: `{ museumId, name, type, assetUrl }`. |
| `/api/v1/rewards` | GET | `content_editor`+ (own museum) | List reward definitions for the museum. |
| `/api/v1/rewards/:id` | PATCH | `content_editor`+ (own museum) | Update a reward definition. |
| `/api/v1/rewards/:id` | DELETE | `museum_admin`+ (own museum) | Delete a reward definition. |
| `/api/v1/rewards/issue` | POST | Internal (called by GameModule / QuizModule) | Issue a reward to a user. Payload: `{ userId, rewardId, earnedVia }`. Emits `reward_earned` analytics event. |
| `/api/v1/users/me/rewards` | GET | `user`+ | List the calling user's earned rewards with asset URLs and issuance details. |
| `/api/v1/rewards/:id/verify` | POST | `content_editor`+ (own museum) | Verify a discount code. Payload: `{ code }`. Returns validity status and marks as redeemed if valid. |

#### 8.8.5 Issuance Triggers

| Trigger | Module | Condition |
|---|---|---|
| Treasure Hunt completion | GameModule | Player reaches `COMPLETED` state (final code verified). |
| Quiz score threshold | QuizModule | Player's score meets or exceeds a configurable threshold defined on the reward. |

---

### 8.9 Admin Panel

#### 8.9.1 Architecture

The admin panel is a separate React application within the same Turborepo monorepo (`apps/admin`). It shares the component library (`packages/ui`) with the visitor-facing app. Authentication uses the same JWT system with `RolesGuard` enforcing role-based access.

#### 8.9.2 Museum Admin Dashboard

**Route:** `/admin/museums/:id/dashboard`
**Auth:** `museum_admin` (own museum) or `super_admin`

The dashboard is a composite view combining data from multiple modules:

| Widget | Data Source | Description |
|---|---|---|
| KPI Cards | AnalyticsModule | Total visitors, total QR scans, quiz completions, AI queries — for the selected date range. Near real-time (60s lag). |
| Trend Charts | AnalyticsModule | Line/area charts (Recharts) showing daily trends for scans, quiz completions, and AI usage. Hourly batch-processed via TimescaleDB continuous aggregates. |
| Artifact Heatmap | AnalyticsModule | A ranked list/grid of artifacts colored by a **Weighted Composite Score (0–100)** that measures depth of engagement: **40%** Successful QR Scans, **30%** AI Queries related to the artifact, **20%** Page Views, **10%** Dwell Time (average time on artifact detail page). The heatmap reveals which artifacts visitors focus on most. |
| Recent Quiz Sessions | QuizModule | Table of the last 20 quiz sessions with scores and completion rates. |
| Active Game Sessions | GameModule | Count of currently active Treasure Hunt sessions. |
| Conversion Funnels | AnalyticsModule | Visual funnel charts for the 5 primary funnels (see Section 8.10.4). |
| User Segments | AnalyticsModule | Breakdown of users by behavioral segment (see Section 8.10.5). |

#### 8.9.3 System Admin Panel

**Route:** `/system/*`
**Auth:** `super_admin` only

| Screen | Description |
|---|---|
| Museum List | All museums with `is_active` toggle, creation date, user count, and usage stats. |
| Museum Detail | Drill down into any museum's dashboard (same as 8.9.2 but unrestricted). |
| User Management | Search all users across all museums. View/change roles. Ban accounts. |
| AI Message Log | Content moderation view — browse AI messages per museum, flag or dismiss. |
| System Analytics | Cross-museum KPIs: total platform users, total scans, AI token costs, per-museum breakdown. |
| Audit Log | System-wide audit trail of all admin actions (see Section 14.5). |

#### 8.9.4 AI Message Flagging

`[MVP-STUB]` — The "Flag" and "Dismiss" actions on AI messages are **required in the v1.0 UI and API**. The data model must support a `flag_status` ENUM (`unflagged`, `flagged`, `dismissed`) on `ai_messages`. The specific downstream business logic triggered by flagging (e.g., auto-suspend user, notify super_admin) will be finalized in a later design discussion before launch.

#### 8.9.5 Admin Data Tables

All admin list views (artifacts, questions, scenarios, users, sessions) use TanStack Table v8 with:
- Server-side pagination (offset-based for admin tables)
- Column sorting
- Text search / filtering
- Virtualized rendering for large datasets

#### 8.9.6 Data Export

- **Formats:** CSV (raw data) and PDF (formatted summary reports).
- **Scope:** Activity logs, artifact heatmaps, leaderboard data, and quiz performance.
- **Mechanism:** Export requests are processed asynchronously via a **Bull queue job**. The admin receives a download link (pre-signed S3 URL) when the job completes.
- **Privacy:** Exports never contain direct PII. Users are referenced by generic labels (e.g., "Visitor #4821").

---

### 8.10 Analytics & Reporting

#### 8.10.1 Event Ingestion

All user actions are tracked via an asynchronous Bull queue that writes records into the `analytics_events` TimescaleDB hypertable. Event tracking is **fire-and-forget** — failures do not block business logic.

**Event Registry:**

| Category | Events |
|---|---|
| Engagement | `app_open`, `museum_selected`, `artifact_viewed`, `artifact_dwell_time` |
| Gamification | `qr_scan_success`, `qr_scan_failure`, `game_session_started`, `game_session_completed`, `game_hint_used`, `game_clue_skipped` |
| Quiz | `quiz_session_started`, `quiz_session_completed`, `quiz_question_answered` |
| AI | `ai_query_sent`, `ai_response_received`, `ai_suggested_question_tapped`, `ai_thumbs_up`, `ai_thumbs_down` |
| Rewards | `reward_earned`, `reward_shared`, `discount_code_verified` |
| Auth | `user_registered`, `guest_session_started`, `guest_account_linked` |

#### 8.10.2 Reporting Latency

| Data Type | Latency | Method |
|---|---|---|
| KPI Cards (active users, today's scans) | Near real-time (~60s lag) | Direct query on hypertable with recent partition. |
| Trend Charts & Heatmaps | Hourly batch | TimescaleDB continuous aggregates, refreshed hourly. |
| Leaderboard (all_time) | Real-time | Redis sorted set. |
| Leaderboard (weekly/monthly) | Hourly batch | Pre-aggregated via TimescaleDB. |

#### 8.10.3 Artifact Heatmap Calculation

The heatmap uses a **Weighted Composite Score (0–100)** per artifact:

| Weight | Metric | Meaning |
|---|---|---|
| 40% | Successful QR Scans | Physical presence at the artifact. |
| 30% | AI Queries related to the artifact | Deep interest / curiosity. |
| 20% | Page Views (artifact detail) | Passive interest. |
| 10% | Dwell Time (average seconds on detail page) | Time investment. |

Score is normalized to 0–100 across all artifacts in the museum. Recalculated hourly.

#### 8.10.4 Conversion Funnels

Five primary funnels are tracked for drop-off analysis:

| # | Funnel | Stages |
|---|---|---|
| 1 | Visitor Activation | App Open → Museum Select → First QR Scan |
| 2 | Registration | Guest Session Start → Sign-up Prompt Shown → Registration Completed |
| 3 | Quiz Engagement | Quiz Start → First Answer → Quiz Complete |
| 4 | AI Adoption | Artifact View → First AI Query → Multi-turn Chat (≥3 messages) |
| 5 | Retention | First Visit → Week 1 Return → Week 4 Return |

#### 8.10.5 User Segmentation

Users are categorized nightly (via a scheduled Bull job) into four behavioral segments:

| Segment | Label (TR) | Criteria |
|---|---|---|
| Explorer | Kaşif | High QR scan and game completion activity. |
| Scholar | Bilgin | High quiz completion rate and accuracy. |
| Passive | Pasif | Registered but inactive (no events in the last 14 days). |
| Newcomer | Yeni Üye | Registered within the last 7 days. |

These segments are available as **admin filters** on user lists and analytics dashboards. Notification targeting based on segments is deferred to Phase 2.

#### 8.10.6 AI Performance Metrics

| Metric | Description | Method |
|---|---|---|
| Session Continuation Rate | % of AI sessions with ≥3 messages | Calculated from `ai_messages` count per session. |
| Suggested Question Tap Rate | % of suggested question chips tapped vs. displayed | `ai_suggested_question_tapped` events / `artifact_viewed` events. |
| Thumbs Up/Down | Explicit user feedback on AI responses | `ai_thumbs_up` / `ai_thumbs_down` events. |
| Token Cost | Input + output tokens × pricing constant (server-side) | Per-museum and global aggregation from `ai_messages.tokens_used`. |

#### 8.10.7 KVKK/GDPR Analytics Anonymization

A **three-tier strategy** ensures analytics compliance:

1. **Pseudonymization:** Analytics event `user_id` values are stored as **salted HMAC hashes**. They cannot be reversed to real User UUIDs without the master anonymization secret (stored in AWS Secrets Manager).
2. **Account Deletion:** On hard-delete (after 30-day grace), PII (name, email, chat history) is removed. Game/quiz stats are unlinked (`user_id = NULL`) to preserve aggregate analytics.
3. **Export Safety:** Admin CSV/PDF exports never contain direct PII. Users are referenced only by generic labels (e.g., "Visitor #4821").

#### 8.10.8 Analytics API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/analytics/:museumId/overview` | GET | `museum_admin`+ (own) | KPI summary for date range. Params: `from`, `to` (ISO dates). Returns JSON suitable for direct Recharts rendering. |
| `/api/v1/analytics/:museumId/heatmap` | GET | `museum_admin`+ (own) | Artifact heatmap data (composite scores). |
| `/api/v1/analytics/:museumId/funnels` | GET | `museum_admin`+ (own) | Conversion funnel data for all 5 funnels. |
| `/api/v1/analytics/:museumId/segments` | GET | `museum_admin`+ (own) | User segment breakdown. |
| `/api/v1/analytics/:museumId/ai-performance` | GET | `museum_admin`+ (own) | AI session metrics, token costs. |
| `/api/v1/analytics/system/overview` | GET | `super_admin` | Cross-museum platform stats. |
| `/api/v1/analytics/:museumId/export` | POST | `museum_admin`+ (own) | Trigger async export job. Payload: `{ format: "csv" | "pdf", reportType }`. Returns `{ jobId }`. |
| `/api/v1/analytics/export/:jobId` | GET | Export requester | Check export job status. Returns download URL when complete. |

---

### 8.11 Media Management

#### 8.11.1 Upload Architecture

The backend **never proxies file bytes**. All uploads use pre-signed S3/R2 URLs:

1. Client requests a pre-signed upload URL via `POST /api/v1/media/presign`.
2. Backend validates the intended file size and MIME type. Returns: `{ uploadUrl, cdnUrl, expiresIn }`.
3. Client uploads the file directly to S3 using the pre-signed URL (valid for 5 minutes).
4. After upload, a Bull job triggers the image optimization pipeline.

#### 8.11.2 File Size Limits

| Asset Type | Maximum Size |
|---|---|
| User Avatar | 2 MB |
| Artifact Image | 15 MB |
| Audio Guide | 50 MB |

Accepted image formats: JPEG, PNG, WebP. Accepted audio formats: MP3, AAC, OGG.

#### 8.11.3 Image Optimization Pipeline

On upload completion (triggered by a Bull queue job):
1. Convert to WebP format.
2. Generate three variants:
   - **Thumbnail:** 400px width
   - **Medium:** 1200px width
   - **Full resolution:** Original dimensions
3. Store all variants under the S3 key prefix: `museums/{museumId}/artifacts/{artifactId}/`.
4. Update the artifact's `media_urls` JSONB with all variant URLs.

#### 8.11.4 CDN

All media URLs are served via Cloudflare CDN with long `Cache-Control` headers (`max-age=31536000, immutable` for hashed asset keys).

#### 8.11.5 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/media/presign` | POST | `content_editor`+ | Request a pre-signed upload URL. Payload: `{ fileName, fileSize, mimeType, context }`. Context: `avatar`, `artifact_image`, `audio_guide`, `reward_asset`. |
| `/api/v1/media/:key` | DELETE | `museum_admin`+ (own museum) | Delete a media asset from S3 and remove CDN cache. |

---

### 8.12 Health & Monitoring

#### 8.12.1 Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health/live` | GET | None | Liveness probe. Returns `200 OK` if the process is running. Used by ECS for container health. |
| `/health/ready` | GET | None | Readiness probe. Checks PostgreSQL connectivity, Redis connectivity, and S3 reachability. Returns `200 OK` only if ALL dependencies are healthy. Prevents traffic routing to an unhealthy pod. |

Failure thresholds and timeouts are configurable via environment variables.

---

## 9. Non-Functional Requirements

### 9.1 Performance SLAs

| Metric | Target |
|---|---|
| QR Scan Validation (`POST /api/v1/qr/validate`) | p95 < **200ms** |
| Quiz Answer Submission (`POST /api/v1/quiz/sessions/:id/answer`) | p95 < **300ms** |
| AI Time-to-First-Token (TTFT) | < **1.5 seconds** |
| Time to Interactive (TTI) — mid-tier Android device on 4G | < **3.0 seconds** |
| Lighthouse Mobile Score | ≥ **90** |

### 9.2 Availability & Disaster Recovery

| Parameter | Target |
|---|---|
| Uptime SLA | **99.9%** (~8.76 hours downtime/year) |
| Recovery Point Objective (RPO) | **1 hour** |
| Recovery Time Objective (RTO) | **4 hours** |
| Database Backups | RDS Point-in-Time Recovery (5-minute granularity) + daily automated snapshots |
| Multi-AZ | Both RDS PostgreSQL and ElastiCache Redis run in **Multi-AZ** configuration |

### 9.3 Scalability

| Parameter | Target |
|---|---|
| Peak Concurrent Users | 500 (launch), scalable to 2,000+ |
| ECS Tasks | Auto-scaling range: **2 to 10 tasks** |
| Auto-scale Trigger | CPU utilization > 70% OR request count threshold |
| Load Test | k6 simulating 500 concurrent users on QR scan and quiz endpoints |

### 9.4 Browser & Device Support

| Platform | Minimum Version |
|---|---|
| iOS (Safari) | iOS 14+ / Safari 15+ |
| Android (Chrome) | Android 9+ / Chrome 100+ |
| Desktop Chrome | Chrome 100+ |
| Desktop Firefox | Firefox 100+ |
| Desktop Edge | Edge 100+ |

Camera API compatibility for QR scanning is validated against these minimum versions.

### 9.5 Network Requirements

| Tier | Minimum Network | Features Supported |
|---|---|---|
| Core (text & quiz) | 3G | Text content, quiz play, QR scan validation, leaderboard |
| Full (media & AI) | 4G | Media loading (images, audio), AI streaming chat |

### 9.6 Data Retention

| Data Type | Retention Policy |
|---|---|
| `analytics_events` | 12 months. Partitioned by `occurred_at` via TimescaleDB. Older data is dropped. |
| `ai_messages` | 7 days. A scheduled job hard-deletes messages older than 7 days. |
| Completed game sessions | Indefinitely (scores are important for lifetime analytics). |
| Completed quiz sessions | Indefinitely. |
| Old notifications (Phase 2) | 90 days (hard-delete). |
| Deleted user PII | Hard-deleted after 30-day grace period. |

### 9.7 Accessibility

- Target: **WCAG 2.1 Level AA** compliance.
- Color contrast ratios must meet AA standards.
- All interactive elements must be keyboard-navigable.
- ARIA labels on all non-text UI components.
- `users.preferences.accessibility` supports `reducedMotion` and `highContrast` flags — the frontend must honor these settings.

### 9.8 Internationalization (i18n)

- The UI supports **Turkish (tr)** and **English (en)** from day one via `react-i18next`.
- All user-facing strings are externalized into translation files.
- The user's language preference is stored in `users.preferences.language`.
- The AI assistant responds in the visitor's preferred language (see Section 8.7.7).

---

## 10. System Architecture

### 10.1 Architecture Pattern: Modular Monolith

The system is built as a **Modular Monolith** for Phase 1. Each module owns its controllers, services, repositories, DTOs, and unit tests. Modules communicate through well-defined internal interfaces (direct service injection within NestJS's DI container). There are NO inter-module HTTP calls.

The architecture is designed with **clear internal boundaries** so that individual modules can be extracted into independent microservices in Phase 2 without a full rewrite.

### 10.2 Module Inventory

| Module | Responsibility | Phase 2 Extraction Candidate |
|---|---|---|
| AuthModule | Registration, login, JWT issuance/refresh, OAuth2, password reset, guest tokens | No |
| UsersModule | Profile management, avatar, preferences, account deletion, role assignment | No |
| MuseumsModule | Museum CRUD, settings, multi-tenant isolation middleware | No |
| ArtifactsModule | Artifact metadata, media, embeddings, QR code linking | No |
| QRModule | QR code generation, signed URL validation, scan event logging | Yes (QR Engine) |
| GameModule | Treasure Hunt state machine, clue progression, answer evaluation, scoring | Yes (QR Engine) |
| QuizModule | Question bank, quiz sessions, scoring, leaderboard computation | No |
| AIModule | LLM prompt construction, RAG retrieval, streaming responses, chat history | Yes (AI Service) |
| RewardsModule | Digital reward issuance, discount code generation/verification | No |
| AnalyticsModule | Event ingestion, aggregation, dashboard metrics API, export jobs | Yes (Analytics Service) |
| AdminModule | Dashboard facade, system admin endpoints, content moderation | No |
| MediaModule | S3 pre-signed URL generation, image optimization pipeline | No |
| HealthModule | Liveness/readiness probes | No |

### 10.3 API Design Principles

| Principle | Detail |
|---|---|
| Base Path | All endpoints are versioned under `/api/v1/` |
| Resource Naming | RESTful: `/api/v1/{resource}` (plural nouns) |
| Pagination (public feeds) | Cursor-based (keyset pagination) for consistent ordering |
| Pagination (admin tables) | Offset-based for TanStack Table compatibility |
| Rate Limiting | 100 req/min public (unauthenticated); 1,000 req/min authenticated. Redis-backed sliding window. |
| WebSocket Namespaces | `/ws/game` for live game events; `/ws/ai` for streaming AI responses |
| API Documentation | OpenAPI (Swagger) auto-generated via NestJS decorators at `/api/docs` |

### 10.4 Error Envelope

Every error response follows a unified schema:

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

**Error Code Registry (by domain):**

| Domain | Error Codes |
|---|---|
| Auth | `AUTH_EMAIL_EXISTS`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_ACCOUNT_LOCKED`, `AUTH_RESET_TOKEN_INVALID`, `AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER` |
| Museum | `MUSEUM_NOT_FOUND`, `MUSEUM_INACTIVE` |
| QR | `QR_INVALID_SIGNATURE`, `QR_NOT_FOUND`, `QR_DEACTIVATED`, `QR_CLUE_MISMATCH` |
| Game | `GAME_SESSION_ACTIVE`, `GAME_SESSION_EXPIRED`, `GAME_SESSION_NOT_FOUND`, `GAME_MAX_ATTEMPTS_EXCEEDED`, `GAME_INVALID_FINAL_CODE` |
| Quiz | `QUIZ_SESSION_NOT_FOUND`, `QUIZ_TIMER_EXCEEDED`, `QUIZ_ALREADY_COMPLETED` |
| AI | `AI_RATE_LIMITED`, `AI_MODULE_DISABLED`, `AI_MAX_TURNS_REACHED`, `AI_CONTENT_VIOLATION`, `AI_SERVICE_UNAVAILABLE` |
| Media | `MEDIA_FILE_TOO_LARGE`, `MEDIA_INVALID_TYPE` |
| General | `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL_ERROR` |

The `requestId` field enables log correlation between frontend error reports and backend structured logs.

### 10.5 WebSocket Reconnection Strategy

- **Algorithm:** Exponential backoff with jitter.
- **Max Retries:** 5 attempts.
- **Backoff Schedule:** 1s, 2s, 4s, 8s, 16s (with ±500ms random jitter).
- **On `/ws/ai` disconnect mid-stream:** The partial AI response is displayed as-is. A connection error message is shown. The user must manually retry the prompt by resending their message.
- **On `/ws/game` disconnect:** The client reconnects and fetches the current session state via `GET /api/v1/game/sessions/:id` to resync.

---

## 11. Technology Stack

### 11.1 Frontend

| Layer | Technology | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | Component model, large ecosystem, PWA-ready |
| Mobile Wrapper | Capacitor.js (PWA + native shell) | One codebase for web + iOS + Android |
| State Management | Zustand + React Query | Lightweight global state (GameStore, QuizStore, ChatStore, UserStore); server-state caching |
| Routing | React Router v6 | Code-splitting, lazy loading |
| UI Components | shadcn/ui + Tailwind CSS | Unstyled, accessible, fully customizable |
| Animation | Framer Motion | Smooth game-feel transitions |
| QR Scanning | html5-qrcode | Browser Camera API, no native dependency |
| Forms | React Hook Form + Zod | Type-safe validation |
| i18n | react-i18next | Multi-language support (Turkish + English) |
| Build Tool | Vite | Fast HMR, optimized bundling |
| Charts | Recharts | Admin dashboard charting |
| Data Tables | TanStack Table v8 | Virtualized, sortable, filterable admin tables |
| PWA | Vite PWA Plugin | Manifest, install prompt, Service Worker for static-asset caching (app shell, core images) at launch. Full offline-first gameplay deferred to Phase 2. |

### 11.2 Backend

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | JavaScript across entire stack, non-blocking I/O |
| Framework | NestJS | Modular, decorator-based, DI container, OpenAPI generation |
| API Style | REST + WebSocket (Socket.io) | REST for CRUD; WebSocket for live AI chat and game events |
| Auth | JWT (access + refresh) + Passport.js | Stateless, scalable, social login ready |
| ORM | Prisma | Type-safe queries, migration tooling |
| Validation | class-validator + class-transformer | DTO-level validation |
| Task Scheduling | Bull (Redis-backed queues) | Embedding jobs, analytics ingestion, export generation, image optimization |
| File Storage | AWS S3 / Cloudflare R2 | QR images, media assets, export files |
| Email | Nodemailer + SendGrid | Password reset emails (sole v1.0 use case) |
| Logging | Winston + Pino | Structured JSON logs |

### 11.3 AI / LLM Integration

| Component | Technology | Notes |
|---|---|---|
| Primary LLM | Anthropic Claude API (claude-sonnet) | Artifact Q&A, contextual multi-language responses |
| Fallback / Cost Tier | OpenAI GPT-4o-mini | Available for Phase 2 cost optimization; NOT auto-switched in v1.0 |
| Embeddings | OpenAI text-embedding-3-small | Semantic artifact search (1536 dimensions) |
| Vector Store | pgvector (PostgreSQL extension) | Artifact embeddings stored alongside relational data |
| Prompt Management | LangChain.js | Chain management, memory, retrieval orchestration |
| RAG Pipeline | Custom chunking + pgvector similarity | Museum knowledge base retrieval (top-3 chunks) |

### 11.4 Database & Caching

| Layer | Technology | Rationale |
|---|---|---|
| Primary DB | PostgreSQL 16 | ACID, JSONB support, pgvector extension, pg_trgm extension |
| Cache / Sessions | Redis 7 | JWT blocklist, leaderboard sorted sets, game session cache, rate limiting |
| Search | pgvector (semantic) + pg_trgm (text) | No extra search service needed at this scale |
| Analytics Store | TimescaleDB extension | Time-series event data, continuous aggregates, on same PostgreSQL instance |
| Migrations | Prisma Migrate | Version-controlled, CI-friendly |

### 11.5 Monorepo Structure

The project uses a **Turborepo** monorepo:

```
/
├── apps/
│   ├── web/           # Visitor-facing PWA (React + Capacitor)
│   └── admin/         # Museum & system admin dashboards
├── packages/
│   ├── ui/            # Shared component library (shadcn/ui based)
│   ├── api-client/    # Auto-generated TypeScript client from OpenAPI spec
│   └── config/        # Shared ESLint, Tailwind, and TypeScript configs
├── prisma/            # Prisma schema and migrations
├── docker-compose.yml # Local dev (PostgreSQL + Redis)
└── turbo.json
```

---

## 12. Database Schema

All tables include `created_at` (TIMESTAMPTZ, DEFAULT NOW()), `updated_at` (TIMESTAMPTZ, auto-set on update), and `deleted_at` (TIMESTAMPTZ, nullable, for soft deletes) unless explicitly noted otherwise.

### 12.1 `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | B-Tree index |
| `password_hash` | VARCHAR(255) | Nullable | NULL for social-only (Google OAuth) accounts |
| `display_name` | VARCHAR(50) | NOT NULL | Sanitized for XSS on write |
| `avatar_url` | VARCHAR(500) | Nullable | S3 CDN URL |
| `role` | ENUM(`user`, `content_editor`, `museum_admin`, `super_admin`) | NOT NULL, DEFAULT `user` | |
| `museum_id` | UUID | FK → `museums.id`, Nullable | Set for `content_editor`, `museum_admin`. NULL for `user`, `super_admin`. |
| `total_points` | INTEGER | NOT NULL, DEFAULT 0 | Denormalized global XP total. Per-museum ranking uses `museum_quiz_scores`. |
| `preferences` | JSONB | NOT NULL, DEFAULT `'{}'` | See Section 12.1.1 for schema. |
| `date_of_birth` | DATE | NOT NULL | Collected at registration. Used for future age-gate validation (`[MVP-STUB]`). |
| `is_banned` | BOOLEAN | NOT NULL, DEFAULT false | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |
| `deleted_at` | TIMESTAMPTZ | Nullable | Soft-delete. 30-day grace period. |

#### 12.1.1 `users.preferences` JSONB Schema

```json
{
  "language": "tr",                          // "tr" | "en"
  "preferredDifficulty": "medium",           // "easy" | "medium" | "hard"
  "accessibility": {
    "reducedMotion": false,
    "highContrast": false
  }
}
```

### 12.2 `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `jti` | UUID | PK | JWT ID — unique identifier for this token |
| `user_id` | UUID | FK → `users.id`, NOT NULL | |
| `token_hash` | VARCHAR(64) | NOT NULL | SHA-256 hash of the raw refresh token |
| `device_hint` | VARCHAR(255) | Nullable | User-Agent string or device identifier |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 7 days from issuance |
| `is_revoked` | BOOLEAN | NOT NULL, DEFAULT false | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Constraint:** Only 1 active (non-revoked, non-expired) refresh token per user. On new token issuance, all previous tokens for the user are revoked.

### 12.3 `museums`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | VARCHAR(200) | NOT NULL | |
| `slug` | VARCHAR(200) | UNIQUE, NOT NULL | URL-friendly identifier |
| `description` | TEXT | | |
| `logo_url` | VARCHAR(500) | Nullable | |
| `address` | JSONB | NOT NULL | `{ street, city, country, lat, lng }` |
| `settings` | JSONB | NOT NULL, DEFAULT `'{}'` | See Section 12.3.1 for full schema. |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT **false** | Museums start inactive. `super_admin` must explicitly enable after setup. |

#### 12.3.1 `museums.settings` JSONB Schema

```json
{
  "theme": {
    "primaryColor": "#1E40AF",
    "secondaryColor": "#F59E0B",
    "logoUrl": "https://cdn.example.com/logo.png"
  },
  "ai_config": {
    "personaName": "Museum Guide",
    "systemPromptOverride": "You are a friendly museum guide specializing in...",
    "isEnabled": true
  },
  "modules": {
    "quizEnabled": true,
    "treasureHuntEnabled": true,
    "aiAssistantEnabled": true
  },
  "limits": {
    "maxAnswerAttemptsPerClue": 3,
    "hintsPerClue": 1,
    "hintRevealOnAttempt": 2,
    "gameSessionTimeoutHours": 4,
    "quizTimerSeconds": 30,
    "maxAiTurnsPerSession": 5,
    "aiRateLimitPerMinute": 3,
    "questionsPerQuizByDifficulty": {
      "easy": 10,
      "medium": 15,
      "hard": 20
    },
    "pointsPerCorrectByDifficulty": {
      "easy": 10,
      "medium": 20,
      "hard": 30
    },
    "gameClueTimerSeconds": 60,
    "timeBonusEnabled": true,
    "timeBonusMax": 10,
    "maxFinalCodeAttempts": 5
  }
}
```

> ⚙️ All values under `limits` are configurable defaults. They are seeded on museum creation and adjustable by `museum_admin` via `PATCH /api/v1/museums/:id`.

### 12.4 `artifacts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | Indexed (B-Tree) |
| `name` | VARCHAR(300) | NOT NULL | |
| `description` | TEXT | | |
| `historical_context` | TEXT | | |
| `period` | VARCHAR(100) | Nullable | e.g., "Late Bronze Age" |
| `media_urls` | JSONB | DEFAULT `'[]'` | Array of `{ url, type, variant }` objects |
| `audio_guide_url` | VARCHAR(500) | Nullable | Direct CDN URL to audio file |
| `audio_transcript` | TEXT | Nullable | Text transcript of the audio guide |
| `location_hint` | VARCHAR(300) | Nullable | e.g., "Room 3, East Wall" |
| `embedding` | vector(1536) | Nullable | pgvector column for RAG retrieval. IVFFlat index. |
| `metadata` | JSONB | DEFAULT `'{}'` | Dimensions, material, provenance, etc. |
| `suggested_questions` | JSONB | DEFAULT `'[]'` | Admin-defined AI suggested questions. Array of strings. |

**Indexes:**
- `idx_artifacts_museum_id` — B-Tree on `museum_id`
- `idx_artifacts_embedding` — IVFFlat (pgvector) for cosine similarity search
- `idx_artifacts_search` — GIN (pg_trgm) on `name`, `description` for text search

### 12.5 `qr_codes`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `artifact_id` | UUID | FK → `artifacts.id`, NOT NULL | |
| `code_hash` | VARCHAR(128) | UNIQUE, NOT NULL | HMAC-signed payload hash. B-Tree index for instant lookup. |
| `kid` | VARCHAR(50) | NOT NULL | Key ID identifying which HMAC secret was used. |
| `image_url` | VARCHAR(500) | NOT NULL | S3 URL of generated QR PNG |
| `scan_count` | INTEGER | NOT NULL, DEFAULT 0 | Denormalized counter |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | |

### 12.6 `game_scenarios`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `title` | VARCHAR(300) | NOT NULL | |
| `story_intro` | TEXT | NOT NULL | Narrative shown at game start |
| `difficulty` | ENUM(`easy`, `medium`, `hard`) | NOT NULL | |
| `status` | ENUM(`draft`, `published`) | NOT NULL, DEFAULT `draft` | Only `published` scenarios are visible to visitors. |
| `clues` | JSONB | NOT NULL, DEFAULT `'[]'` | See Section 12.6.1 |
| `final_code` | VARCHAR(50) | NOT NULL | The code players must enter after completing all clues |
| `reward_id` | UUID | FK → `rewards.id`, Nullable | Reward issued on completion |

#### 12.6.1 `game_scenarios.clues` JSONB Array Schema

Each element in the array:

```json
{
  "clueIndex": 0,
  "narrativeText": "Follow the path of the ancient pharaoh to the golden sarcophagus...",
  "locationHint": "Room 3, East Wall — near the large stone tablet",
  "artifactId": "uuid-of-artifact",
  "qrCodeId": "uuid-of-qr-code",
  "question": {
    "text": "What dynasty does this sarcophagus belong to?",
    "options": [
      { "text": "18th Dynasty", "isCorrect": true },
      { "text": "19th Dynasty", "isCorrect": false },
      { "text": "20th Dynasty", "isCorrect": false },
      { "text": "21st Dynasty", "isCorrect": false }
    ],
    "hintText": "Look at the cartouche engraved on the base of the sarcophagus."
  }
}
```

**Notes:**
- `clueIndex` determines the ordering. Must be sequential starting from 0.
- `qrCodeId` is auto-populated when the artifact's QR is generated.
- `question.options` must contain exactly one object with `isCorrect: true`.
- Point values are NOT stored per clue — they come from `museums.settings.limits.pointsPerCorrectByDifficulty[scenario.difficulty]`.

### 12.7 `game_sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, Nullable | NULL for guest sessions |
| `guest_token_jti` | VARCHAR(128) | Nullable | JTI from the guest JWT. Nullified when account is linked. |
| `scenario_id` | UUID | FK → `game_scenarios.id`, NOT NULL | |
| `state` | ENUM(`IDLE`, `CLUE_ACTIVE`, `QR_SCANNED`, `ANSWER_SUBMITTED`, `CORRECT`, `INCORRECT`, `FINAL_CODE`, `COMPLETED`, `EXPIRED`) | NOT NULL, DEFAULT `IDLE` | |
| `current_clue_index` | INTEGER | NOT NULL, DEFAULT 0 | |
| `score` | INTEGER | NOT NULL, DEFAULT 0 | |
| `attempts_on_current_clue` | INTEGER | NOT NULL, DEFAULT 0 | Resets on clue advance |
| `completed_at` | TIMESTAMPTZ | Nullable | |

**Indexes:**
- Composite index on `(user_id, state)` for "active session" lookups.

### 12.8 `quiz_questions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `artifact_id` | UUID | FK → `artifacts.id`, Nullable | Optional link to a specific artifact |
| `question_text` | TEXT | NOT NULL | |
| `options` | JSONB | NOT NULL | `[{ "text": string, "isCorrect": boolean }]` |
| `explanation` | TEXT | Nullable | Shown after answering |
| `difficulty` | ENUM(`easy`, `medium`, `hard`) | NOT NULL | |
| `status` | ENUM(`draft`, `published`) | NOT NULL, DEFAULT `draft` | Only `published` questions are selected for quiz sessions. |

### 12.9 `quiz_sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, Nullable | Nullable to support anonymization on account hard-delete (set to NULL). Auth required at session creation time. |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `difficulty` | ENUM(`easy`, `medium`, `hard`) | NOT NULL | |
| `total_score` | INTEGER | NOT NULL, DEFAULT 0 | |
| `questions_answered` | INTEGER | NOT NULL, DEFAULT 0 | |
| `correct_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `completed_at` | TIMESTAMPTZ | Nullable | |

### 12.10 `quiz_answers`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `session_id` | UUID | FK → `quiz_sessions.id` | Composite PK |
| `question_id` | UUID | FK → `quiz_questions.id` | Composite PK |
| `selected_option` | INTEGER | NOT NULL | Index of selected option (-1 for timeout) |
| `is_correct` | BOOLEAN | NOT NULL | |
| `points_earned` | INTEGER | NOT NULL | Base + time bonus |
| `time_spent_ms` | INTEGER | NOT NULL | Client-reported, server-validated |
| `answered_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### 12.11 `museum_quiz_scores`

Per-museum leaderboard table. Stores the personal best score for each user at each museum.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, Nullable | Nullable to support anonymization on account hard-delete. UNIQUE together with `museum_id` (partial unique index where `user_id IS NOT NULL`). |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | UNIQUE together with `user_id` |
| `best_score` | INTEGER | NOT NULL | Updated via UPSERT only if new score > existing |
| `quiz_count` | INTEGER | NOT NULL, DEFAULT 1 | Incremented on each quiz completion |
| `last_played_at` | TIMESTAMPTZ | NOT NULL | |

**Constraint:** UNIQUE on `(user_id, museum_id)`.

### 12.12 `ai_chat_sessions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, NOT NULL | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `artifact_context_id` | UUID | FK → `artifacts.id`, Nullable | If set, this artifact's full data is auto-injected into every prompt. |

### 12.13 `ai_messages`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `session_id` | UUID | FK → `ai_chat_sessions.id`, NOT NULL | |
| `role` | ENUM(`user`, `assistant`) | NOT NULL | |
| `content` | TEXT | NOT NULL | |
| `tokens_used` | INTEGER | NOT NULL, DEFAULT 0 | For cost tracking |
| `flag_status` | ENUM(`unflagged`, `flagged`, `dismissed`) | NOT NULL, DEFAULT `unflagged` | `[MVP-STUB]` — Flag/dismiss logic TBD. |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Retention:** Messages older than 7 days are hard-deleted by a scheduled job.

### 12.14 `rewards`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, NOT NULL | |
| `name` | VARCHAR(200) | NOT NULL | e.g., "Pharaoh Explorer Badge" |
| `type` | ENUM(`badge`, `certificate`, `discount_code`) | NOT NULL | |
| `asset_url` | VARCHAR(500) | Nullable | Digital badge/certificate image URL |
| `description` | TEXT | Nullable | |
| `trigger_type` | ENUM(`game_completion`, `quiz_threshold`) | NOT NULL | Defines when the reward is issued |
| `trigger_config` | JSONB | NOT NULL, DEFAULT `'{}'` | For `quiz_threshold`: `{ "minScore": 80, "difficulty": "medium" }`. For `game_completion`: `{}`. |
| `linked_scenario_id` | UUID | FK → `game_scenarios.id`, Nullable | Required when `trigger_type = game_completion`. Links reward to a specific scenario. |
| `discount_validity_days` | INTEGER | Nullable | Days until discount code expires after issuance. NULL = never expires. |

### 12.15 `user_rewards`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, NOT NULL | |
| `reward_id` | UUID | FK → `rewards.id`, NOT NULL | |
| `discount_code` | VARCHAR(8) | UNIQUE, Nullable | 8-char uppercase alphanumeric. Only set for `discount_code` type rewards. |
| `is_redeemed` | BOOLEAN | NOT NULL, DEFAULT false | For discount codes — set to true on verification. |
| `earned_via` | JSONB | NOT NULL | `{ "type": "treasure_hunt", "sessionId": "uuid" }` or `{ "type": "quiz", "sessionId": "uuid" }` |
| `expires_at` | TIMESTAMPTZ | Nullable | For discount codes: `issued_at + rewards.discount_validity_days`. NULL = never expires. |
| `issued_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Constraint:** UNIQUE on `(user_id, reward_id)` — prevents duplicate badge issuance.
**Discount Code Verification:** Must check `is_redeemed = false` AND (`expires_at IS NULL OR expires_at > NOW()`).

### 12.16 `analytics_events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `museum_id` | UUID | FK → `museums.id`, Nullable | Nullable for platform-level events |
| `user_id_hash` | VARCHAR(128) | Nullable | Salted HMAC hash of the user UUID. NOT a direct FK. For KVKK/GDPR compliance. |
| `event_type` | VARCHAR(100) | NOT NULL | e.g., `qr_scan_success`, `quiz_session_completed` |
| `payload` | JSONB | DEFAULT `'{}'` | Event-specific data |
| `occurred_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | TimescaleDB time column (auto-partitioned) |

**TimescaleDB:** This table is created as a hypertable partitioned by `occurred_at`. Continuous aggregates are defined for daily and weekly rollups.

**Retention:** 12 months. Older partitions are dropped automatically via TimescaleDB retention policy.

### 12.17 `audit_logs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `actor_id` | UUID | FK → `users.id`, NOT NULL | Who performed the action |
| `actor_role` | VARCHAR(50) | NOT NULL | Role at the time of the action |
| `action` | VARCHAR(100) | NOT NULL | e.g., `artifact.deleted`, `user.role_changed`, `museum.disabled` |
| `target_type` | VARCHAR(50) | NOT NULL | e.g., `artifact`, `user`, `museum` |
| `target_id` | UUID | NOT NULL | ID of the affected entity |
| `metadata` | JSONB | DEFAULT `'{}'` | Additional context (e.g., `{ "oldRole": "user", "newRole": "content_editor" }`) |
| `museum_id` | UUID | Nullable | NULL for system-wide actions |
| `ip_address` | INET | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Auditable Events:**
- `artifact.created`, `artifact.updated`, `artifact.deleted`
- `user.role_changed`, `user.banned`, `user.deleted`
- `museum.created`, `museum.updated`, `museum.disabled`, `museum.enabled`
- `game_scenario.published`, `game_scenario.deleted`
- `quiz_question.published`, `quiz_question.deleted`
- `reward.created`, `reward.deleted`
- `qr_code.deactivated`

### 12.18 Index Summary

| Table | Index | Type | Purpose |
|---|---|---|---|
| `users` | `email` | UNIQUE B-Tree | Login lookup |
| `artifacts` | `museum_id` | B-Tree | Tenant-scoped queries |
| `artifacts` | `embedding` | IVFFlat (pgvector) | RAG similarity search |
| `artifacts` | `name, description` | GIN (pg_trgm) | Fuzzy text search |
| `qr_codes` | `code_hash` | UNIQUE B-Tree | Instant scan validation |
| `game_sessions` | `(user_id, state)` | Composite B-Tree | Active session lookup |
| `quiz_answers` | `session_id` | B-Tree | Session answer retrieval |
| `museum_quiz_scores` | `(user_id, museum_id)` | UNIQUE | Leaderboard upsert |
| `analytics_events` | `occurred_at` | TimescaleDB hypertable | Time-series partitioning |
| `audit_logs` | `(museum_id, created_at)` | Composite B-Tree | Admin log filtering |
| `ai_messages` | `created_at` | B-Tree | Retention job cleanup |

---

## 13. API Contracts & Error Handling

### 13.1 Authentication Headers

- **Access Token:** Sent in the `Authorization: Bearer {token}` header.
- **Refresh Token:** Stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie named `refreshToken`.
- **Guest Token:** Sent in the `Authorization: Bearer {guestToken}` header (same format, different JWT type claim).
- **WebSocket Auth:** Tokens are passed in the Socket.io `auth` object during the handshake. Tokens must NEVER be sent in query parameters to avoid URL logging leaks.

### 13.2 Pagination Formats

**Cursor-based (public feeds):**
```json
{
  "data": [...],
  "cursor": "eyJpZCI6IjEyMyJ9",
  "hasMore": true
}
```

**Offset-based (admin tables):**
```json
{
  "data": [...],
  "total": 156,
  "page": 1,
  "limit": 20
}
```

### 13.3 Standard Success Envelope

```json
{
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-03-28T12:00:00.000Z"
}
```

---

## 14. Security & Compliance

### 14.1 Regulatory Compliance

The platform must comply with **KVKK (Turkish Personal Data Protection Law No. 6698)** and **GDPR (EU General Data Protection Regulation)**. This requires:

| Requirement | Implementation |
|---|---|
| Consent Flows | Cookie consent banner on first visit. Explicit consent checkbox at registration for data processing. |
| Right to Access | Users can request their data via `GET /api/v1/users/me` (profile) and `GET /api/v1/users/me/rewards` (rewards). |
| Right to Erasure | `DELETE /api/v1/users/me` triggers soft-delete → 30-day grace → hard-delete with full PII purge. |
| Right to Data Portability | A data export endpoint (`GET /api/v1/users/me/export`) returns the user's profile, quiz scores, game sessions, and rewards in JSON format. |
| Data Minimization | Guest sessions collect no PII. Analytics use pseudonymized IDs. |
| Privacy Policy | Must be accessible from the registration page and app footer. Content TBD by legal team. |
| Cookie Policy | Only essential cookies (refresh token, session) and analytics cookies (with consent) are used. |

### 14.2 Age Restrictions

`[MVP-STUB]` — Age restriction policies (COPPA for users under 13, GDPR parental consent for users under 16) are under legal review. The registration form must include a date-of-birth field prepared for validation. The exact age gate logic and parental consent mechanism will be finalized before launch.

### 14.3 Authentication Security

| Mechanism | Detail |
|---|---|
| Password Hashing | bcrypt with a cost factor of 12 |
| JWT Access Token | 15-minute expiry. Signed with RS256 (asymmetric). |
| JWT Refresh Token | 7-day expiry. Stored as SHA-256 hash in `refresh_tokens` table. Rotation enforced. |
| Device Limit | 1 active session per user. New login revokes previous session. |
| Token Blocklist | Redis set keyed by `jti`. TTL matches the token's remaining lifetime. |
| Account Lockout | 5 failed login attempts → 15-minute lockout (Redis counter with TTL). |
| 2FA | Not in scope for v1.0. Earmarked for Phase 2 (TOTP for admin roles). |

### 14.4 Input Sanitization & Injection Prevention

A **layered sanitization strategy** is enforced:

1. **DTO Validation (Layer 1):** `class-validator` decorators on all incoming DTOs enforce type, length, and format constraints. Malformed requests are rejected before reaching service logic.
2. **Server-Side Sanitization (Layer 2):** All user-supplied text fields (`display_name`, AI chat `content`, quiz answers) are passed through a sanitization library (e.g., `sanitize-html` or `DOMPurify` server-side equivalent) to strip any embedded HTML or script tags (XSS prevention).
3. **Parameterized Queries (Layer 3):** Prisma ORM exclusively uses parameterized queries. Raw SQL is prohibited. This prevents SQL injection by design.
4. **Frontend Auto-Escaping (Layer 4):** React's JSX rendering auto-escapes all interpolated strings. The use of `dangerouslySetInnerHTML` is prohibited in the codebase.

### 14.5 Admin Audit Log

All critical administrative actions are recorded in the `audit_logs` table (schema in Section 12.17). The log captures: who (`actor_id`, `actor_role`), what (`action`, `target_type`, `target_id`), when (`created_at`), from where (`ip_address`), and additional context (`metadata` JSONB).

Audit logs are **immutable** — no update or delete operations are permitted on this table except by the database retention policy (if one is defined in Phase 2).

### 14.6 CORS Policy

| Environment | Allowed Origins |
|---|---|
| Development | `http://localhost:3000`, `http://localhost:5173` (Vite dev server) |
| Production | `https://{production_domain}` (exact domain, no wildcards) |

All other origins are rejected. No wildcard (`*`) is ever used. Preflight requests are handled with appropriate `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`.

### 14.7 QR Code HMAC Security

- **Algorithm:** HMAC-SHA256
- **Payload:** `{museumId}:{artifactId}`
- **Secret Management:** Stored in AWS Secrets Manager. Referenced by `kid` (Key ID).
- **Key Versioning:** On rotation, the new secret is added alongside the old one. The backend maintains a buffer of the **2 most recent** secrets. The `kid` in the QR URL determines which secret to use for validation.
- **Physical QR Code Resilience:** Old QR codes in museums remain valid as long as their signing key is in the buffer. A rotation plan must ensure museums reprint QR codes before the old key is evicted from the buffer.

### 14.8 Rate Limiting

| Scope | Limit | Mechanism |
|---|---|---|
| Public (unauthenticated) | 100 req/min per IP | Redis sliding window |
| Authenticated | 1,000 req/min per user | Redis sliding window |
| AI Chat | 3 req/min per user ⚙️ | Redis sliding window (per museum config) |
| Login Attempts | 5 attempts / 15 min per account | Redis counter with TTL |

### 14.9 Additional Security Measures

| Measure | Detail |
|---|---|
| HTTPS | Enforced everywhere. HTTP redirects to HTTPS. |
| Helmet.js | HTTP security headers (X-Frame-Options, X-Content-Type-Options, CSP, etc.) |
| Dependency Scanning | `npm audit` in CI pipeline. Dependabot alerts enabled. |
| OWASP Top 10 | Security audit planned in Sprint 8 (see sprint backlog). |
| Secrets | All keys/credentials in AWS Secrets Manager. No `.env` files in production. No secrets in Git. |

---

## 15. Infrastructure & Deployment

### 15.1 Cloud Provider & Region

| Parameter | Value |
|---|---|
| Provider | AWS |
| Region | `eu-central-1` (Frankfurt) — chosen for KVKK/GDPR data residency compliance |
| IaC Tool | Terraform |

### 15.2 Compute

| Component | Service | Configuration |
|---|---|---|
| Application | AWS ECS Fargate (Serverless containers) | Multi-stage Dockerfile. Min 2, max 10 tasks. |
| Auto-scaling | ECS Service Auto Scaling | Trigger: CPU > 70% OR request count threshold. |
| Container Registry | AWS ECR | Stores Docker images. Scanned for vulnerabilities. |

### 15.3 Data Stores

| Store | Service | Configuration |
|---|---|---|
| PostgreSQL 16 | AWS RDS | Multi-AZ. Extensions: pgvector, pg_trgm, TimescaleDB. Point-in-Time Recovery (5-min granularity). Daily snapshots. |
| Redis 7 | AWS ElastiCache | Multi-AZ. Used for: JWT blocklist, game session cache, leaderboard sorted sets, rate limiting, Bull queues. |
| Object Storage | AWS S3 / Cloudflare R2 | QR images, media assets, export files. Lifecycle rules for cost optimization. |

### 15.4 Networking

| Component | Service |
|---|---|
| CDN / WAF / DDoS Protection | Cloudflare |
| Load Balancer | AWS ALB (Application Load Balancer) |
| SSL/TLS Certificates | AWS Certificate Manager (ACM) + Cloudflare SSL |
| DNS | Cloudflare DNS |

### 15.5 CI/CD Pipeline

| Stage | Tool | Trigger |
|---|---|---|
| Lint + Type-check | GitHub Actions | On every PR |
| Unit Tests | GitHub Actions | On every PR |
| Build | GitHub Actions | On merge to `main` |
| Deploy | AWS CodeDeploy (Blue/Green) | On merge to `main` |
| Strategy | Blue/Green deployment via ECS | Zero-downtime deploys |

### 15.6 Monitoring & Observability

| Concern | Tool |
|---|---|
| Error Tracking | Sentry (frontend + backend) |
| Metrics & Dashboards | CloudWatch + Grafana |
| Structured Logging | Winston + Pino (JSON format) → CloudWatch Logs |
| Alerting | CloudWatch Alarms → SNS → team notifications |

**Key Grafana Dashboard Panels:**
- API latency (p50, p95, p99) per endpoint
- Error rate (4xx, 5xx) per endpoint
- Database connection pool utilization
- Redis memory usage and hit rate
- ECS task count and CPU/memory utilization
- AI token cost per day

### 15.7 Secrets Management

All secrets, API keys, and credentials are stored in **AWS Secrets Manager**. No `.env` files are used in production. Application containers retrieve secrets on startup via the ECS task execution role.

---

## 16. Explicitly Out of Scope (v1.0)

The following features, integrations, and capabilities are **NOT included in v1.0** and must not be built, stubbed, or scaffolded unless marked as `[MVP-STUB]` elsewhere in this document.

| Item | Phase |
|---|---|
| Donation / payment processing integration | Phase 2+ |
| NFT / digital collectible ownership (badges are in scope; blockchain-backed ownership is not) | Phase 2+ |
| Multiplayer / cooperative treasure hunts | Phase 2+ |
| WebXR / AR artifact overlays | Phase 2+ |
| Museum white-label SDK / public API for partner self-onboarding | Phase 2+ |
| App Store / Play Store native app submission (Capacitor shell build exists but store submission is deferred) | Phase 2+ |
| Apple ID social login | Phase 2+ |
| In-app purchases of any kind (hints, skips, cosmetics) | Phase 2+ |
| Interactive floor-plan map navigation (the text `location_hint` is the sole wayfinding mechanism in v1.0) | Phase 2+ |
| Notification system (email, push, in-app notifications — except password reset email which is auth-critical) | Phase 2+ |
| Automated weekly email recaps | Phase 2+ |
| Notification broadcast targeting | Phase 2+ |
| Push notification infrastructure (Web Push API, service worker push, `push_subscription` field) | Phase 2+ |
| Full offline-first gameplay / Background sync | Phase 2+ |
| Billing system / SaaS subscription management UI | Phase 2+ |
| Row-Level Security (RLS) in PostgreSQL | Phase 2 (hardening) |
| 2FA / MFA for admin roles | Phase 2 |
| PostGIS geospatial queries for museum discovery | Phase 2 (client-side Haversine in v1.0) |
| Microservice extraction (AI, QR Engine, Analytics, Notification services) | Phase 2+ |

---

## 17. Future Roadmap (Phase 2+)

| Feature | Description |
|---|---|
| Donation Integration | In-app giving linked to specific archaeological projects. |
| Digital Collectibles | NFT-lite ownership of discovered artifact badges. |
| Multiplayer Treasure Hunts | Cooperative or competitive group sessions. |
| AR Mode | Artifact overlays using WebXR when near a QR code. |
| Museum API / SDK | White-label SDK for partner museums to self-onboard. |
| Full Offline-First Mode | Complete Treasure Hunt playable without connectivity after initial sync. |
| Microservice Extraction | AI, QR Engine, Analytics, and Notification services spun out for independent scaling. |
| Native Mobile Apps | Capacitor shell submitted to App Store and Play Store. |
| Advanced AI Features | Multi-language AI personas, dynamic route suggestions with map integration. |
| Notification System | Full email + push + in-app notifications with broadcast targeting and segmentation. |
| Billing & Subscription | Self-service museum onboarding with Stripe-based billing. |
| 2FA for Admins | TOTP-based two-factor authentication for `museum_admin` and `super_admin`. |
| PostgreSQL RLS | Database-level multi-tenant isolation as a defense-in-depth layer. |

---

## 18. Glossary

| Term | Definition |
|---|---|
| **KVKK** | Kişisel Verilerin Korunması Kanunu — Turkish Personal Data Protection Law (No. 6698). |
| **GDPR** | General Data Protection Regulation — EU data privacy law. |
| **RAG** | Retrieval-Augmented Generation — an AI technique where relevant context is retrieved from a knowledge base and injected into the LLM prompt. |
| **pgvector** | PostgreSQL extension for vector similarity search. Used for artifact embeddings. |
| **pg_trgm** | PostgreSQL extension for trigram-based text similarity search. Used for fuzzy artifact search. |
| **TimescaleDB** | PostgreSQL extension for time-series data. Used for analytics event storage. |
| **Bull** | A Node.js library for Redis-backed job queues. Used for async tasks (embedding, export, image processing). |
| **HMAC-SHA256** | Hash-based Message Authentication Code using SHA-256. Used for signing QR code payloads. |
| **JTI** | JWT ID — a unique identifier claim within a JSON Web Token, used for token revocation tracking. |
| **kid** | Key ID — identifier for which cryptographic key was used to sign a token or payload. Used in QR code key versioning. |
| **TTI** | Time to Interactive — the time it takes for a web page to become fully interactive. |
| **TTFT** | Time to First Token — the latency before the first token of an AI streaming response arrives. |
| **PWA** | Progressive Web App — a web application that can be installed on a device and provides app-like experiences. |
| **SDD** | Spec-Driven Development — a methodology where a detailed specification is the authoritative source of truth for implementation. |
| ⚙️ | **Configurable Default** — a value that ships as the factory default and must be modifiable by museum administrators. |
| `[MVP-STUB]` | A feature that is required at the API/data model level for v1.0 but whose detailed business logic will be finalized before launch. |

---

*End of Document*
