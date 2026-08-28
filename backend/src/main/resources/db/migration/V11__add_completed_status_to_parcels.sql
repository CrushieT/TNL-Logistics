-- ============================================================
-- Migration V11: Add COMPLETED status to parcel tracking flow
-- ============================================================

ALTER TABLE parcel_unit
    MODIFY COLUMN current_status ENUM(
        'REGISTERED',
        'QR_GENERATED',
        'LOADED_ON_TRUCK',
        'ARRIVED_AT_TNL',
        'LOADED_TO_HAULER',
        'COMPLETED'
    ) NOT NULL DEFAULT 'REGISTERED';

ALTER TABLE tracking_event
    MODIFY COLUMN status ENUM(
        'REGISTERED',
        'QR_GENERATED',
        'LOADED_ON_TRUCK',
        'ARRIVED_AT_TNL',
        'LOADED_TO_HAULER',
        'COMPLETED'
    ) NOT NULL;
