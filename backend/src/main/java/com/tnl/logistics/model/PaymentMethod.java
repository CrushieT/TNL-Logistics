package com.tnl.logistics.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Payment method used to pay for shipments.
 */
public enum PaymentMethod {
    CASH,
    BANK,
    GCASH,
    CHEQUE,
    OTHER;

    @JsonCreator
    public static PaymentMethod fromString(String value) {
        if (value == null || value.isBlank()) {
            return CASH;
        }
        String normalized = value.trim().toUpperCase().replace("-", "_").replace(" ", "_");
        if (normalized.equals("BANK") || normalized.equals("BANK_TRANSFER") || normalized.equals("BANKTRANSFER")) {
            return BANK;
        }
        if (normalized.equals("GCASH") || normalized.equals("G_CASH")) {
            return GCASH;
        }
        if (normalized.equals("CHEQUE") || normalized.equals("CHECK")) {
            return CHEQUE;
        }
        if (normalized.equals("CASH")) {
            return CASH;
        }
        if (normalized.equals("OTHER")) {
            return OTHER;
        }
        return CASH;
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
