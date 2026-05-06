# UC-AUTH — Authentication & Account Management

---

## Registration

### UC-R01: Register with Email
**Actor:** Visitor  
**Precondition:** Visitor has no existing account.  
**Main Flow:**
1. Visitor provides email, password, display name, and date of birth.
2. System validates all fields and confirms email uniqueness.
3. System creates the account and issues access + refresh tokens.
4. Visitor is authenticated and redirected to the home screen.
**Exceptions:**
- Validation fails → registration is rejected with field-specific errors.

---

### UC-R02: Register with Google OAuth
**Actor:** Visitor  
**Precondition:** Visitor has a Google account and no existing MuseumQuest account.  
**Main Flow:**
1. Visitor initiates Google sign-in.
2. System redirects to Google consent screen.
3. Google returns profile data; system creates a new account.
4. Visitor is authenticated and redirected to the home screen.
**Exceptions:**
- Google consent denied → registration is cancelled.
- Google email matches an existing email/password account → `409 AUTH_EMAIL_EXISTS_DIFFERENT_PROVIDER`. Accounts are NOT auto-merged.

---

### UC-R03: Register with Duplicate Email
**Actor:** Visitor  
**Precondition:** An account with the same email already exists.  
**Main Flow:**
1. Visitor submits registration with an existing email.
2. System detects the duplicate.
3. Registration is rejected.
**Exceptions:**
- Existing account uses a different provider (Google vs email) → specific conflict error.

---

### UC-R04: Register with Invalid Fields
**Actor:** Visitor  
**Precondition:** None.  
**Main Flow:**
1. Visitor submits registration with invalid data (weak password, malformed email, etc.).
2. System validates each field against business rules.
3. Registration is rejected with details on which fields are invalid.
**Exceptions:**
- XSS content in display name → input is sanitized/rejected.

---

### UC-R05: Bot Registration Abuse
**Actor:** Malicious Bot  
**Precondition:** Bot targets the registration endpoint at scale.  
**Main Flow:**
1. Bot sends high-volume registration requests.
2. System rate-limiter detects abnormal request frequency per IP.
3. Further requests from the source are throttled.
**Exceptions:**
- Distributed IPs bypass rate limit → platform monitoring triggers alerts.

---

## Login

### UC-L01: Login with Email and Password
**Actor:** Registered User  
**Precondition:** User has a valid account.  
**Main Flow:**
1. User provides email and password.
2. System validates credentials.
3. System issues access + refresh tokens (previous refresh token is revoked).
4. User is authenticated.
**Exceptions:**
- Account is soft-deleted → system shows deletion notice with cancel option.

---

### UC-L02: Login with Invalid Credentials
**Actor:** Registered User  
**Precondition:** User provides wrong email or password.  
**Main Flow:**
1. User submits incorrect credentials.
2. System increments the failed attempt counter.
3. Login is rejected with a generic error (no field-specific hints).
**Exceptions:**
- None.

---

### UC-L03: Account Lockout After Repeated Failures
**Actor:** Registered User  
**Precondition:** User has failed login 5 consecutive times within 15 minutes.  
**Main Flow:**
1. User submits a 6th login attempt.
2. System detects lockout threshold exceeded.
3. Login is rejected; account is locked for 15 minutes.
4. After lockout, counter resets and user can retry.
**Exceptions:**
- None.

---

### UC-L04: Brute-Force Attack on Login
**Actor:** Attacker  
**Precondition:** Attacker targets multiple accounts with credential-stuffing.  
**Main Flow:**
1. Attacker sends high-volume login attempts across multiple accounts.
2. Per-account lockout triggers after 5 failures each.
3. IP-level rate limiting throttles the source.
**Exceptions:**
- Distributed attack → platform monitoring triggers alerts.

---

### UC-L05: Login with Banned Account
**Actor:** Banned User  
**Precondition:** User's account has been banned by an admin (`is_banned = true`).  
**Main Flow:**
1. User submits valid credentials.
2. System authenticates the credentials but detects the ban flag.
3. Login is rejected with `403 Forbidden` and `errorCode: AUTH_ACCOUNT_BANNED`.
**Exceptions:**
- None.

---

### UC-L06: Staff Login with Disabled Museum
**Actor:** Museum Admin / Content Editor  
**Precondition:** Staff member's museum has been deactivated.  
**Main Flow:**
1. Staff member logs in with valid credentials.
2. System authenticates successfully (admin access preserved).
3. Staff can view historical data but visitor-facing features are blocked.
**Exceptions:**
- None.

---

## Session & Token Management

