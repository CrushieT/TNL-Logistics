package com.tnl.logistics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Standard JDK-based JWT Token Provider.
 * Generates and validates tokens using HMAC-SHA256 signature verification.
 */
@Component
public class JwtTokenProvider {

    private static String secret;
    private static long adminExpirationMs = 30L * 60 * 1000L;  // 30 minutes (Inactivity TTL for Web Admin)
    private static long adminMaxLifetimeMs = 12L * 60 * 60 * 1000L; // 12 hours (Absolute Shift Ceiling)
    private static long staffExpirationMs = 10L * 24 * 60 * 60 * 1000L; // 10 days (Mobile Staff TTL)
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${jwt.secret:${JWT_SECRET:}}")
    public void setSecret(String secretKey) {
        if (secretKey == null || secretKey.trim().getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT secret must be configured and at least 256 bits (32 bytes) long.");
        }
        JwtTokenProvider.secret = secretKey.trim();
    }

    @Value("${jwt.expiration.admin-minutes:${JWT_EXPIRATION_ADMIN_MINUTES:30}}")
    private Long configuredAdminMinutes;

    @Value("${jwt.expiration.admin-hours:#{null}}")
    private Long configuredAdminHours;

    @PostConstruct
    public void initExpiration() {
        if (configuredAdminMinutes != null && configuredAdminMinutes > 0) {
            if (configuredAdminMinutes < 1 || configuredAdminMinutes > 30) {
                throw new IllegalArgumentException("jwt.expiration.admin-minutes must be between 1 and 30 minutes, but was: " + configuredAdminMinutes);
            }
            adminExpirationMs = configuredAdminMinutes * 60 * 1000L;
        } else if (configuredAdminHours != null && configuredAdminHours > 0) {
            adminExpirationMs = configuredAdminHours * 60 * 60 * 1000L;
        } else {
            adminExpirationMs = 30L * 60 * 1000L; // 30-minute fallback
        }
    }

    public static void setAdminExpirationMinutes(long minutes) {
        if (minutes <= 0) {
            throw new IllegalArgumentException("Admin JWT expiration minutes must be positive.");
        }
        JwtTokenProvider.adminExpirationMs = minutes * 60 * 1000L;
    }

    public static void setAdminExpirationHours(long hours) {
        if (hours <= 0) {
            throw new IllegalArgumentException("Admin JWT expiration hours must be positive.");
        }
        JwtTokenProvider.adminExpirationMs = hours * 60 * 60 * 1000L;
    }

    public static void setAdminExpirationMs(long ms) {
        if (ms <= 0) {
            throw new IllegalArgumentException("Admin JWT expiration ms must be positive.");
        }
        JwtTokenProvider.adminExpirationMs = ms;
    }

    public static void setAdminMaxLifetimeMs(long ms) {
        if (ms <= 0) {
            throw new IllegalArgumentException("Admin max lifetime ms must be positive.");
        }
        JwtTokenProvider.adminMaxLifetimeMs = ms;
    }

    @Value("${jwt.expiration.staff-days:10}")
    public void setStaffExpirationDays(long days) {
        if (days <= 0) {
            throw new IllegalArgumentException("Staff JWT expiration days must be positive.");
        }
        JwtTokenProvider.staffExpirationMs = days * 24 * 60 * 60 * 1000L;
    }

    public static boolean isAdminRole(String role) {
        if (role == null) {
            return false;
        }
        String trimmed = role.trim();
        return "ADMIN".equalsIgnoreCase(trimmed) || "ROLE_ADMIN".equalsIgnoreCase(trimmed);
    }

    public static long getExpirationMsForRole(String role) {
        if (isAdminRole(role)) {
            return adminExpirationMs;
        }
        return staffExpirationMs;
    }

    public static long getAdminExpirationMs() {
        return adminExpirationMs;
    }

    public static long getAdminMaxLifetimeMs() {
        return adminMaxLifetimeMs;
    }

    public static long getStaffExpirationMs() {
        return staffExpirationMs;
    }

    public static String generateToken(String userId, String role) {
        return generateToken(userId, role, 1);
    }

    public static String generateToken(String userId, String role, Integer tokenVersion) {
        return generateToken(userId, role, tokenVersion, getExpirationMsForRole(role));
    }

    public static String generateToken(String userId, String role, Integer tokenVersion, long expirationMs) {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long expSeconds = (System.currentTimeMillis() + expirationMs) / 1000;
        return generateToken(userId, role, tokenVersion, nowSeconds, expSeconds, nowSeconds);
    }

    public static String generateToken(String userId, String role, Integer tokenVersion, long iatSeconds, long expSeconds) {
        return generateToken(userId, role, tokenVersion, iatSeconds, expSeconds, iatSeconds);
    }

    public static String generateRenewedToken(String userId, String role, Integer tokenVersion, Long origAuthTimeSeconds) {
        long nowSeconds = System.currentTimeMillis() / 1000;
        long adminInactivitySeconds = adminExpirationMs / 1000;
        long maxCeilingSeconds = adminMaxLifetimeMs / 1000;
        long effectiveAuthTime = origAuthTimeSeconds != null ? origAuthTimeSeconds : nowSeconds;
        long expSeconds = Math.min(nowSeconds + adminInactivitySeconds, effectiveAuthTime + maxCeilingSeconds);
        if (expSeconds <= nowSeconds) {
            throw new IllegalStateException("Cannot generate renewed token because absolute session ceiling has expired");
        }
        return generateToken(userId, role, tokenVersion, nowSeconds, expSeconds, effectiveAuthTime);
    }

