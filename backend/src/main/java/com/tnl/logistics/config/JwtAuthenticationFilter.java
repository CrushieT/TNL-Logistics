package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Filter that intercepts incoming HTTP requests, extracts JWT from the
 * Authorization header or query parameter, verifies that the user is active,
 * and signs the user into Spring Security context.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger securityAuditLog = LoggerFactory.getLogger("SECURITY_AUDIT");
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{1,64}$");

    private final AppUserRepository appUserRepository;

    public JwtAuthenticationFilter(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String token = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else if (isSseStreamRequest(request) && request.getParameter("token") != null && !request.getParameter("token").isBlank()) {
            token = request.getParameter("token");
        }

        if (token != null && isPublicAuthenticationRequest(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (token != null) {
            if (!JwtTokenProvider.validateToken(token)) {
                auditSecurityMutationFailure(request, null, null, "SESSION_REAUTH_REQUIRED");
                sendSessionReauthenticationRequiredResponse(response);
                return;
            }

            try {
                String userId = JwtTokenProvider.getUserIdFromToken(token);
                String immutableUserId = JwtTokenProvider.getImmutableUserIdFromToken(token);
                String role = JwtTokenProvider.getRoleFromToken(token);
                Integer tokenVer = JwtTokenProvider.getTokenVersionFromToken(token);

                if (userId == null || !userId.equals(immutableUserId) || tokenVer == null
                        || SecurityContextHolder.getContext().getAuthentication() != null) {
                    auditSecurityMutationFailure(request, userId, null, "SESSION_REAUTH_REQUIRED");
                    sendSessionReauthenticationRequiredResponse(response);
                    return;
                }

                AppUser user = appUserRepository.findById(userId).orElse(null);
                if (user == null || !Boolean.TRUE.equals(user.getActive())
                        || !Objects.equals(tokenVer, user.getTokenVersion())) {
                    auditSecurityMutationFailure(request, userId, user, "SESSION_REAUTH_REQUIRED");
                    sendSessionReauthenticationRequiredResponse(response);
                    return;
                }

                if (Boolean.TRUE.equals(user.getMustChangePassword()) && !isAllowedForMustChangePassword(request)) {
                    sendPasswordChangeRequiredResponse(response);
                    return;
                }

                String effectiveRole = user.getRole() != null ? user.getRole().name() : role;
                SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + effectiveRole);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userId, null, Collections.singletonList(authority));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (RuntimeException exception) {
                auditSecurityMutationFailure(request, null, null, "SESSION_REAUTH_REQUIRED");
                sendSessionReauthenticationRequiredResponse(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAllowedForMustChangePassword(HttpServletRequest request) {
        String method = request.getMethod();

        if ("OPTIONS".equalsIgnoreCase(method)) {
            return true;
        }

        String path = request.getServletPath();
        if (path == null || path.isEmpty()) {
            path = request.getRequestURI();
        }
        if (path == null) {
            return false;
        }

        int queryIndex = path.indexOf('?');
        if (queryIndex != -1) {
            path = path.substring(0, queryIndex);
        }

        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        if (path.equals("/api/v1/auth/login") || path.endsWith("/auth/login")
                || path.equals("/api/v1/auth/first-boot-status") || path.endsWith("/auth/first-boot-status")
                || path.equals("/api/v1/auth/first-boot-admin") || path.endsWith("/auth/first-boot-admin")) {
            return true;
        }

        if (path.startsWith("/v3/api-docs") || path.startsWith("/swagger-ui") || path.equals("/swagger-ui.html") || path.equals("/error") || path.endsWith("/error")) {
            return true;
        }

        if ("GET".equalsIgnoreCase(method) && (path.equals("/api/v1/auth/me") || path.endsWith("/auth/me"))) {
            return true;
        }
        if ("POST".equalsIgnoreCase(method) && (path.equals("/api/v1/auth/password-change") || path.endsWith("/auth/password-change"))) {
            return true;
        }

        return false;
    }

    private void sendPasswordChangeRequiredResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"status\":403,\"error\":\"Forbidden\",\"code\":\"PASSWORD_CHANGE_REQUIRED\",\"message\":\"Password change required before accessing this resource\"}"
        );
    }

    private void sendSessionReauthenticationRequiredResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"code\":\"SESSION_REAUTH_REQUIRED\",\"message\":\"Session authentication must be renewed.\"}"
        );
    }

    private void auditSecurityMutationFailure(
            HttpServletRequest request,
            String userId,
            AppUser user,
            String reason) {
        String event = resolveSecurityMutationEvent(request.getRequestURI(), user);
        if (event == null) {
            return;
        }
        String deviceId = request.getHeader("X-Device-Id");
        String maskedDeviceId = deviceId != null && DEVICE_ID_PATTERN.matcher(deviceId).matches()
                ? maskDeviceId(deviceId)
                : "-";
        securityAuditLog.warn(
                "{} userId={} role={} device={} ip={} reason={}",
                event,
                userId != null ? userId : "-",
                user != null && user.getRole() != null ? user.getRole().name() : "-",
                maskedDeviceId,
                request.getRemoteAddr() != null ? request.getRemoteAddr() : "-",
                reason);
    }

    private String resolveSecurityMutationEvent(String requestUri, AppUser user) {
        if (requestUri == null) {
            return null;
        }
        if (requestUri.endsWith("/auth/password-change")) {
            return "PASSWORD_CHANGE_FAILURE";
        }
        if (requestUri.endsWith("/auth/verify-password")) {
            return "PASSWORD_VERIFY_FAILURE";
        }
        if (requestUri.endsWith("/auth/mobile-unbind")) {
            return "DEVICE_UNBIND_FAILURE";
        }
        if (requestUri.endsWith("/auth/mobile-setup-pin")) {
            return user != null && user.getPinHash() != null && !user.getPinHash().isBlank()
                    ? "PIN_ROTATION_FAILURE"
                    : "PIN_SETUP_FAILURE";
        }
        return null;
    }

    private String maskDeviceId(String deviceId) {
        int retainedLength = deviceId.length() >= 8 ? 8 : Math.min(4, deviceId.length());
        return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                + deviceId.substring(deviceId.length() - retainedLength);
    }

    private boolean isPublicAuthenticationRequest(HttpServletRequest request) {
        String path = request.getServletPath();
        if (path == null || path.isEmpty()) {
            path = request.getRequestURI();
        }
        if (path == null) {
            return false;
        }
        int queryIndex = path.indexOf('?');
        if (queryIndex >= 0) {
            path = path.substring(0, queryIndex);
        }
        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path.equals("/api/v1/auth/login") || path.endsWith("/auth/login")
                || path.equals("/api/v1/auth/mobile-login") || path.endsWith("/auth/mobile-login")
                || path.equals("/api/v1/auth/mobile-pin-login") || path.endsWith("/auth/mobile-pin-login")
                || path.equals("/api/v1/auth/mobile-pin-status") || path.endsWith("/auth/mobile-pin-status")
                || path.equals("/api/v1/auth/first-boot-status") || path.endsWith("/auth/first-boot-status")
                || path.equals("/api/v1/auth/first-boot-admin") || path.endsWith("/auth/first-boot-admin");
    }

    private boolean isSseStreamRequest(HttpServletRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String servletPath = request.getServletPath();
        if (servletPath != null && (servletPath.equals("/api/v1/events/stream") || servletPath.endsWith("/events/stream"))) {
            return true;
        }
        String requestUri = request.getRequestURI();
        return requestUri != null && (requestUri.equals("/api/v1/events/stream") || requestUri.endsWith("/api/v1/events/stream"));
    }
}
