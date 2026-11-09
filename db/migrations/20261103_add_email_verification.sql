-- Add email verification for new accounts. Existing accounts with a password
-- are treated as verified so this migration does not lock out current users.
ALTER TABLE users
    ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL;

UPDATE users
SET email_verified_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE password_hash IS NOT NULL
  AND email_verified_at IS NULL;
