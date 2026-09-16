package com.tnl.logistics.service;

import com.tnl.logistics.dto.ShipmentSummaryResponse;
import com.tnl.logistics.dto.TrackingScanResponse;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

public interface SseService {

    SseEmitter registerClient(String username);

    void broadcastEvent(String eventName, Object data);

    void broadcastTrackingScan(TrackingScanResponse response);

    void broadcastShipmentCreated(ShipmentSummaryResponse shipment);

    void broadcastLabelPrint(String shipmentId, List<String> trackingIds);

    void broadcastPaymentRecorded(Object payment);
}
