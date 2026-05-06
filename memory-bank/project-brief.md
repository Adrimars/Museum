# MuseumQuest — Project Brief

**Version:** 1.0
**Last Updated:** 2026-03-28
**Source:** PRD v1.0

---

## Product Overview

MuseumQuest is a mobile-first, gamified web application that transforms traditional museum visits into interactive discovery experiences. Visitors engage through **Treasure Hunt** adventures, competitive **Quizzes**, and an **AI-powered artifact assistant** — all accessible by scanning QR codes positioned beside exhibits.

The platform is a **multi-tenant SaaS** product serving three audiences:

| Audience | Role |
|---|---|
| Museum Visitors | Immersive, game-driven engagement with exhibits |
| Museum Administrators | Content management, gamification scenarios, engagement analytics |
| Platform Operators (MuseumQuest Team) | Multi-tenant infrastructure oversight, museum onboarding |

---

## Vision

> Transform passive museum visits into active, game-driven discovery experiences that increase visitor dwell time, repeat visits, and interest in cultural heritage.

---

## Core Objectives (v1.0)

| # | Objective |
|---|---|
| O-1 | Convert passive visits into active, game-driven discovery via Treasure Hunts, Quizzes, and AI chat |
| O-2 | Increase dwell time, repeat visits, and archaeological interest through gamification (points, badges, leaderboards) |
| O-3 | Provide real-time, multi-language (Turkish + English) AI assistance for artifact exploration and route suggestions |
| O-4 | Supply museum admins with engagement analytics, content management tools, and artifact heatmaps |
| O-5 | Build a scalable, multi-tenant SaaS foundation ready for Phase 2 (donations, digital ownership, multiplayer) |

---

## Target Audience & Personas

### Elif — The Curious Explorer (Authenticated Visitor)
- **Age:** 22–35, university student or young professional
- **Motivation:** Gamification, competition, earning badges, sharing achievements
- **Flow:** Register → Select museum → Start Treasure Hunt → Scan QR → Answer questions → Earn badge → Share

### Mehmet — The Walk-in Tourist (Guest / Anonymous)
- **Age:** 30–55, domestic or international tourist
- **Motivation:** Curiosity after seeing a QR code sign; no commitment to registration
- **Flow:** Scan QR → Auto guest token → Play Treasure Hunt → Prompted to register to save progress

### Dr. Ayşe — The Digital Curator (Museum Admin)
- **Age:** 35–50, curator or marketing/engagement manager
- **Motivation:** Increase engagement metrics, understand which exhibits attract attention
- **Flow:** Admin Panel → View KPIs → Create artifacts → Build scenarios → Create quizzes → View heatmaps → Export CSV

### Can — The Museum Assistant (Content Editor)
- **Age:** 25–35, museum staff, intern, or volunteer
- **Motivation:** Keep content fresh without full admin privileges
- **Flow:** Create artifacts → Upload images → Write quiz questions → Draft scenario clues → Submit for publish

### Kerem — The Platform Operator (Super Admin)
- **Age:** 28–40, MuseumQuest internal team (engineering/ops)
- **Motivation:** Platform stability, efficient onboarding, AI cost control, cross-museum visibility
- **Flow:** Create museum → Create museum_admin → Enable museum → Monitor analytics → Review flagged AI → Disable museum if needed

---

## Monetization Model

| Component | Description |
|---|---|
| Model | Monthly SaaS subscription per museum |
| Installation Fee | One-time onboarding fee (amount TBD — not blocking dev) |
| Monthly Fee | Recurring for platform access, AI usage, support (amount TBD) |
| Billing System | Not in scope for v1.0 — `is_active` toggle managed by super_admin |
| Visitor Cost | **Free.** Visitors never pay. |

---

## Launch Scope

| Parameter | Value |
|---|---|
| Release Type | MVP (v1.0) — first functional version |
| Timeline | 8 sprints × 2 weeks = 16 weeks (guideline) |
| Target Museums | 5 |
| Target Users | 10,000 registered |
| Peak Concurrent | 500 users |
| Beta | No planned beta; goal is a complete v1.0 |

---

## Success Measurement

Platform adoption (museums onboarded, registered users), engagement (QR scans, game completions, AI query volume), and retention (repeat visit rate).

Specific numeric KPIs are intentionally deferred. Analytics infrastructure captures all data needed for post-launch KPI definition.

---

## Regulatory Context

| Regulation | Scope |
|---|---|
| KVKK | Turkish Personal Data Protection Law (No. 6698) — primary |
| GDPR | EU General Data Protection Regulation — overlapping |
| Data Residency | AWS `eu-central-1` (Frankfurt) exclusively |
| Guest Privacy | Zero PII for anonymous sessions |
| Analytics | Pseudonymized via salted HMAC hashes |
| Right to Erasure | 30-day soft-delete → hard-delete with full PII purge |

---

## Out of Scope (v1.0)

These features are **NOT** built, stubbed, or scaffolded unless marked `[MVP-STUB]`:

- Donation / payment processing
- NFT / digital collectible ownership
- Multiplayer / cooperative treasure hunts
- WebXR / AR artifact overlays
- Museum white-label SDK / public API
- App Store / Play Store submission
- Apple ID social login
- In-app purchases
- Interactive floor-plan map
- Notification system (email, push, in-app — except auth password reset)
- Offline mode / service worker caching
- Billing system / subscription management UI
- Row-Level Security (RLS) in PostgreSQL
- 2FA / MFA for admin roles
- Microservice extraction

---

## Key References

| Document | Purpose |
|---|---|
| [PRD.md](../PRD.md) | Full product requirements — the authoritative source of truth |
| [constitution.md](constitution.md) | Non-negotiable development principles and governance |
| [agents.md](agents.md) | AI coding assistant roles for development |
| [architecture.md](architecture.md) | System design, tech stack, data flow |
| [plan.md](plan.md) | Sprint plan, milestones, task breakdown |
| [progress.md](progress.md) | Current status, completed work, blockers |
| [active-decisions.md](active-decisions.md) | Architectural Decision Records |
| [api-specs.md](api-specs.md) | Endpoint routes, schemas, error codes |
| [database.md](database.md) | Table structures, ER schemas, indexes |

---

*End of project-brief.md*
