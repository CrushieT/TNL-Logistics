package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.ShipmentSummaryResponse;
import com.tnl.logistics.dto.TrackingScanResponse;
import com.tnl.logistics.service.SseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service implementing real-time Server-Sent Events (SSE) streaming,
 * thread-safe client management, and periodic keep-alive heartbeats.
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
            log.debug("SSE connection completed for user: {}", username);
            emitters.remove(emitter);
        });

        emitter.onTimeout(() -> {
            log.debug("SSE connection timed out for user: {}", username);
            emitters.remove(emitter);
        });

        emitter.onError((e) -> {
            log.debug("SSE connection error for user: {}: {}", username, e.getMessage());
            emitters.remove(emitter);
        });

        emitters.add(emitter);

        // Send initial connected handshake event
        try {
            Map<String, Object> handshake = new HashMap<>();
            handshake.put("status", "CONNECTED");
            handshake.put("message", "Real-time tracking stream active");
            emitter.send(SseEmitter.event().name("INIT").data(handshake));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    @Override
    public void broadcastEvent(String eventName, Object data) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
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

    /**
     * Send keep-alive heartbeats every 25 seconds to prevent intermediate proxy timeouts.
     */
    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        if (emitters.isEmpty()) return;

        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }
        emitters.removeAll(deadEmitters);
    }
}
