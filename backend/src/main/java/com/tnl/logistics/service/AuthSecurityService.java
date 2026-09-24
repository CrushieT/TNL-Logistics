package com.tnl.logistics.service;

import com.tnl.logistics.dto.CurrentUserResponse;
import com.tnl.logistics.model.MobileDeviceBinding;
import org.springframework.http.HttpStatus;

public interface AuthSecurityService {

    CurrentUserResponse getCurrentUser(String userId, String deviceId, String deviceToken);

    AuthenticatedUserSnapshot changePassword(
            String userId,
            Integer expectedTokenVersion,
            String oldPassword,
            String newPassword,
            String clientIp);

    void verifyPassword(String userId, String password, String clientIp);

    PinUpdateResult updatePin(
            String userId,
            Integer expectedTokenVersion,
            Long jwtIssuedAtEpochSeconds,
            String pin,
            String currentPassword,
            String deviceId,
            String deviceToken,
            String clientIp);

    UnbindResult unbindCurrentDevice(
            String userId,
            Integer expectedTokenVersion,
            String deviceId,
            String deviceToken,
            String clientIp);

    boolean isValidDeviceId(String deviceId);

    boolean isValidDeviceToken(String deviceToken);

    boolean hasMatchingDeviceToken(MobileDeviceBinding binding, String deviceToken);

    String maskDeviceId(String deviceId);

    record AuthenticatedUserSnapshot(
            String userId,
            String username,
            String fullName,
            String role,
            boolean mustChangePassword,
            boolean hasPinSet,
            int tokenVersion) {
    }

    record PinUpdateResult(String userId, String role, int tokenVersion, boolean rotation) {
    }

    record UnbindResult(String maskedDeviceId, int tokenVersion) {
    }

    final class AuthSecurityException extends RuntimeException {
        private final HttpStatus status;
        private final String code;
        private final long retryAfterSeconds;

        public AuthSecurityException(HttpStatus status, String code, String message) {
            this(status, code, message, 0);
        }

        public AuthSecurityException(HttpStatus status, String code, String message, long retryAfterSeconds) {
            super(message);
            this.status = status;
            this.code = code;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public HttpStatus getStatus() {
            return status;
        }

        public String getCode() {
            return code;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }
}
