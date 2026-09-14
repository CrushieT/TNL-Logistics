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
