package com.tnl.logistics.config;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Objects;

/**
 * Filter that intercepts incoming HTTP requests, extracts JWT from the
 * Authorization header or query parameter, verifies that the user is active,
 * and signs the user into Spring Security context.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

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

        if (token != null && JwtTokenProvider.validateToken(token)) {
            String userId = JwtTokenProvider.getUserIdFromToken(token);
            String immutableUserId = JwtTokenProvider.getImmutableUserIdFromToken(token);
            String role = JwtTokenProvider.getRoleFromToken(token);
            Integer tokenVer = JwtTokenProvider.getTokenVersionFromToken(token);

            if (userId != null && userId.equals(immutableUserId) && tokenVer != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                var userOpt = appUserRepository.findById(userId);
                if (userOpt.isPresent() && Boolean.TRUE.equals(userOpt.get().getActive())) {
                    AppUser user = userOpt.get();
                    int currentVersion = user.getTokenVersion() != null ? user.getTokenVersion() : 1;
                    if (Objects.equals(tokenVer, currentVersion)) {
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
                    }
                }
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
