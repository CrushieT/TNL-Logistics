package com.tnl.logistics.model;

/**
 * Discriminator for field staff specializations:
 * INTERNAL_TRUCK: Operates TNL company vehicles (VH-XXX) for local pickup and warehouse hub transfers.
 * HAULER_STAFF: 3rd-party hauler staff responsible for long-haul cargo transit and collecting signed POD manifests.
 */
public enum StaffType {
    INTERNAL_TRUCK,
    HAULER_STAFF
}
