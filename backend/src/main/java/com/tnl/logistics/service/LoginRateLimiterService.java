package com.tnl.logistics.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service managing in-memory authentication rate limiting.
 * Enforces max failed attempts per window and applies cooldown blocks per client IP.
 * Uses lazy TTL eviction on access without background polling threads.
 */
@Service
public class LoginRateLimiterService {

    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final long BLOCK_DURATION_MS = 60_000L;
    public static final long WINDOW_DURATION_MS = 60_000L;
    private static final int MAX_TRACKED_IPS = 100;

    private static class IpAttemptState {
        final int failedCount;
        final long firstAttemptTime;
        final long blockedUntil;

        IpAttemptState(int failedCount, long firstAttemptTime, long blockedUntil) {
            this.failedCount = failedCount;
            this.firstAttemptTime = firstAttemptTime;
            this.blockedUntil = blockedUntil;
        }
    }

    private final ConcurrentHashMap<String, IpAttemptState> attemptsByIp = new ConcurrentHashMap<>();

    /**
     * Checks if the client IP is currently blocked from logging in.
     * Expired blocks and stale windows are lazily evicted on-demand.
     */
    public boolean isBlocked(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return false;
        }

        IpAttemptState state = attemptsByIp.get(clientIp);
        if (state == null) {
            return false;
        }

        long now = System.currentTimeMillis();

        if (state.blockedUntil > now) {
            return true;
        }

        if (state.blockedUntil > 0 && state.blockedUntil <= now) {
            attemptsByIp.remove(clientIp);
            return false;
        }

        if (now - state.firstAttemptTime > WINDOW_DURATION_MS) {
            attemptsByIp.remove(clientIp);
            return false;
        }

        return false;
    }

    /**
     * Returns remaining block duration in seconds for a blocked client IP.
     */
    public long getRemainingBlockSeconds(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return 0;
        }

        IpAttemptState state = attemptsByIp.get(clientIp);
        if (state == null || state.blockedUntil <= 0) {
            return 0;
        }

        long remainingMs = state.blockedUntil - System.currentTimeMillis();
        return remainingMs > 0 ? (remainingMs + 999) / 1000 : 0;
    }

    /**
     * Records an authentication failure for the specified client IP.
     * Applies cooldown block if failure count reaches threshold.
     */
    public void recordFailure(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return;
        }

        if (attemptsByIp.size() > MAX_TRACKED_IPS) {
            pruneExpiredEntries();
        }

        long now = System.currentTimeMillis();

        attemptsByIp.compute(clientIp, (ip, state) -> {
            if (state == null || (now - state.firstAttemptTime > WINDOW_DURATION_MS && state.blockedUntil <= now)) {
                return new IpAttemptState(1, now, 0);
            }

            int newCount = state.failedCount + 1;
            long blockedUntil = 0;
            if (newCount >= MAX_FAILED_ATTEMPTS) {
                blockedUntil = now + BLOCK_DURATION_MS;
            }

            return new IpAttemptState(newCount, state.firstAttemptTime, blockedUntil);
        });
    }

    /**
     * Clears failure tracking for the client IP upon successful authentication.
     */
    public void recordSuccess(String clientIp) {
        if (clientIp != null && !clientIp.isBlank()) {
            attemptsByIp.remove(clientIp);
        }
    }

    /**
     * Resets all tracking. Primarily used for unit and integration testing.
     */
    public void reset() {
        attemptsByIp.clear();
    }

    /**
     * Prunes expired records when map size exceeds ceiling.
     */
    private void pruneExpiredEntries() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, IpAttemptState> entry : attemptsByIp.entrySet()) {
            IpAttemptState state = entry.getValue();
            if (state.blockedUntil <= now && (now - state.firstAttemptTime > WINDOW_DURATION_MS)) {
                attemptsByIp.remove(entry.getKey(), state);
            }
        }
    }
}
