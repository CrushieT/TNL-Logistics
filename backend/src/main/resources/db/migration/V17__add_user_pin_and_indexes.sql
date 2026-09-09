-- Phase 5.5: Add mobile PIN hash for Phase 6 PIN-based mobile login
ALTER TABLE app_user
    ADD COLUMN pin_hash VARCHAR(255) NULL;

-- Performance index for user list queries filtered by role and active status
CREATE INDEX idx_app_user_role_active ON app_user (role, active);
