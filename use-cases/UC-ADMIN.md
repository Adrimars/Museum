# UC-ADMIN — Admin Panel

---

## Museum Dashboard

### UC-AD01: View Museum Dashboard KPIs
**Actor:** Museum Admin  
**Precondition:** Museum admin is authenticated and owns the museum.  
**Main Flow:**
1. Admin opens the museum dashboard.
2. System displays KPI cards (visitors, QR scans, quiz completions, AI queries).
3. Trend charts show daily engagement over the selected date range.
**Exceptions:**
- No data yet → widgets show zero/empty states.

---

### UC-AD02: View Artifact Heatmap
**Actor:** Museum Admin  
**Precondition:** Museum has artifacts with engagement data.  
**Main Flow:**
1. Admin opens the artifact heatmap view.
2. System displays artifacts ranked by weighted engagement score.
3. Admin identifies which exhibits attract the most visitor attention.
**Exceptions:**
- No engagement data → heatmap is empty.

---

### UC-AD03: View Conversion Funnels
**Actor:** Museum Admin  
**Precondition:** Analytics data has been collected.  
**Main Flow:**
1. Admin opens the funnel analysis view.
2. System displays the 5 primary funnels with drop-off rates.
3. Admin identifies where visitors disengage.
**Exceptions:**
- None.

---

### UC-AD04: Content Editor Views Read-Only Analytics
**Actor:** Content Editor  
**Precondition:** Content editor is authenticated and scoped to the museum.  
**Main Flow:**
1. Content editor navigates to analytics.
2. System displays read-only engagement metrics.
3. Export and management actions are hidden.
**Exceptions:**
- None.

---

## User Management

### UC-AU01: View User List
**Actor:** Museum Admin  
**Precondition:** Museum admin is authenticated.  
**Main Flow:**
1. Admin opens the user management view.
2. System displays a paginated, searchable list of users scoped to the museum.
**Exceptions:**
- None.

---

### UC-AU02: Assign Role to User
**Actor:** Museum Admin  
**Precondition:** Target user exists.  
**Main Flow:**
1. Admin selects a user and assigns museum_admin or content_editor role.
2. Role is applied; user inherits the museum scope automatically.
**Exceptions:**
- None.

---

### UC-AU03: Ban a User
**Actor:** Museum Admin  
**Precondition:** Target user is active within the admin's museum.  
**Main Flow:**
1. Admin bans the user.
2. All user tokens are revoked immediately.
3. User cannot authenticate until unbanned.
**Exceptions:**
- None.

---

### UC-AU04: Cross-Museum Role Assignment Denied
**Actor:** Museum Admin  
**Precondition:** Admin is scoped to Museum A.  
**Main Flow:**
1. Admin attempts to assign a role to a user for Museum B.
2. System detects museum scope mismatch.
3. Request is denied.
**Exceptions:**
- None.

---

### UC-AU05: Promote to Super Admin Denied
**Actor:** Museum Admin  
**Precondition:** Museum admin attempts to assign super_admin role.  
**Main Flow:**
1. Museum admin tries to promote a user to super_admin.
2. System denies the action (only super_admin can create super_admin).
3. Request is rejected.
**Exceptions:**
- None.

---

## System Admin

### UC-SA01: System-Wide Overview
**Actor:** Super Admin  
**Precondition:** Super admin is authenticated.  
**Main Flow:**
1. Super admin opens the system admin panel.
2. System displays cross-museum KPIs (total users, scans, AI costs).
**Exceptions:**
- None.

---

### UC-SA02: Drill Down into Any Museum
**Actor:** Super Admin  
**Precondition:** Museums exist on the platform.  
**Main Flow:**
1. Super admin selects any museum from the system list.
2. System displays that museum's full dashboard (same as UC-AD01).
**Exceptions:**
- None.

---

### UC-SA03: Review Audit Log
**Actor:** Super Admin  
**Precondition:** Admin actions have been performed.  
**Main Flow:**
1. Super admin opens the audit log.
2. System displays a chronological log of all admin actions platform-wide.
**Exceptions:**
- None.

---

### UC-SA04: Moderate AI Messages
**Actor:** Super Admin  
**Precondition:** AI messages exist across museums.  
**Main Flow:**
1. Super admin opens the AI moderation view.
2. Admin browses messages, flags or dismisses them.
3. Flag status is updated.
**Exceptions:**
- None.

---

## Edge Cases

### UC-AX01: Museum Admin Views Audit Log
**Actor:** Museum Admin  
**Precondition:** Admin actions have been performed within the admin's museum.  
**Main Flow:**
1. Museum admin opens the audit log.
2. System displays a chronological log of admin actions scoped to the admin's museum (read-only).
3. Museum admin cannot see audit entries from other museums.
**Exceptions:**
- No audit entries → empty log displayed.

---

### UC-AX02: Unban a User
**Actor:** Museum Admin  
**Precondition:** User has been previously banned within the admin's museum.  
**Main Flow:**
1. Museum admin selects the banned user and initiates unban.
2. System sets `is_banned = false` on the user record.
3. User can authenticate again on their next login attempt.
**Exceptions:**
- None.

---

### UC-AX03: Demote / Remove Role
**Actor:** Museum Admin  
**Precondition:** Target user has `museum_admin` or `content_editor` role within the admin's museum.  
**Main Flow:**
1. Museum admin selects a user and changes their role to `user` (demotion).
2. System updates the user's role and clears their `museum_id` association.
3. User loses access to admin/editor features immediately.
4. User's existing tokens remain valid but subsequent role checks will deny privileged actions.
**Exceptions:**
- None.

---

### UC-AX04: Preview Draft Content
**Actor:** Museum Admin / Content Editor  
**Precondition:** Draft game scenarios or quiz questions exist.  
**Main Flow:**
1. Admin navigates to a draft scenario or question in the admin panel.
2. Admin selects "Preview" to test the content as a visitor would see it.
3. System renders the scenario/question in a preview mode (no real session created, no analytics emitted).
**Exceptions:**
- None.

---

### UC-AX05: Museum Admin Self-Demotion Guard
**Actor:** Museum Admin  
**Precondition:** Museum admin is the only `museum_admin` for their museum.  
**Main Flow:**
1. Museum admin attempts to demote themselves to `content_editor` or `user`.
2. System detects this would leave the museum with zero museum_admin accounts.
3. Self-demotion is blocked; admin is informed they must first assign another museum_admin.
**Exceptions:**
- If another museum_admin exists for the same museum → self-demotion is allowed.

---

### UC-AX06: Admin Data Table Interactions
**Actor:** Museum Admin / Super Admin  
**Precondition:** Admin opens any list view (artifacts, questions, scenarios, users, sessions).  
**Main Flow:**
1. System renders a paginated table (server-side offset-based pagination).
2. Admin can sort by clicking column headers (server-side sorting).
3. Admin can filter/search using the text search bar (server-side filtering).
4. Large datasets are virtualized for smooth scrolling (TanStack Table v8).
5. Page size is configurable (default: 25 rows per page).
**Exceptions:**
- Empty dataset → empty state message displayed.
