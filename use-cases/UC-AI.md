# UC-AI — AI Assistant (RAG Chat)

---

## Chat

### UC-AI01: Start a Chat Session
**Actor:** Authenticated User  
**Precondition:** User is logged in; AI is enabled for the museum.  
**Main Flow:**
1. User opens the AI assistant for a museum (optionally from a specific artifact).
2. System creates a chat session scoped to the museum.
3. Suggested questions are displayed (admin-defined or auto-generated).
**Exceptions:**
- AI is disabled for this museum → feature is unavailable.

---

### UC-AI02: Ask a Question (RAG Pipeline)
**Actor:** Authenticated User (session owner)  
**Precondition:** Chat session is active.  
**Main Flow:**
1. User sends a message about an artifact or the museum collection.
2. System retrieves relevant artifact context via semantic search.
3. LLM generates a streamed response using the retrieved context.
4. Response is displayed token-by-token in the chat.
**Exceptions:**
- None.

---

### UC-AI03: Multi-Language Response
**Actor:** Authenticated User  
**Precondition:** User has a language preference set (Turkish or English).  
**Main Flow:**
1. User asks a question in their preferred language.
2. System instructs the LLM to respond in the user's language.
3. Response is delivered in the correct language regardless of source data language.
**Exceptions:**
- None.

---

### UC-AI04: Rate Limit Reached
**Actor:** Authenticated User  
**Precondition:** User has exceeded the AI rate limit (configurable per museum).  
**Main Flow:**
1. User sends a message that exceeds the per-minute rate limit.
2. System rejects the request.
3. User is informed to wait before sending another message.
**Exceptions:**
- None.

---

### UC-AI05: AI Disabled for Museum
**Actor:** Authenticated User  
**Precondition:** Museum admin has disabled the AI module.  
**Main Flow:**
1. User attempts to access the AI assistant.
2. System detects AI is disabled for this museum.
3. All AI-related features are hidden; access is blocked.
**Exceptions:**
- None.

---

## Safety & Moderation

### UC-AS01: Content Violation Detected
**Actor:** System  
**Precondition:** User submits a message that violates content safety rules.  
**Main Flow:**
1. User sends a harmful or policy-violating message.
2. System's content filter (keyword blocklist + LLM moderation) detects the violation.
3. Query is silently blocked; active chat session is terminated.
4. User must start a new chat session.
**Exceptions:**
- None.

---

### UC-AS02: Max Conversation Turns Exceeded
**Actor:** Authenticated User  
**Precondition:** User has reached the maximum allowed turns per session.  
**Main Flow:**
1. User sends a message after reaching the turn limit.
2. System rejects the message.
3. User must start a new chat session to continue.
**Exceptions:**
- None.

---

### UC-AS03: AI API Failure with Retry
**Actor:** System  
**Precondition:** The LLM API is unresponsive or returns an error.  
**Main Flow:**
1. System sends the request to the LLM API and receives an error.
2. Request is queued for retry (max 2 retries, exponential backoff).
3. If all retries fail, an error is returned to the user.
**Exceptions:**
- None (system does NOT auto-switch to a fallback model).

---

### UC-AS04: Admin Reviews Flagged AI Messages
**Actor:** Museum Admin / Super Admin  
**Precondition:** AI messages exist for the museum.  
**Main Flow:**
1. Admin opens the AI message moderation view.
2. Admin reviews messages and flags or dismisses them.
3. Flag status is updated on the message record.
**Exceptions:**
- None.

---

## Edge Cases

### UC-AX01: WebSocket Disconnection Mid-Stream
**Actor:** Authenticated User  
**Precondition:** LLM is streaming tokens via WebSocket; connection drops.  
**Main Flow:**
1. AI is streaming a response via `ai:token` events.
2. WebSocket connection is lost (network drop, app backgrounded).
3. Server detects the disconnection and stops forwarding tokens.
4. The partial response received so far is persisted to `ai_messages` (with a `truncated` flag).
5. When the user reconnects, they see the partial response in their chat history.
6. User can send a new message to continue the conversation.
**Exceptions:**
- Server-side stream completes before detecting disconnection → full message is persisted normally.

