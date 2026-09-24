package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.ShipmentSummaryResponse;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.SseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Service implementing real-time Server-Sent Events (SSE) streaming
 * and thread-safe client management for live dashboard updates.
 */
@Service
public class SseServiceImpl implements SseService {

    private static final Logger log = LoggerFactory.getLogger(SseServiceImpl.class);
    private static final Long SSE_TIMEOUT = 30 * 60 * 1000L; // 30 minutes

    private record SseClient(
            SseEmitter emitter,
            String userId,
            Integer tokenVersion,
            Long authDeadlineMillis
    ) {}

    private record AccountLookup(AppUserRepository.SseAuthorizationState user, boolean isUnavailable) {}

    @FunctionalInterface
    private interface ClientSender {
        void send(SseClient client) throws IOException;
    }

    private final AppUserRepository appUserRepository;
    private final Set<SseClient> clients = ConcurrentHashMap.newKeySet();
    private final Map<String, ReentrantReadWriteLock> authorizationLocks = new ConcurrentHashMap<>();

    public SseServiceImpl(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Override
    public SseEmitter registerClient(String userId, Integer tokenVersion, Long authDeadlineMillis) {
        if (userId == null || userId.isBlank() || tokenVersion == null || authDeadlineMillis == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User ID, token version, and authorization deadline are required.");
        }
        Lock readLock = lockForUser(userId).readLock();
        readLock.lock();
        try {
            long remaining = authDeadlineMillis - System.currentTimeMillis();
            if (remaining <= 0) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization deadline has expired.");
            }
            SseEmitter emitter = new SseEmitter(Math.min(SSE_TIMEOUT, remaining));
            SseClient client = new SseClient(emitter, userId, tokenVersion, authDeadlineMillis);

            emitter.onCompletion(() -> removeClient(client));
            emitter.onTimeout(() -> closeClient(client));
            emitter.onError((error) -> removeClient(client));
            clients.add(client);

            AccountLookup accountLookup = lookupAccount(userId);
            if (accountLookup.isUnavailable()) {
                closeClient(client);
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to verify SSE authorization.");
            }
            if (!isAuthorized(accountLookup.user(), tokenVersion) || System.currentTimeMillis() >= authDeadlineMillis) {
                closeClient(client);
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "SSE authorization is no longer valid.");
            }
            synchronized (client) {
                if (!clients.contains(client)) {
                    closeClient(client);
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SSE connection closed during registration.");
                }
                if (System.currentTimeMillis() >= authDeadlineMillis) {
                    closeClient(client);
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization deadline has expired.");
                }
                try {
                    Map<String, Object> handshake = new HashMap<>();
                    handshake.put("status", "CONNECTED");
                    handshake.put("message", "Real-time tracking stream active");
                    emitter.send(SseEmitter.event().name("INIT").data(handshake));
                } catch (Exception exception) {
                    closeClient(client);
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to establish SSE connection.", exception);
                }
            }
            return emitter;
        } finally {
            readLock.unlock();
        }
    }

    @Override
    public void closeStreamsForUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        Lock writeLock = lockForUser(userId).writeLock();
        writeLock.lock();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            doCloseStreamsForUser(userId);
                        } catch (RuntimeException exception) {
                            log.error("Could not close SSE streams after authorization change for user {}", userId, exception);
                        }
                    }

                    @Override
                    public void afterCompletion(int status) {
                        writeLock.unlock();
                    }
                });
            } catch (RuntimeException exception) {
                writeLock.unlock();
                throw exception;
            }
        } else {
            try {
                doCloseStreamsForUser(userId);
            } finally {
                writeLock.unlock();
            }
        }
    }

    private void doCloseStreamsForUser(String userId) {
        int closedCount = 0;
        for (SseClient client : clients) {
            if (userId.equals(client.userId())) {
                closeClient(client);
                closedCount++;
            }
        }
        if (closedCount > 0) {
            log.info("Closed {} active SSE streams for user {}", closedCount, userId);
        }
    }

    @Override
    public void broadcastEvent(String eventName, Object data) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            doBroadcast(eventName, data);
                        } catch (RuntimeException exception) {
                            log.error("Post-commit SSE broadcast failed for event {}", eventName, exception);
                        }
                    }
                });
                return;
            } catch (RuntimeException exception) {
                log.error("Could not schedule post-commit SSE broadcast for event {}", eventName, exception);
                return;
            }
        }
        try {
            doBroadcast(eventName, data);
        } catch (RuntimeException exception) {
            log.error("SSE broadcast failed for event {}", eventName, exception);
        }
    }

    private void doBroadcast(String eventName, Object data) {
        sendToAuthorizedClients(client -> client.emitter().send(SseEmitter.event().name(eventName).data(data)));
    }

    @Override
    public void broadcastTrackingScan(TrackingScanResponse response) {
        broadcastEvent("STATUS_UPDATE", response);
    }

    @Override
    public void broadcastShipmentCreated(ShipmentSummaryResponse shipment) {
        broadcastEvent("SHIPMENT_CREATED", shipment);
    }

    @Override
    public void broadcastLabelPrint(String shipmentId, List<String> trackingIds) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("shipmentId", shipmentId);
        payload.put("trackingIds", trackingIds);
        broadcastEvent("LABEL_PRINTED", payload);
    }

    @Override
    public void broadcastPaymentRecorded(Object payment) {
        broadcastEvent("PAYMENT_RECORDED", payment);
    }

    @Scheduled(fixedRate = 20000)
    @Override
    public void sendHeartbeat() {
        if (clients.isEmpty()) {
            return;
        }
        sendToAuthorizedClients(client -> client.emitter().send(SseEmitter.event().comment("keepalive")));
    }

    private void sendToAuthorizedClients(ClientSender sender) {
        Map<String, List<SseClient>> clientsByUser = new HashMap<>();
        for (SseClient client : clients) {
            clientsByUser.computeIfAbsent(client.userId(), ignored -> new ArrayList<>()).add(client);
        }
        for (Map.Entry<String, List<SseClient>> entry : clientsByUser.entrySet()) {
            Lock readLock = lockForUser(entry.getKey()).readLock();
            readLock.lock();
            try {
                AccountLookup accountLookup = null;
                for (SseClient client : entry.getValue()) {
                    if (!clients.contains(client)) {
                        continue;
                    }
                    if (System.currentTimeMillis() >= client.authDeadlineMillis()) {
                        closeClient(client);
                        continue;
                    }
                    if (accountLookup == null) {
                        accountLookup = lookupAccount(entry.getKey());
                    }
                    if (accountLookup.isUnavailable()) {
                        continue;
                    }
                    if (!isAuthorized(accountLookup.user(), client.tokenVersion())) {
                        closeClient(client);
                        continue;
                    }
                    synchronized (client) {
                        if (!clients.contains(client)) {
                            continue;
                        }
                        if (System.currentTimeMillis() >= client.authDeadlineMillis()) {
                            closeClient(client);
                            continue;
                        }
                        try {
                            sender.send(client);
                        } catch (Exception exception) {
                            closeClient(client);
                        }
                    }
                }
            } finally {
                readLock.unlock();
            }
        }
    }

    private ReentrantReadWriteLock lockForUser(String userId) {
        return authorizationLocks.computeIfAbsent(userId, ignored -> new ReentrantReadWriteLock(true));
    }

    private AccountLookup lookupAccount(String userId) {
        try {
            return new AccountLookup(appUserRepository.findSseAuthorizationState(userId).orElse(null), false);
        } catch (RuntimeException exception) {
            log.warn("SSE account lookup failed for user {}", userId, exception);
            return new AccountLookup(null, true);
        }
    }

    private boolean isAuthorized(AppUserRepository.SseAuthorizationState user, Integer tokenVersion) {
        return user != null && Boolean.TRUE.equals(user.getActive())
                && Objects.equals(user.getTokenVersion(), tokenVersion)
                && user.getRole() != null && isAllowedSseRole(user.getRole());
    }

    private void closeClient(SseClient client) {
        synchronized (client) {
            clients.remove(client);
            try {
                client.emitter().complete();
            } catch (Exception ignored) {}
        }
    }

    private void removeClient(SseClient client) {
        synchronized (client) {
            clients.remove(client);
        }
    }

    private boolean isAllowedSseRole(UserRole role) {
        return role == UserRole.ADMIN || role == UserRole.OFFICE_STAFF || role == UserRole.FIELD_STAFF;
    }

    public int getActiveClientCount() {
        return clients.size();
    }
}
