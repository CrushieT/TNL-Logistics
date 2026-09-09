-- Add token version to app_user for session invalidation on credential resets
ALTER TABLE app_user
    ADD COLUMN token_version INT NOT NULL DEFAULT 1;