---

### UC-AX02: RAG Returns No Relevant Context
**Actor:** Authenticated User  
**Precondition:** User asks a question; pgvector similarity search returns 0 matching chunks.  
**Main Flow:**
1. User sends a message that has no semantic match to any artifact in the museum.
2. RAG pipeline returns an empty context set.
3. LLM is prompted without artifact context, with an instruction to acknowledge it doesn't have specific information and suggest the visitor explore the museum's collection.
4. Response is delivered normally.
**Exceptions:**
- None.

---

### UC-AX03: View and Tap Suggested Questions
**Actor:** Authenticated User  
**Precondition:** User opens the AI chat for a specific artifact.  
**Main Flow:**
1. System checks for admin-defined suggested questions on the artifact.
2. If admin-defined questions exist → display them as tappable chips.
3. If none exist → auto-generate 3 questions via LLM based on artifact metadata; cache in Redis (24h TTL).
4. User taps a suggested question chip.
5. The question is sent as a user message, triggering the standard RAG pipeline (UC-AI02).
6. `ai_suggested_question_tapped` analytics event is emitted.
**Exceptions:**
- LLM auto-generation fails → no suggested questions are shown (graceful degradation).

---

### UC-AX04: Provide Feedback on AI Response (Thumbs Up/Down)
**Actor:** Authenticated User  
**Precondition:** AI has delivered a response in an active chat session.  
**Main Flow:**
1. User taps the thumbs-up or thumbs-down icon on an AI response.
2. System records the feedback as an `ai_thumbs_up` or `ai_thumbs_down` analytics event.
3. Feedback is associated with the specific `ai_messages` record.
**Exceptions:**
- User changes feedback (thumbs-up → thumbs-down) → latest feedback overwrites the previous.

---

### UC-AX05: Load Older Chat Messages (Pagination)
**Actor:** Authenticated User  
**Precondition:** Chat session has more than 30 messages.  
**Main Flow:**
1. User scrolls up in the chat to load older messages.
2. Client sends a request with the cursor from the last loaded message.
3. System returns the next page of messages (30 per page, most recent first).
4. Messages are prepended to the chat view.
**Exceptions:**
- No more messages to load → client hides the "load more" indicator.

---

### UC-AX06: Multiple Concurrent AI Chat Sessions
**Actor:** Authenticated User  
**Precondition:** User has an active chat session for Museum A.  
**Main Flow:**
1. User opens the AI assistant for Museum B.
2. System creates a new chat session scoped to Museum B.
3. Both sessions remain active; user can switch between them.
**Exceptions:**
- None.

> **Note:** Unlike Treasure Hunt, there is no single-session constraint for AI chat. Each session is scoped to a museum and operates independently.

---

### UC-AX07: Content Safety False Positive
**Actor:** Authenticated User  
**Precondition:** User sends a legitimate message that is falsely flagged by the content filter.  
**Main Flow:**
1. User sends a message with terms that trigger the keyword blocklist or LLM moderation.
2. System silently blocks the query and terminates the session (per PRD design).
3. User must start a new chat session.
4. There is NO appeal mechanism in v1.0; false positives are accepted as a trade-off for safety.
**Exceptions:**
- None.

> **Note:** Museum admins can review flagged messages (UC-AS04) and dismiss false positives post-hoc, but cannot restore a terminated session.

---

### UC-AX08: Guest Attempts AI Chat
**Actor:** Guest  
**Precondition:** Visitor holds only a guest token.  
**Main Flow:**
1. Guest attempts to open the AI assistant.
2. System checks authentication — guest role does not have AI access.
3. Access is denied; guest is prompted to register or log in.
**Exceptions:**
- None.
