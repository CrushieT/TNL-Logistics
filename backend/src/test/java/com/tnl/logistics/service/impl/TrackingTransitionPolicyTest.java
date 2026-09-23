package com.tnl.logistics.service.impl;

import com.tnl.logistics.model.ParcelStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TrackingTransitionPolicyTest {
    private final TrackingTransitionPolicy policy = new TrackingTransitionPolicy(null);

    @Test
    void appliesOnlyTheNextTransition() {
        assertEquals(TrackingTransitionPolicy.DecisionKind.APPLY,
                policy.decide(ParcelStatus.QR_GENERATED, ParcelStatus.LOADED_ON_TRUCK, null, "VH-001").kind());
        assertEquals(TrackingTransitionPolicy.DecisionKind.INVALID_TRANSITION,
                policy.decide(ParcelStatus.REGISTERED, ParcelStatus.LOADED_ON_TRUCK, null, "VH-001").kind());
        assertEquals(TrackingTransitionPolicy.DecisionKind.STALE_STATE,
                policy.decide(ParcelStatus.ARRIVED_AT_TNL, ParcelStatus.LOADED_ON_TRUCK, null, "VH-001").kind());
    }

    @Test
    void treatsSameVehicleAsAppliedAndDifferentVehicleAsConflict() {
        assertEquals(TrackingTransitionPolicy.DecisionKind.ALREADY_APPLIED,
                policy.decide(ParcelStatus.LOADED_ON_TRUCK, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "VH-001").kind());
        assertEquals(TrackingTransitionPolicy.DecisionKind.VEHICLE_MISMATCH,
                policy.decide(ParcelStatus.LOADED_ON_TRUCK, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "VH-002").kind());
    }
}
