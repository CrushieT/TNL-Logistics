package com.tnl.logistics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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
    private static long adminExpirationMs = 12L * 60 * 60 * 1000L;  // 12 hours (Shift TTL for Web Admin)
    private static long staffExpirationMs = 10L * 24 * 60 * 60 * 1000L; // 10 days (Mobile Staff TTL)
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${jwt.secret:${JWT_SECRET:}}")
    public void setSecret(String secretKey) {
        if (secretKey == null || secretKey.trim().getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT secret must be configured and at least 256 bits (32 bytes) long.");
        }
        JwtTokenProvider.secret = secretKey.trim();
    }

    @Value("${jwt.expiration.admin-hours:12}")
    public void setAdminExpirationHours(long hours) {
        if (hours <= 0) {
            throw new IllegalArgumentException("Admin JWT expiration hours must be positive.");
        }
        JwtTokenProvider.adminExpirationMs = hours * 60 * 60 * 1000L;
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
        return generateToken(userId, role, tokenVersion, nowSeconds, expSeconds);
    }

    public static String generateToken(String userId, String role, Integer tokenVersion, long iatSeconds, long expSeconds) {
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
            long nowSeconds = System.currentTimeMillis() / 1000;
            if (exp != null && exp.longValue() < nowSeconds) {
                return false;
            }

            // Enforce shift TTL policy and reject legacy overlong tokens for ADMIN
            String role = (String) claims.get("role");
            if (isAdminRole(role)) {
                Number iat = (Number) claims.get("iat");
                if (iat == null || exp == null) {
                    return false;
                }
                long adminMaxLifetimeSeconds = adminExpirationMs / 1000;
                // Reject if elapsed time since issuance exceeds admin shift TTL
                if (nowSeconds - iat.longValue() > adminMaxLifetimeSeconds) {
                    return false;
                }
                // Reject legacy overlong tokens issued under prior 10-day policy (+60s clock skew tolerance)
                if ((exp.longValue() - iat.longValue()) > (adminMaxLifetimeSeconds + 60)) {
                    return false;
                }
                // Reject future-dated iat beyond clock skew tolerance (60s)
                if (iat.longValue() - nowSeconds > 60) {
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

    private static String sign(String input, String secret) throws Exception {
        Mac sha256HMAC = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        sha256HMAC.init(secretKey);
        byte[] hash = sha256HMAC.doFinal(input.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }
}
