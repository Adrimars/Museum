-- Add unique constraint on refresh_tokens.token_hash
-- Replaces the previous non-unique implicit lookup with a B-tree unique index,
-- enabling O(1) token validation via findUnique instead of a sequential scan.

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