    public static String generateToken(String userId, String role, Integer tokenVersion, long iatSeconds, long expSeconds, Long authTimeSeconds) {
        if (secret == null) {
            throw new IllegalStateException("JWT secret has not been configured. Ensure jwt.secret is provided.");
        }
        try {
            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            Map<String, Object> payload = new HashMap<>();
            payload.put("sub", userId);
            payload.put("uid", userId);
            payload.put("role", role);
            payload.put("ver", tokenVersion != null ? tokenVersion : 1);
            payload.put("iat", iatSeconds);
            payload.put("exp", expSeconds);
            if (authTimeSeconds != null) {
                payload.put("auth_time", authTimeSeconds);
            } else if (isAdminRole(role)) {
                payload.put("auth_time", iatSeconds);
            }

            String headerJson = objectMapper.writeValueAsString(header);
            String payloadJson = objectMapper.writeValueAsString(payload);

            String encodedHeader = Base64.getUrlEncoder().withoutPadding().encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));
            String encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

            String signatureInput = encodedHeader + "." + encodedPayload;
            String signature = sign(signatureInput, secret);

            return signatureInput + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate JWT", e);
        }
    }

    public static boolean validateToken(String token) {
        if (secret == null) return false;
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return false;

            String header = parts[0];
            String payload = parts[1];
            String signature = parts[2];

            String expectedSignature = sign(header + "." + payload, secret);
            if (!MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8))) {
                return false;
            }

            // Check expiration
            String payloadJson = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            Number exp = (Number) claims.get("exp");
            Number iat = (Number) claims.get("iat");
            String role = (String) claims.get("role");
            String sub = (String) claims.get("sub");
            String uid = (String) claims.get("uid");
            Number ver = (Number) claims.get("ver");

            long nowSeconds = System.currentTimeMillis() / 1000;
            if (exp == null || exp.longValue() <= nowSeconds) {
                return false;
            }
            if (iat == null) {
                return false;
            }

            // Enforce shift TTL policy and reject legacy overlong tokens for ADMIN
            if (isAdminRole(role)) {
                Number authTime = (Number) claims.get("auth_time");
                if (authTime == null) {
                    return false;
                }
                if (sub == null || uid == null || !sub.equals(uid) || ver == null) {
                    return false;
                }

                long authTimeVal = authTime.longValue();
                long iatVal = iat.longValue();
                long expVal = exp.longValue();
                long adminInactivitySeconds = adminExpirationMs / 1000;
                long maxCeilingSeconds = adminMaxLifetimeMs / 1000;

                // auth_time cannot be in future beyond tolerance
                if (authTimeVal > nowSeconds + 60) {
                    return false;
                }
                // auth_time cannot be after iat
                if (authTimeVal > iatVal) {
                    return false;
                }
                // iat cannot be >= exp
                if (iatVal >= expVal) {
                    return false;
                }
                // Future-dated iat beyond clock skew tolerance (60s)
                if (iatVal - nowSeconds > 60) {
                    return false;
                }
                // Reject if elapsed time since last issuance exceeds inactivity window
                if (nowSeconds - iatVal >= adminInactivitySeconds) {
                    return false;
                }
                // Reject if total elapsed time since credential check exceeds absolute shift ceiling
                if (nowSeconds - authTimeVal >= maxCeilingSeconds) {
                    return false;
                }
                // Reject legacy overlong tokens (+60s clock skew tolerance)
                if ((expVal - iatVal) > (adminInactivitySeconds + 60)) {
                    return false;
                }
                // Reject exp exceeding absolute shift ceiling
                if (expVal > (authTimeVal + maxCeilingSeconds + 60)) {
                    return false;
                }
            } else {
                long iatVal = iat.longValue();
                long expVal = exp.longValue();
                long staffTtlSeconds = staffExpirationMs / 1000;
                if (iatVal - nowSeconds > 60) {
                    return false;
                }
                if ((expVal - iatVal) > (staffTtlSeconds + 60)) {
                    return false;
                }
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static String getUserIdFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            return (String) claims.get("sub");
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract user ID", e);
        }
    }

    public static String getImmutableUserIdFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            return (String) claims.get("uid");
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract immutable user ID", e);
        }
    }

    public static String getRoleFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            return (String) claims.get("role");
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract role", e);
        }
    }

    public static Integer getTokenVersionFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            Number ver = (Number) claims.get("ver");
            return ver != null ? ver.intValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public static Long getExpirationFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            Number exp = (Number) claims.get("exp");
            return exp != null ? exp.longValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public static Long getIssuedAtFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            Number iat = (Number) claims.get("iat");
            return iat != null ? iat.longValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public static Long getAuthTimeFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);
            Number authTime = (Number) claims.get("auth_time");
            return authTime != null ? authTime.longValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String sign(String input, String secret) throws Exception {
        Mac sha256HMAC = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        sha256HMAC.init(secretKey);
        byte[] hash = sha256HMAC.doFinal(input.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }
}
