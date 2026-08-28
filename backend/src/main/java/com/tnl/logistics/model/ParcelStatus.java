package com.tnl.logistics.model;

/**
 * 6-state parcel unit tracking flow:
 * REGISTERED -> QR_GENERATED -> LOADED_ON_TRUCK -> ARRIVED_AT_TNL -> LOADED_TO_HAULER -> COMPLETED
 */
public enum ParcelStatus {
    REGISTERED,
    QR_GENERATED,
    LOADED_ON_TRUCK,
    ARRIVED_AT_TNL,
    LOADED_TO_HAULER,
    COMPLETED
}
