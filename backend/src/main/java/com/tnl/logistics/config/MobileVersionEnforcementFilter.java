package com.tnl.logistics.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.MobileAppVersionDto;
import com.tnl.logistics.service.SystemSettingService;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Filter that intercepts incoming HTTP requests from mobile applications,
 * validates X-App-Version-Code against min_mobile_version_code policy,
 * and responds with HTTP 426 Upgrade Required before controllers execute.
 */
public class MobileVersionEnforcementFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(MobileVersionEnforcementFilter.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static final String HEADER_VERSION_CODE = "X-App-Version-Code";
    public static final String HEADER_PLATFORM = "X-App-Platform";
    public static final String HEADER_MIN_VERSION = "X-Min-App-Version-Code";

    private final SystemSettingService systemSettingService;

    public MobileVersionEnforcementFilter(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // 1. Bypass CORS pre-flight requests
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Bypass internal async and error dispatches
        if (DispatcherType.ASYNC.equals(request.getDispatcherType())
                || DispatcherType.ERROR.equals(request.getDispatcherType())) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Bypass Swagger, OpenAPI, and the mobile version check endpoint itself
        String requestUri = request.getRequestURI();
        if (isExemptPath(requestUri)) {
            filterChain.doFilter(request, response);
            return;
        }

        String versionCodeHeader = request.getHeader(HEADER_VERSION_CODE);
        String platformHeader = request.getHeader(HEADER_PLATFORM);

        // 4. If neither version code nor mobile platform is present, treat as non-mobile web traffic
        if ((versionCodeHeader == null || versionCodeHeader.isBlank())
                && (platformHeader == null || (!platformHeader.equalsIgnoreCase("android") && !platformHeader.equalsIgnoreCase("ios")))) {
            filterChain.doFilter(request, response);
            return;
        }

        MobileAppVersionDto policy = systemSettingService.getCachedMobileVersionPolicy();
        boolean isForceUpdate = policy != null && Boolean.TRUE.equals(policy.getForceUpdate());
        int minVersionCode = (policy != null && policy.getMinSupportedVersionCode() != null)
                ? policy.getMinSupportedVersionCode()
                : 1;

        // If force update is disabled, permit all traffic through
        if (!isForceUpdate) {
            filterChain.doFilter(request, response);
            return;
        }

        // 5. Handle missing version code from an explicitly declared mobile platform
        if (versionCodeHeader == null || versionCodeHeader.isBlank()) {
            if (minVersionCode > 1) {
                log.warn("Blocking unversioned mobile request to {} from platform {} (min required: {})",
                        requestUri, platformHeader, minVersionCode);
                sendUpgradeRequiredResponse(response, minVersionCode, 0, policy != null ? policy.getApkDownloadUrl() : null);
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        // 6. Parse and evaluate version code
        int clientVersionCode;
        try {
            clientVersionCode = Integer.parseInt(versionCodeHeader.trim());
        } catch (NumberFormatException e) {
            log.warn("Rejecting request with malformed {} header: {}", HEADER_VERSION_CODE, versionCodeHeader);
            sendBadRequestResponse(response, "Invalid " + HEADER_VERSION_CODE + " header format: must be an integer.");
            return;
        }

        if (clientVersionCode < minVersionCode) {
            log.warn("Blocking outdated mobile request to {} (client version: {}, min required: {})",
                    requestUri, clientVersionCode, minVersionCode);
            sendUpgradeRequiredResponse(response, minVersionCode, clientVersionCode, policy != null ? policy.getApkDownloadUrl() : null);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isExemptPath(String path) {
        if (path == null) return false;
        return path.equals("/api/v1/settings/mobile-version")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/swagger-ui")
                || path.equals("/error");
    }

    private void sendUpgradeRequiredResponse(HttpServletResponse response, int minVersionCode, int clientVersionCode, String apkDownloadUrl)
            throws IOException {
        response.setStatus(HttpStatus.UPGRADE_REQUIRED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HEADER_MIN_VERSION, String.valueOf(minVersionCode));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.UPGRADE_REQUIRED.value());
        body.put("error", "Upgrade Required");
        body.put("message", "The mobile application version is no longer supported. Please update to continue.");
        body.put("minVersionCode", minVersionCode);
        body.put("clientVersionCode", clientVersionCode);
        body.put("apkDownloadUrl", apkDownloadUrl);
        body.put("timestamp", Instant.now().toString());

        response.getWriter().write(objectMapper.writeValueAsString(body));
        response.getWriter().flush();
    }

    private void sendBadRequestResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.BAD_REQUEST.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Bad Request");
        body.put("message", message);
        body.put("timestamp", Instant.now().toString());

        response.getWriter().write(objectMapper.writeValueAsString(body));
        response.getWriter().flush();
    }
}
