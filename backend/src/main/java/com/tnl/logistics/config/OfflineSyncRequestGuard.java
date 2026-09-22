package com.tnl.logistics.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class OfflineSyncRequestGuard extends OncePerRequestFilter {
    private static final String PATH = "/api/v1/tracking-events/offline-sync";
    private static final long MAX_BODY_BYTES = 64 * 1024;
    private final Map<String, Bucket> userBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> ipBuckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod()) || !PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "Offline sync request exceeds 64 KiB");
            return;
        }
        String contentType = request.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("application/json")) {
            response.sendError(HttpServletResponse.SC_UNSUPPORTED_MEDIA_TYPE, "Offline sync requires application/json");
            return;
        }
        String ip = request.getRemoteAddr();
        long retryAfter = consume(ipBuckets, "ip:" + (ip == null ? "unknown" : ip), 100, 100);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null) {
            retryAfter = Math.max(retryAfter, consume(userBuckets, "user:" + authentication.getName(), 20, 20));
        }
        if (retryAfter > 0) {
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"code\":\"OFFLINE_SYNC_RATE_LIMITED\",\"message\":\"Please retry later.\"}");
            return;
        }
        evictExpired(userBuckets);
        evictExpired(ipBuckets);
        byte[] body = readBoundedBody(request);
        if (body == null) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "Offline sync request exceeds 64 KiB");
            return;
        }
        chain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private byte[] readBoundedBody(HttpServletRequest request) throws IOException {
        try (ServletInputStream input = request.getInputStream()) {
            byte[] buffer = new byte[8_192];
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            int read;
            while ((read = input.read(buffer, 0, Math.min(buffer.length, (int) (MAX_BODY_BYTES + 1 - output.size())))) != -1) {
                output.write(buffer, 0, read);
                if (output.size() > MAX_BODY_BYTES) return null;
            }
            return output.toByteArray();
        }
    }

    private long consume(Map<String, Bucket> buckets, String key, int capacity, int refillPerMinute) {
        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(capacity));
        return bucket.consume(capacity, refillPerMinute);
    }

    private void evictExpired(Map<String, Bucket> buckets) {
        if (buckets.size() > 2_000) {
            long cutoff = System.nanoTime() - Duration.ofHours(1).toNanos();
            buckets.entrySet().removeIf(entry -> entry.getValue().lastAccessNanos < cutoff);
        }
    }

    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;
        private volatile long lastAccessNanos;
        private Bucket(int capacity) { tokens = capacity; lastRefillNanos = System.nanoTime(); lastAccessNanos = lastRefillNanos; }
        private synchronized long consume(int capacity, int refillPerMinute) {
            long now = System.nanoTime();
            tokens = Math.min(capacity, tokens + ((now - lastRefillNanos) / 1_000_000_000d) * (refillPerMinute / 60d));
            lastRefillNanos = now;
            lastAccessNanos = now;
            if (tokens >= 1d) { tokens -= 1d; return 0; }
            return Math.max(1, (long) Math.ceil((1d - tokens) / (refillPerMinute / 60d)));
        }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new CachedServletInputStream(body);
        }

        @Override
        public BufferedReader getReader() {
            Charset charset = Charset.forName(getCharacterEncoding() == null ? "UTF-8" : getCharacterEncoding());
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }

    private static final class CachedServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream input;

        private CachedServletInputStream(byte[] body) {
            this.input = new ByteArrayInputStream(body);
        }

        @Override
        public int read() {
            return input.read();
        }

        @Override
        public int read(byte[] buffer, int offset, int length) {
            return input.read(buffer, offset, length);
        }

        @Override
        public boolean isFinished() {
            return input.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            throw new UnsupportedOperationException("Async reads are not supported");
        }
    }
}