### UC-S01: Refresh Access Token
**Actor:** Authenticated User  
**Precondition:** User has a valid, non-revoked refresh token.  
**Main Flow:**
1. Client detects access token has expired.
2. Client sends the refresh token (via secure cookie).
3. System validates and issues a new access + refresh token pair.
4. Old refresh token is immediately revoked (token rotation).
**Exceptions:**
- Refresh token expired or revoked → user must re-login.

---

### UC-S02: Logout
**Actor:** Authenticated User  
**Precondition:** User is logged in.  
**Main Flow:**
1. User initiates logout.
2. System revokes the refresh token and clears the session cookie.
3. User is returned to the public landing state.
**Exceptions:**
- None.

---

### UC-S03: Access with Expired Token
**Actor:** Authenticated User  
**Precondition:** User's access token has expired.  
**Main Flow:**
1. User makes a request with an expired access token.
2. System rejects the request.
3. Client triggers the token refresh flow (UC-S01).
**Exceptions:**
- Refresh token also expired → user must re-login.

---

### UC-S04: Stolen Refresh Token Detected
**Actor:** System  
**Precondition:** An already-revoked refresh token is presented for refresh.  
**Main Flow:**
1. A request arrives with a previously rotated (revoked) refresh token.
2. System detects reuse of a revoked token (potential theft).
3. All refresh tokens for the affected user are revoked.
4. User is forced to re-login on all devices.
**Exceptions:**
- None.

---

### UC-S05: Device Limit Enforcement
**Actor:** Authenticated User  
**Precondition:** User logs in from a new device while a session is active elsewhere.  
**Main Flow:**
1. User logs in on a second device.
2. System issues a new refresh token for the new device.
3. The previous device's refresh token is revoked.
4. Previous device must re-login on next refresh attempt.
**Exceptions:**
- None.

---

## Password Reset

### UC-P01: Request Password Reset
**Actor:** Registered User  
**Precondition:** User has an email-based account.  
**Main Flow:**
1. User requests a password reset by providing their email.
2. System generates a single-use reset token (15-minute expiry).
3. System sends a reset link to the email address.
4. System returns a success response regardless of email existence.
**Exceptions:**
- None (consistent response prevents email enumeration).

---

### UC-P02: Execute Password Reset
**Actor:** Registered User  
**Precondition:** User has received a valid reset link.  
**Main Flow:**
1. User clicks the reset link and provides a new password.
2. System validates the token and new password strength.
3. Password is updated; all existing sessions are revoked.
4. User must log in with the new password.
**Exceptions:**
- New password does not meet strength requirements → reset rejected.

---

### UC-P03: Expired or Invalid Reset Token
**Actor:** Registered User  
**Precondition:** Reset token has expired (>15 min) or was already used.  
**Main Flow:**
1. User clicks an old or already-used reset link.
2. System validates the token and finds it invalid.
3. Reset is rejected; user must request a new link.
**Exceptions:**
- None.

---

### UC-P04: Email Enumeration Prevention
**Actor:** Attacker  
**Precondition:** Attacker probes the reset endpoint with various emails.  
**Main Flow:**
1. Attacker submits password reset requests for random emails.
2. System always returns the same success response regardless of email existence.
3. No information about valid accounts is leaked.
**Exceptions:**
- Rate limiting throttles excessive requests from a single source.

---

### UC-P05: Password Reset for OAuth-Only Account
**Actor:** OAuth-Registered User  
**Precondition:** User registered via Google OAuth and has `password_hash = null`.  
**Main Flow:**
1. User requests a password reset by providing their email.
2. System detects the account has no password (OAuth-only).
3. System returns the same generic `200 OK` response (no information leak).
4. No reset email is sent.
**Exceptions:**
- None (consistent response prevents account type enumeration).

---

## Guest Access

### UC-G01: Obtain Guest Token
**Actor:** Anonymous Visitor  
**Precondition:** Visitor is not logged in and wants to play a Treasure Hunt.  
**Main Flow:**
1. Visitor requests to start a Treasure Hunt without registering.
2. System issues a session-scoped guest token (no PII collected).
3. Visitor can proceed to play the game anonymously.
**Exceptions:**
- None.

---

### UC-G02: Link Guest Session to New Account
**Actor:** Anonymous Visitor  
**Precondition:** Visitor has an active guest game session.  
**Main Flow:**
1. Visitor completes or is mid-way through a Treasure Hunt as a guest.
2. System prompts the visitor to register to save progress.
3. Visitor registers a new account.
4. Game session and all progress are transferred to the new account.
**Exceptions:**
- Guest token expired → session data is lost; user starts fresh.

---

