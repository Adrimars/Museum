# UC-MUSEUM — Museum Management

---

## Browsing

### UC-MB01: Browse Active Museums
**Actor:** Visitor (any role)  
**Precondition:** At least one museum is active on the platform.  
**Main Flow:**
1. Visitor opens the museum listing.
2. System returns a paginated list of active museums.
3. Visitor browses museums by name, location, or scrolling.
**Exceptions:**
- No active museums → empty state is displayed.

---

### UC-MB02: View Museum Detail
**Actor:** Visitor (any role)  
**Precondition:** Museum is active.  
**Main Flow:**
1. Visitor selects a museum from the listing.
2. System displays museum details (description, address, enabled features).
**Exceptions:**
- Museum deactivated between listing and detail request → access denied.

---

### UC-MB03: Search Museums with No Results
**Actor:** Visitor (any role)  
**Precondition:** None.  
**Main Flow:**
1. Visitor searches for a museum using a keyword.
2. System finds no matching active museums.
3. Empty result set is returned.
**Exceptions:**
- None.

---

## Onboarding

### UC-MO01: Super Admin Creates a Museum
**Actor:** Super Admin  
**Precondition:** Super admin is authenticated.  
**Main Flow:**
1. Super admin provides museum name, slug, description, and address.
2. System creates the museum record with default settings.
3. Museum is created in **inactive** state (`is_active = false`). It does not appear in public listings.
4. Super admin configures the museum (settings, theme, limits) and creates the initial `museum_admin` account.
5. Once setup is complete, super admin explicitly enables the museum via `POST /api/v1/admin/museums/:id/enable`.

**Exceptions:**
- Duplicate slug → creation rejected.

---

### UC-MO02: Super Admin Creates Museum Admin Account
**Actor:** Super Admin  
**Precondition:** Museum exists.  
**Main Flow:**
1. Super admin creates a user account with museum_admin role for the museum.
2. Credentials are shared directly with the museum client (no invitation flow).
3. Museum admin can log in and begin configuring content.
**Exceptions:**
- Email already in use → account creation rejected.

---

### UC-MO03: Self-Service Museum Registration Denied
**Actor:** Unauthorized User  
**Precondition:** None.  
**Main Flow:**
1. A non-super-admin attempts to create a museum.
2. System denies the request based on role check.
3. Unauthorized attempt is logged in the audit trail.
**Exceptions:**
- None.

---

## Management

### UC-MM01: Update Museum Settings
**Actor:** Museum Admin  
**Precondition:** Museum admin is authenticated and owns the museum.  
**Main Flow:**
1. Museum admin modifies settings (theme, game limits, AI config, quiz timers).
2. System validates the new configuration values.
3. Settings are saved and take effect immediately.
**Exceptions:**
- Invalid configuration values → update rejected with validation errors.

---

### UC-MM02: Enable a Museum
**Actor:** Super Admin  
**Precondition:** Museum exists and is currently inactive.  
**Main Flow:**
1. Super admin enables the museum.
2. Museum appears in public listings; all visitor features become accessible.
**Exceptions:**
- None.

---

### UC-MM03: Disable a Museum
**Actor:** Super Admin  
**Precondition:** Museum is active; operation performed outside active hours.  
**Main Flow:**
1. Super admin disables the museum.
2. Museum is hidden from public listings.
3. Visitor-facing features return "museum inactive" errors.
4. Museum admin retains admin panel and historical data access.
**Exceptions:**
- None.

---

### UC-MM04: Visitor Accesses a Disabled Museum
**Actor:** Visitor  
**Precondition:** Museum has been deactivated.  
**Main Flow:**
1. Visitor attempts to access a feature (game, quiz, AI) for a disabled museum.
2. System blocks the request.
3. Visitor is informed the museum is currently unavailable.
**Exceptions:**
- None.

---

### UC-MM05: Cross-Tenant Data Access Denied
**Actor:** Museum Admin  
**Precondition:** Museum admin is authenticated for Museum A.  
**Main Flow:**
1. Museum admin attempts to access or modify data belonging to Museum B.
2. Tenant isolation middleware detects the scope mismatch.
3. Request is denied.
**Exceptions:**
- None.

---

## Edge Cases

### UC-ME01: Soft-Delete Museum Cascading Effects
**Actor:** Super Admin  
**Precondition:** Museum has artifacts, QR codes, game scenarios, quiz questions, rewards, and assigned staff.  
**Main Flow:**
1. Super admin soft-deletes the museum.
2. System cascades the soft-delete: all artifacts, QR codes, game scenarios, quiz questions, and reward definitions are deactivated or soft-deleted.
3. Active game and quiz sessions (if any) are marked as `EXPIRED`.
4. Staff accounts (`museum_admin`, `content_editor`) scoped to the museum retain their user records but lose access to museum-specific features.
5. Museum no longer appears in public listings.
**Exceptions:**
- None.

---

### UC-ME02: Museum Slug Collision on Update
**Actor:** Museum Admin  
**Precondition:** Museum admin attempts to change the museum slug.  
**Main Flow:**
1. Museum admin updates the museum details including a new slug.
2. System detects the new slug already exists for another museum.
3. Update is rejected with a validation error indicating slug conflict.
**Exceptions:**
- None.

---

### UC-ME03: Museum Settings Validation Boundaries
**Actor:** Museum Admin  
**Precondition:** Museum admin edits configurable settings (limits).  
**Main Flow:**
1. Museum admin sets a limit value to zero, negative, or unreasonably high (e.g., `maxAnswerAttemptsPerClue: 0`, `quizTimerSeconds: -5`).
2. System validates the setting against allowed boundaries (min/max constraints).
3. Update is rejected with field-specific validation errors.
**Exceptions:**
- Value is within range but unusual (e.g., `maxAnswerAttemptsPerClue: 100`) → accepted but logged for review.

---

### UC-ME04: Re-Enable Museum After Disable
**Actor:** Super Admin  
**Precondition:** Museum was previously disabled and is being re-enabled.  
**Main Flow:**
1. Super admin enables the museum.
2. Museum reappears in public listings; visitor features become accessible.
3. No state recovery is needed for previously expired game/quiz sessions — visitors must start fresh.
4. All existing published content (artifacts, scenarios, questions) becomes visible again.
**Exceptions:**
- None.
