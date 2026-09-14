package com.tnl.logistics.model;

/**
 * Status of an archived legacy record pending human operator reconciliation.
 */
public enum ReconciliationStatus {
    PENDING_REVIEW,
    RECONCILED,
    IGNORED
}