### UC-G03: Link Guest Session to Existing Account
**Actor:** Anonymous Visitor  
**Precondition:** Visitor has an active guest session and an existing account.  
**Main Flow:**
1. Visitor logs into their existing account during or after a guest session.
2. System links the guest game session to the authenticated account.
3. All game progress is preserved under the existing account.
**Exceptions:**
- None.

---

### UC-G04: Guest Attempts Restricted Feature
**Actor:** Guest  
**Precondition:** Visitor holds a guest token only.  
**Main Flow:**
1. Guest attempts to access a feature requiring authentication (Quiz, AI, Rewards).
2. System denies access.
3. Guest is prompted to register or log in.
**Exceptions:**
- None.

---

### UC-G05: Guest Token Endpoint Flooding
**Actor:** Malicious Bot  
**Precondition:** Bot targets `POST /api/v1/game/guest-token` at scale.  
**Main Flow:**
1. Bot sends high-volume guest token requests (no auth required).
2. System rate-limiter detects abnormal request frequency per IP.
3. Further requests from the source are throttled.
**Exceptions:**
- Distributed IPs bypass rate limit → platform monitoring triggers alerts.

---

### UC-G06: Link Guest Session When Target Account Has Active Session
**Actor:** Anonymous Visitor  
**Precondition:** Visitor has a guest game session and the target account already has a separate active game session.  
**Main Flow:**
1. Visitor registers or logs in to link their guest session.
2. System detects the target account already has an active game session.
3. The guest session is linked but the existing active session takes priority (only one active session per user constraint applies).
4. The linked guest session is marked as `EXPIRED` or completed as-is.
**Exceptions:**
- None.

---

### UC-G07: Google OAuth Re-Login (Existing Account)
**Actor:** Returning Google OAuth User  
**Precondition:** User previously registered via Google OAuth.  
**Main Flow:**
1. User initiates Google sign-in.
2. Google returns profile data; system matches the email to an existing OAuth account.
3. System treats this as a login (not a new registration).
4. Access + refresh tokens are issued; previous refresh token is revoked.
**Exceptions:**
- None.

---

## Account Management

### UC-A01: View Own Profile
**Actor:** Authenticated User  
**Precondition:** User is logged in.  
**Main Flow:**
1. User navigates to their profile.
2. System displays profile data, preferences, role, and total points.
**Exceptions:**
- None.

---

### UC-A02: Update Profile
**Actor:** Authenticated User  
**Precondition:** User is logged in.  
**Main Flow:**
1. User edits display name, language preference, or avatar.
2. System validates changes (name length, avatar size/format).
3. Profile is updated.
**Exceptions:**
- Avatar exceeds 2 MB or unsupported format → upload rejected.
- Display name contains XSS content → input sanitized/rejected.

---

### UC-A03: Request Account Deletion
**Actor:** Authenticated User  
**Precondition:** User is logged in.  
**Main Flow:**
1. User requests account deletion.
2. System soft-deletes the account (marks deletion date).
3. A 30-day grace period begins; user can still log in.
**Exceptions:**
- None.

---

### UC-A04: Cancel Account Deletion
**Actor:** Authenticated User  
**Precondition:** Account is soft-deleted and within the 30-day grace period.  
**Main Flow:**
1. User logs in and sees the scheduled deletion notice.
2. User chooses to cancel the deletion.
3. System restores the account to active status.
**Exceptions:**
- Grace period passed → account already hard-deleted; cancellation impossible.

---

### UC-A05: Hard-Delete PII After Grace Period
**Actor:** System (Automated Job)  
**Precondition:** 30-day grace period has elapsed since soft-delete.  
**Main Flow:**
1. Scheduled job identifies accounts past the grace period.
2. All PII (email, name, avatar, chat history) is permanently removed.
3. Game and quiz records are anonymized (user unlinked) to preserve analytics.
4. Deletion event is logged in the audit trail.
**Exceptions:**
- None.

---

### UC-A06: Re-Register with Email of Soft-Deleted Account
**Actor:** Visitor  
**Precondition:** An account with the same email was soft-deleted and is within the 30-day grace period.  
**Main Flow:**
1. Visitor attempts to register with an email belonging to a soft-deleted account.
2. System detects the email is still reserved (soft-delete grace period active).
3. Registration is rejected with `409 AUTH_EMAIL_EXISTS`.
**Exceptions:**
- Grace period has passed and PII was hard-deleted → email is available for re-registration.

---

### UC-A07: Re-Register After Hard-Delete
**Actor:** Visitor  
**Precondition:** The previous account's PII has been hard-deleted (30-day grace period elapsed).  
**Main Flow:**
1. Visitor registers with an email that was previously hard-deleted.
2. System finds no matching record (email was removed).
3. Registration succeeds as a new account with no link to historical data.
**Exceptions:**
- None.
