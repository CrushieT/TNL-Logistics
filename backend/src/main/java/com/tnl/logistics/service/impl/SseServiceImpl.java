package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.ShipmentSummaryResponse;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.service.SseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service implementing real-time Server-Sent Events (SSE) streaming
 * and thread-safe client management for live dashboard updates.
 */
@Service
public class SseServiceImpl implements SseService {

    private static final Logger log = LoggerFactory.getLogger(SseServiceImpl.class);
    private static final Long SSE_TIMEOUT = 30 * 60 * 1000L; // 30 minutes

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @Override
    public SseEmitter registerClient(String username) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        emitter.onCompletion(() -> {
            emitters.remove(emitter);
        });

        emitter.onTimeout(() -> {
            try {
                emitter.complete();
            } catch (Exception ignored) {}
            emitters.remove(emitter);
        });

        emitter.onError((e) -> {
            emitters.remove(emitter);
        });

        emitters.add(emitter);

        // Send initial connected handshake event
        try {
            Map<String, Object> handshake = new HashMap<>();
            handshake.put("status", "CONNECTED");
            handshake.put("message", "Real-time tracking stream active");
            emitter.send(SseEmitter.event().name("INIT").data(handshake));
        } catch (Exception e) {
            try {
                emitter.complete();
            } catch (Exception ignored) {}
            emitters.remove(emitter);
        }

        return emitter;
    }

    @Override
    public void broadcastEvent(String eventName, Object data) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        doBroadcast(eventName, data);
                    }
                });
                return;
            } catch (Exception e) {
                log.warn("Failed to register post-commit synchronization for SSE event {}: {}", eventName, e.getMessage());
            }
        }
        doBroadcast(eventName, data);
    }

    private void doBroadcast(String eventName, Object data) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                try {
                    emitter.complete();
                } catch (Exception ignored) {}
                deadEmitters.add(emitter);
            }
        }

        emitters.removeAll(deadEmitters);
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
        if (emitters.isEmpty()) {
            return;
        }
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().comment("keepalive"));
            } catch (Exception e) {
                try {
                    emitter.complete();
                } catch (Exception ignored) {}
                deadEmitters.add(emitter);
            }
        }
        if (!deadEmitters.isEmpty()) {
            emitters.removeAll(deadEmitters);
            log.debug("Evicted {} disconnected SSE emitters during heartbeat. Active count: {}", deadEmitters.size(), emitters.size());
        }
    }
}
