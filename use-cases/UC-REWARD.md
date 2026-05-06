# UC-REWARD — Rewards & Badges

---

## Earning Rewards

### UC-RE01: Earn Badge on Game Completion
**Actor:** Authenticated User  
**Precondition:** User completes a Treasure Hunt (COMPLETED state).  
**Main Flow:**
1. User verifies the final code and completes the hunt.
2. System checks for a reward linked to the completed scenario.
3. Badge is issued to the user's profile.
**Exceptions:**
- User already earned this badge → duplicate issuance prevented.

---

### UC-RE02: Earn Discount Code on Quiz Threshold
**Actor:** Authenticated User  
**Precondition:** User completes a quiz with a score meeting the reward threshold.  
**Main Flow:**
1. User finishes a quiz with a qualifying score.
2. System checks `rewards` with `trigger_type = 'quiz_threshold'` and compares the score against `trigger_config.minScore`.
3. If score meets or exceeds the threshold, a single-use discount code is generated.
4. Code is added to the user's rewards with an optional `expires_at` timestamp (if the museum configured a discount validity period).
**Exceptions:**
- No reward defined for this threshold → no code issued.
- Score below threshold → no reward issued.

---

### UC-RE03: Duplicate Badge Prevention
**Actor:** System  
**Precondition:** User has already earned a specific badge.  
**Main Flow:**
1. User completes the same scenario again.
2. System detects the badge was already earned.
3. No duplicate badge is issued; user is informed it was already earned.
**Exceptions:**
- None.

---

### UC-RE04: View Earned Rewards
**Actor:** Authenticated User  
**Precondition:** User has earned at least one reward.  
**Main Flow:**
1. User navigates to their rewards gallery.
2. System displays all earned badges, certificates, and discount codes.
**Exceptions:**
- No rewards earned → empty state displayed.

---

## Admin Management

### UC-RM01: Create Reward Definition
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to the museum.  
**Main Flow:**
1. Actor defines a reward with: `name`, `type` (badge/certificate/discount_code), `assetUrl`, `trigger_type` (game_completion or quiz_threshold), `trigger_config` (e.g., `{ minScore: 80 }`), and optionally `linked_scenario_id` (for game rewards) and `discount_validity_days` (for discount codes).
2. System validates the configuration (e.g., `linked_scenario_id` must reference a valid scenario if `trigger_type = game_completion`).
3. System saves the reward definition for the museum.
**Exceptions:**
- Invalid `linked_scenario_id` → creation rejected.
- `trigger_config.minScore` out of range → creation rejected.

---

### UC-RM02: Verify Discount Code at Ticket Desk
**Actor:** Content Editor / Museum Admin  
**Precondition:** Visitor presents a discount code.  
**Main Flow:**
1. Staff enters the discount code into the verification screen.
2. System checks validity and marks the code as redeemed.
3. Verification result is displayed.
**Exceptions:**
- Code already redeemed → verification fails.
- Code not found → invalid code response.

---

### UC-RM03: Reuse Redeemed Discount Code Denied
**Actor:** Visitor / Attacker  
**Precondition:** Discount code has already been redeemed.  
**Main Flow:**
1. Someone attempts to use an already-redeemed code.
2. System detects the code is marked as redeemed.
3. Verification fails.
**Exceptions:**
- None.

---

### UC-RM04: Delete Reward Definition
**Actor:** Museum Admin  
**Precondition:** Reward definition exists within actor's museum.  
**Main Flow:**
1. Museum admin deletes a reward definition.
2. Definition is removed; already-issued rewards remain on user profiles.
**Exceptions:**
- Content editor attempts deletion → denied (insufficient role).

---

## Edge Cases

### UC-RX01: Guest Completes Game — Reward Deferred
**Actor:** Guest  
**Precondition:** Guest completes a Treasure Hunt without registering.  
**Main Flow:**
1. Guest reaches COMPLETED state.
2. System cannot issue a reward (no `user_id`).
3. Reward eligibility is recorded on the game session.
4. Guest is prompted to register to claim the reward.
5. On account linking, the deferred reward is issued to the new account.
**Exceptions:**
- Guest never registers → reward is lost when session data ages out.

---e

### UC-RX02: Discount Code Expiration Policy
**Actor:** Visitor  
**Precondition:** Visitor earned a discount code some time ago.  
**Main Flow:**
1. Visitor presents the discount code at the ticket desk.
2. System checks the code's `expires_at` field.
3. If `expires_at` is NULL → code is valid indefinitely.
4. If `expires_at` is set and has passed → code is expired; verification fails.
5. If `expires_at` is set and has not passed → code is valid; proceed with redemption.
**Exceptions:**
- Expired code → verification returns "code expired" error with expiration date.

---

### UC-RX03: Update Reward Definition
**Actor:** Content Editor / Museum Admin  
**Precondition:** Reward definition exists within actor's museum.  
**Main Flow:**
1. Actor updates the reward definition (name, asset image, type).
2. System saves the changes.
3. Already-issued rewards that reference this definition reflect the updated asset URL.
**Exceptions:**
- None.

---

### UC-RX04: Delete Reward Definition with Active Assets
**Actor:** Museum Admin  
**Precondition:** Reward definition has been issued to users, and the reward asset (badge image) is stored in S3.  
**Main Flow:**
1. Museum admin deletes the reward definition.
2. Definition is soft-deleted; `user_rewards` entries referencing it remain intact.
3. The S3 asset (badge/certificate image) is **NOT deleted** so existing earned rewards continue to display correctly.
**Exceptions:**
- If the S3 asset is manually deleted later → users see broken images in their reward gallery.

---

### UC-RX05: Share Earned Reward
**Actor:** Authenticated User  
**Precondition:** User has earned a badge or certificate.  
**Main Flow:**
1. User selects a reward and taps the share action.
2. System generates a shareable link or image.
3. `reward_shared` analytics event is emitted.
**Exceptions:**
- Discount codes are NOT shareable (single-use, tied to user).

---

### UC-RX06: Discount Code Verification — Invalid Format
**Actor:** Content Editor / Museum Admin  
**Precondition:** Staff enters a malformed code at the ticket desk.  
**Main Flow:**
1. Staff enters a code that doesn't match the expected format (8-char uppercase alphanumeric).
2. System validates the format before database lookup.
3. Verification fails immediately with an "invalid format" error.
**Exceptions:**
- None.
