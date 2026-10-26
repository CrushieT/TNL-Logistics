package com.tnl.logistics.model;

/**
 * Access roles within the logistics system.
 */
public enum UserRole {
    ADMIN,
    RECEIVING_STAFF,
    COURIER_STAFF,
    DISPATCH_STAFF;

    public boolean isTargetRole() {
        return this == ADMIN
                || this == RECEIVING_STAFF
                || this == COURIER_STAFF
                || this == DISPATCH_STAFF;
    }

    public boolean isMobileStaffRole() {
        return this == RECEIVING_STAFF
                || this == COURIER_STAFF
                || this == DISPATCH_STAFF;
    }

    public boolean isAssignableStaffRole() {
        return isMobileStaffRole();
    }
}
