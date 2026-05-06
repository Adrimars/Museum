# UC-QUIZ — Quiz Module & Leaderboard

---

## Gameplay

### UC-QP01: Start a Quiz
**Actor:** Authenticated User  
**Precondition:** Museum has published quiz questions; user is logged in.  
**Main Flow:**
1. User selects a museum and difficulty level.
2. System randomly selects questions from the published bank.
3. Quiz session starts; first question is presented with a timer.
**Exceptions:**
- Not enough published questions for the difficulty → quiz cannot start.

---

### UC-QP02: Answer a Question
**Actor:** Authenticated User (session owner)  
**Precondition:** A quiz session is active and a question is displayed.  
**Main Flow:**
1. User selects an answer within the time limit.
2. System evaluates the answer and calculates points (base + time bonus).
3. Correct answer and explanation are shown; next question loads.
**Exceptions:**
- None.

---

### UC-QP03: Timer Expires Before Answer
**Actor:** Authenticated User (session owner)  
**Precondition:** Timer is running for the current question.  
**Main Flow:**
1. Timer reaches zero before the user submits an answer.
2. System auto-submits a blank answer, scored as incorrect (0 points).
3. Next question loads.
**Exceptions:**
- Client-side timer manipulation detected → server-side timer rejects the answer.

---

### UC-QP04: Complete Quiz and Set Personal Best
**Actor:** Authenticated User (session owner)  
**Precondition:** All questions have been answered.  
**Main Flow:**
1. User completes the last question.
2. System finalizes the score and compares to existing personal best.
3. If new score exceeds best, it replaces it; leaderboard is updated.
4. Results summary (score, rank, accuracy) is displayed.
**Exceptions:**
- None.

---

### UC-QP05: Guest Attempts Quiz
**Actor:** Guest  
**Precondition:** Visitor holds a guest token only.  
**Main Flow:**
1. Guest attempts to start a quiz.
2. System denies access (authentication required for leaderboard attribution).
3. Guest is prompted to register or log in.
**Exceptions:**
- None.

---

## Leaderboard

### UC-QL01: View Museum Leaderboard
**Actor:** Visitor (any role)  
**Precondition:** Museum has quiz score data.  
**Main Flow:**
1. Visitor opens the leaderboard for a museum.
2. System returns ranked personal best scores.
**Exceptions:**
- No scores yet → empty leaderboard displayed.

---

### UC-QL02: Filter Leaderboard by Period
**Actor:** Visitor (any role)  
**Precondition:** Leaderboard has data.  
**Main Flow:**
1. Visitor selects a time period filter (all-time, weekly, monthly).
2. System returns the leaderboard filtered to that period.
**Exceptions:**
- No data for the selected period → empty result.

---

### UC-QL03: Leaderboard Rank Update
**Actor:** System  
**Precondition:** A user completes a quiz with a new personal best.  
**Main Flow:**
1. System updates the leaderboard sorted set with the new best score.
2. Rankings are recalculated in real-time.
**Exceptions:**
- None.

---

## Question Management

### UC-QM01: Create Draft Question
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to the museum.  
**Main Flow:**
1. Actor creates a question with text, options, difficulty, and explanation.
2. Question is saved in draft status.
**Exceptions:**
- None.

---

### UC-QM02: Publish Question
**Actor:** Museum Admin  
**Precondition:** Question exists in draft status.  
**Main Flow:**
1. Museum admin transitions the question from draft to published.
2. Question enters the active question bank for quiz sessions.
**Exceptions:**
- Content editor attempts to publish → denied (insufficient role).

---

### UC-QM03: Delete Question
**Actor:** Museum Admin  
**Precondition:** Question exists within actor's museum.  
**Main Flow:**
1. Museum admin soft-deletes the question.
2. Question is removed from the active bank.
**Exceptions:**
- Content editor attempts deletion → denied (insufficient role).

---

## Edge Cases

### UC-QE01: Quiz Session Timeout / Abandonment
**Actor:** Authenticated User  
**Precondition:** User has started a quiz session but stops answering.  
**Main Flow:**
1. User abandons the quiz mid-session (closes app, navigates away).
2. Session remains open with unanswered questions.
3. User can return and continue answering remaining questions (no session-level timeout in v1.0 — individual question timers still apply).
4. Alternatively, user can start a new quiz session (no single-session constraint for quizzes).
**Exceptions:**
- None.

> **Note:** Unlike Treasure Hunt, quizzes do NOT enforce a single-active-session constraint. Users may have multiple incomplete quiz sessions.

---

### UC-QE02: Question Deleted While Quiz In Progress
**Actor:** System  
**Precondition:** A user is mid-quiz; an admin soft-deletes or unpublishes one of the remaining questions.  
**Main Flow:**
1. User finishes the current question and the system loads the next.
2. System detects the next question has been soft-deleted/unpublished.
3. The question is skipped (0 points, not counted toward accuracy).
4. The next available question is loaded.
5. If no questions remain, the quiz completes early.
**Exceptions:**
- None.

---

### UC-QE03: Client-Side Timer Manipulation (Anti-Cheat)
**Actor:** Attacker  
**Precondition:** Quiz session is active.  
**Main Flow:**
1. Attacker modifies the client to send `timeSpentMs` far below actual elapsed time.
2. Server independently tracks when the question was served.
3. Server detects `timeSpentMs` is implausibly low (below server-measured minimum).
4. Answer is rejected or scored as if the full timer elapsed (0 time bonus).
**Exceptions:**
- Minor discrepancies due to network latency → accepted within a tolerance window.

---

### UC-QE04: Leaderboard Reflects Display Name Change
**Actor:** Authenticated User  
**Precondition:** User changes their display name after ranking on a leaderboard.  
**Main Flow:**
1. User updates their display name via profile settings.
2. On the next leaderboard read, the Redis sorted set provides the rank/score.
3. System hydrates the entry with the current `display_name` from PostgreSQL.
4. Leaderboard reflects the updated name in real-time.
**Exceptions:**
- None.

---

### UC-QE05: Quiz Attempt for Inactive Museum
**Actor:** Authenticated User  
**Precondition:** Museum has been deactivated between the user selecting the quiz and starting it.  
**Main Flow:**
1. User attempts to start a quiz for an inactive museum.
2. System checks museum `is_active` status.
3. Request is denied with `403 MUSEUM_INACTIVE`.
**Exceptions:**
- User is mid-quiz when museum is disabled → per PRD, disabling happens outside active hours, so no in-progress sessions should exist.

---

### UC-QE06: Not Enough Questions for Selected Difficulty
**Actor:** Authenticated User  
**Precondition:** Museum does not have enough published questions for the requested difficulty.  
**Main Flow:**
1. User selects a difficulty level and requests a quiz.
2. System counts available published questions for that difficulty.
3. Published question count is less than the configured `questionsPerQuizByDifficulty` value.
4. Quiz creation is rejected; user is informed there are not enough questions available.
**Exceptions:**
- If at least 1 question exists but fewer than the configured count → quiz is still rejected (no partial quizzes).

---

### UC-QE07: Concurrent Quiz Answer Submission (Double-Tap)
**Actor:** Authenticated User  
**Precondition:** Question is displayed; user taps submit twice rapidly.  
**Main Flow:**
1. Client sends two `POST .../answer` requests in quick succession.
2. Server processes the first request, records the answer, and advances to the next question.
3. Second request arrives for the same question (already answered).
4. Server detects the question was already answered and rejects the duplicate with `409 Conflict`.
**Exceptions:**
- None.
