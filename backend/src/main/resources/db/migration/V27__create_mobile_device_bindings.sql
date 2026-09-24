-- ============================================================
-- MOBILE DEVICE BINDING — Cryptographic device-bound credentials
-- ============================================================
CREATE TABLE mobile_device_binding (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id              VARCHAR(64)     NOT NULL UNIQUE,
    user_id                VARCHAR(20)     NOT NULL,
    device_token_hash      VARCHAR(64)     NOT NULL,
    device_name            VARCHAR(100)    NULL,
    active                 BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_authenticated_at  TIMESTAMP       NULL,
    CONSTRAINT fk_mobile_device_user FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_mobile_device_user ON mobile_device_binding(user_id);
CREATE INDEX idx_mobile_device_id_active ON mobile_device_binding(device_id, active);
