# UC-ARTIFACT — Artifact Management

---

## Browsing

### UC-AB01: Browse Museum Artifacts
**Actor:** Visitor (any role)  
**Precondition:** Museum is active and has published artifacts.  
**Main Flow:**
1. Visitor opens the artifact listing for a museum.
2. System returns a paginated list with text search support.
3. Visitor browses or filters by period/keyword.
**Exceptions:**
- No artifacts exist → empty state is displayed.

---

### UC-AB02: Search Artifacts with Fuzzy Match
**Actor:** Visitor (any role)  
**Precondition:** Museum has artifacts.  
**Main Flow:**
1. Visitor types a partial or misspelled artifact name.
2. System uses fuzzy text matching to return relevant results.
3. Visitor selects an artifact from the results.
**Exceptions:**
- No matches found → empty result set returned.

---

### UC-AB03: View Artifact Detail
**Actor:** Visitor (any role)  
**Precondition:** Artifact exists and its museum is active.  
**Main Flow:**
1. Visitor selects an artifact.
2. System displays full details (description, images, audio guide, location hint).
**Exceptions:**
- Artifact was soft-deleted → not found error.

---

## Content Management

### UC-AC01: Create Artifact
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is authenticated and scoped to the museum.  
**Main Flow:**
1. Actor provides artifact name, description, and media.
2. System creates the artifact record.
3. QR code is auto-generated and embedding pipeline is triggered asynchronously.
**Exceptions:**
- Required fields missing → creation rejected.

---

### UC-AC02: Edit Artifact
**Actor:** Content Editor / Museum Admin  
**Precondition:** Artifact exists within actor's museum.  
**Main Flow:**
1. Actor updates artifact text or media.
2. System saves changes.
3. If text fields changed, embedding pipeline re-runs asynchronously.
**Exceptions:**
- None.

---

### UC-AC03: Delete Artifact
**Actor:** Museum Admin  
**Precondition:** Artifact exists within actor's museum.  
**Main Flow:**
1. Museum admin soft-deletes the artifact.
2. Associated QR code is deactivated.
3. Artifact no longer appears in public listings.
**Exceptions:**
- Content editor attempts deletion → denied (insufficient role).

---

### UC-AC04: Cross-Museum Artifact Edit Denied
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to Museum A.  
**Main Flow:**
1. Actor attempts to create or edit an artifact belonging to Museum B.
2. Tenant isolation blocks the request.
3. Action is denied.
**Exceptions:**
- None.

---

## Edge Cases

### UC-AE01: Delete Artifact Referenced in Active Game Scenario
**Actor:** Museum Admin  
**Precondition:** Artifact's QR code is used as a clue in a published game scenario.  
**Main Flow:**
1. Museum admin attempts to soft-delete the artifact.
2. System detects the artifact is referenced in one or more published game scenarios.
3. Deletion is blocked; admin is informed which scenarios reference this artifact.
4. Admin must first remove the artifact from all published scenarios (or unpublish them) before deletion is allowed.
**Exceptions:**
- Artifact is only referenced in draft scenarios → deletion is allowed; draft scenarios show a warning about the missing artifact.

---

### UC-AE02: Delete Artifact Linked to Quiz Questions
**Actor:** Museum Admin  
**Precondition:** Artifact has linked quiz questions (`quiz_questions.artifact_id` FK).  
**Main Flow:**
1. Museum admin soft-deletes the artifact.
2. System nullifies the `artifact_id` on all linked quiz questions (questions remain functional but lose artifact context).
3. QR code is deactivated; artifact removed from public listings.
**Exceptions:**
- None.

---

### UC-AE03: Embedding Pipeline Failure
**Actor:** System  
**Precondition:** Artifact is created or text fields are updated, triggering the embedding pipeline.  
**Main Flow:**
1. Bull queue job sends text to OpenAI text-embedding-3-small API.
2. API call fails (network error, rate limit, service outage).
3. Job is retried (max 3 retries with exponential backoff).
4. If all retries fail, the artifact is saved without an embedding (`embedding = NULL`).
5. The artifact is still usable for browsing, QR scanning, and quizzes but will NOT appear in AI RAG search results.
6. A failed embedding job is logged and surfaced (admin-visible) for manual re-trigger.
**Exceptions:**
- Partial failure (multi-chunk artifact, some chunks succeed) → all chunks are retried as a batch.

---

### UC-AE04: Artifact Viewed from Inactive Museum
**Actor:** Visitor  
**Precondition:** Visitor has a direct URL to an artifact whose museum has been deactivated.  
**Main Flow:**
1. Visitor navigates to the artifact detail page via a direct link or bookmark.
2. System resolves the artifact and checks the parent museum's `is_active` status.
3. Museum is inactive → request is denied with `403 MUSEUM_INACTIVE`.
**Exceptions:**
- None.

---

### UC-AE05: Artifact with No Media
**Actor:** Visitor  
**Precondition:** Artifact exists with text fields only (no images, no audio guide).  
**Main Flow:**
1. Visitor opens the artifact detail page.
2. System displays text content (name, description, historical context, period, location hint).
3. Image gallery and audio player sections are hidden (not shown as empty/broken).
**Exceptions:**
- None.
