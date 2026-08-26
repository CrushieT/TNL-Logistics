package com.tnl.logistics.model;

/**
 * 5-state parcel unit tracking flow.
 */
public enum ParcelStatus {
    REGISTERED,
    QR_GENERATED,
    LOADED_ON_TRUCK,
    ARRIVED_AT_TNL,
    LOADED_TO_HAULER
}
