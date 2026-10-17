package com.tnl.logistics.repository;

import com.tnl.logistics.model.Shipment;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for Shipment entity.
 */
@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, String> {

    // Match Java's trim and exact statement-ID membership rules in the aggregate.
    @Query(value = """
            SELECT c.client_id AS clientId, c.name AS clientName, c.contact_number AS contactNumber,
                   COUNT(*) AS shipmentsCount,
                   SUM(CASE WHEN s.statement_id IS NULL
                       OR REGEXP_LIKE(s.statement_id, CONCAT('^[', CHAR(0 USING utf8mb4), '-', CHAR(32 USING utf8mb4), ']*$')) THEN 1 ELSE 0 END) AS unbilledCount,
                   COALESCE(SUM(s.total_amount), 0) AS currentCharges,
                   COALESCE(SUM(payments.paid), 0) AS paid
            FROM shipment s
            JOIN client c ON c.client_id = s.client_id
            LEFT JOIN (
                SELECT p.shipment_id, SUM(p.amount_paid) AS paid
                FROM payment p
                JOIN shipment paid_shipment ON paid_shipment.shipment_id = p.shipment_id
                WHERE paid_shipment.date_registered BETWEEN :cycleStart AND :cycleEnd
                GROUP BY p.shipment_id
            ) payments ON payments.shipment_id = s.shipment_id
            WHERE s.date_registered BETWEEN :cycleStart AND :cycleEnd
              AND (s.statement_id IS NULL OR REGEXP_LIKE(s.statement_id, CONCAT('^[', CHAR(0 USING utf8mb4), '-', CHAR(32 USING utf8mb4), ']*$'))
                   OR EXISTS (SELECT 1 FROM soa cycle_soa
                              WHERE cycle_soa.soa_no = s.statement_id
                                AND BINARY cycle_soa.soa_no = BINARY s.statement_id
                                AND cycle_soa.statement_date = :statementDate))
            GROUP BY c.client_id, c.name, c.contact_number
            ORDER BY MAX(s.date_registered) DESC
            """, nativeQuery = true)
    List<ClientCollectionTotals> aggregateCollectionsByClient(
            @Param("cycleStart") java.time.LocalDateTime cycleStart,
            @Param("cycleEnd") java.time.LocalDateTime cycleEnd,
            @Param("statementDate") LocalDate statementDate);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Shipment s WHERE s.shipmentId = :id")
    Optional<Shipment> findByIdForUpdate(@Param("id") String id);

    @Query("SELECT s FROM Shipment s JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND LOWER(pu.trackingId) LIKE LOWER(CONCAT('%', :search, '%'))))")
    Page<Shipment> searchShipments(@Param("search") String search, Pageable pageable);

    @Query(value = "SELECT s FROM Shipment s JOIN FETCH s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND LOWER(pu.trackingId) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "AND (:paymentFilter IS NULL " +
           "  OR (:paymentFilter = 'PAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) >= s.totalAmount) " +
           "  OR (:paymentFilter = 'SETTLED' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount AND EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0)) " +
           "  OR (:paymentFilter = 'UNPAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) = 0 AND NOT EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0)) " +
           "  OR (:paymentFilter = 'PARTIAL' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) > 0 AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount AND NOT EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0))) " +
           "AND (:statusFilter IS NULL " +
           "  OR (:statusFilter = 'REGISTERED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.REGISTERED)) " +
           "  OR (:statusFilter = 'QR_GENERATED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.QR_GENERATED) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK, com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_ON_TRUCK' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'ARRIVED_AT_TNL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_TO_HAULER' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)) " +
           "  OR (:statusFilter = 'COMPLETED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "AND (:labelFilter IS NULL " +
           "  OR (:labelFilter = 'NEEDS_LABEL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.labelStatus = com.tnl.logistics.model.LabelStatus.NOT_PRINTED)) " +
           "  OR (:labelFilter = 'PRINTED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.labelStatus = com.tnl.logistics.model.LabelStatus.NOT_PRINTED))) " +
           "AND (:vehicleFilter IS NULL " +
           "  OR EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.lost = false AND (pu.currentVehicle.vehicleId = :vehicleFilter OR EXISTS (SELECT te FROM TrackingEvent te WHERE te.parcelUnit = pu AND te.vehicle.vehicleId = :vehicleFilter))))",
           countQuery = "SELECT COUNT(s) FROM Shipment s JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND LOWER(pu.trackingId) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "AND (:paymentFilter IS NULL " +
           "  OR (:paymentFilter = 'PAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) >= s.totalAmount) " +
           "  OR (:paymentFilter = 'SETTLED' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount AND EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0)) " +
           "  OR (:paymentFilter = 'UNPAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) = 0 AND NOT EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0)) " +
           "  OR (:paymentFilter = 'PARTIAL' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) > 0 AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount AND NOT EXISTS (SELECT soa FROM Soa soa WHERE soa.soaNo = s.statementId AND soa.outstandingBalance <= 0))) " +
           "AND (:statusFilter IS NULL " +
           "  OR (:statusFilter = 'REGISTERED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.REGISTERED)) " +
           "  OR (:statusFilter = 'QR_GENERATED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.QR_GENERATED) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK, com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_ON_TRUCK' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'ARRIVED_AT_TNL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_TO_HAULER' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)) " +
           "  OR (:statusFilter = 'COMPLETED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "AND (:labelFilter IS NULL " +
           "  OR (:labelFilter = 'NEEDS_LABEL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.labelStatus = com.tnl.logistics.model.LabelStatus.NOT_PRINTED)) " +
           "  OR (:labelFilter = 'PRINTED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.labelStatus = com.tnl.logistics.model.LabelStatus.NOT_PRINTED))) " +
           "AND (:vehicleFilter IS NULL " +
           "  OR EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.lost = false AND (pu.currentVehicle.vehicleId = :vehicleFilter OR EXISTS (SELECT te FROM TrackingEvent te WHERE te.parcelUnit = pu AND te.vehicle.vehicleId = :vehicleFilter))))")
    Page<Shipment> searchShipmentsWithFilters(
            @Param("search") String search,
            @Param("statusFilter") String statusFilter,
            @Param("paymentFilter") String paymentFilter,
            @Param("vehicleFilter") String vehicleFilter,
            @Param("labelFilter") String labelFilter,
            Pageable pageable);

    @Query("SELECT s.client.clientId, COUNT(s), COALESCE(SUM(s.quantity), 0), COALESCE(SUM(s.totalAmount), 0) " +
           "FROM Shipment s WHERE s.client.clientId IN :clientIds GROUP BY s.client.clientId")
    List<Object[]> countAndSumShipmentsByClientIds(@Param("clientIds") Collection<String> clientIds);

    @Query("SELECT s.client.clientId, COALESCE(SUM(p.amountPaid), 0) " +
           "FROM Payment p JOIN p.shipment s WHERE s.client.clientId IN :clientIds GROUP BY s.client.clientId")
    List<Object[]> sumPaymentsByClientIds(@Param("clientIds") Collection<String> clientIds);

    long countByClient_ClientId(String clientId);

    List<Shipment> findByClient_ClientIdOrderByDateRegisteredDesc(String clientId);

    @Query("SELECT s FROM Shipment s LEFT JOIN FETCH s.client ORDER BY s.dateRegistered DESC")
    List<Shipment> findAllByOrderByDateRegisteredDesc();

    @Query(value = "SELECT s FROM Shipment s LEFT JOIN FETCH s.client WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')))",
           countQuery = "SELECT COUNT(s) FROM Shipment s WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Shipment> findShipmentOptions(@Param("search") String search, Pageable pageable);

    @Query("SELECT s FROM Shipment s LEFT JOIN FETCH s.client WHERE s.dateRegistered >= :start AND s.dateRegistered <= :end ORDER BY s.dateRegistered DESC")
    List<Shipment> findByDateRegisteredBetweenOrderByDateRegisteredDesc(@Param("start") java.time.LocalDateTime start, @Param("end") java.time.LocalDateTime end);

    List<Shipment> findByClient_ClientIdAndDateRegisteredBetween(String clientId, java.time.LocalDateTime start, java.time.LocalDateTime end);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Shipment s WHERE s.client.clientId = :clientId " +
           "AND s.dateRegistered BETWEEN :start AND :end ORDER BY s.shipmentId")
    List<Shipment> findByClientAndCycleForUpdate(@Param("clientId") String clientId,
                                                 @Param("start") java.time.LocalDateTime start,
                                                 @Param("end") java.time.LocalDateTime end);

    @Query("SELECT DISTINCT CAST(s.dateRegistered AS LocalDate) FROM Shipment s WHERE s.dateRegistered IS NOT NULL")
    List<LocalDate> findDistinctRegistrationDates();

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.dateRegistered >= :startOfDay AND s.dateRegistered <= :endOfDay")
    long countShipmentsRegisteredBetween(@Param("startOfDay") java.time.LocalDateTime startOfDay, @Param("endOfDay") java.time.LocalDateTime endOfDay);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.totalAmount > (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s)")
    long countUnpaidShipments();

    @Query("SELECT FUNCTION('DATE', s.dateRegistered), COUNT(s) FROM Shipment s WHERE s.dateRegistered >= :startDate AND s.dateRegistered <= :endDate GROUP BY FUNCTION('DATE', s.dateRegistered)")
    List<Object[]> countDailyShipmentsBetween(@Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM Shipment s")
    java.math.BigDecimal sumTotalShipmentCharges();

    @Query("SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p")
    java.math.BigDecimal sumTotalPayments();

    @Query("SELECT COALESCE(SUM(s.quantity), 0) FROM Shipment s WHERE s.dateRegistered >= :cycleStart AND s.dateRegistered <= :cycleEnd")
    long countParcelsRegisteredBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.dateRegistered >= :cycleStart AND s.dateRegistered <= :cycleEnd AND s.totalAmount > (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s)")
    long countUnpaidShipmentsBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM Shipment s WHERE s.dateRegistered >= :cycleStart AND s.dateRegistered <= :cycleEnd")
    java.math.BigDecimal sumTotalShipmentChargesBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment.dateRegistered >= :cycleStart AND p.shipment.dateRegistered <= :cycleEnd")
    java.math.BigDecimal sumTotalPaymentsBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT COUNT(s) FROM Shipment s WHERE s.dateRegistered >= :cycleStart AND s.dateRegistered <= :cycleEnd AND (s.statementId IS NULL OR TRIM(s.statementId) = '')")
    long countUnbilledShipmentsBetween(@Param("cycleStart") java.time.LocalDateTime cycleStart, @Param("cycleEnd") java.time.LocalDateTime cycleEnd);

    @Query("SELECT DISTINCT CAST(s.dateRegistered AS LocalDate) FROM Shipment s WHERE s.dateRegistered IS NOT NULL AND (s.statementId IS NULL OR TRIM(s.statementId) = '')")
    List<LocalDate> findDistinctUnbilledRegistrationDates();

    @Query("SELECT s.shipmentId, c.clientId, c.name, c.contactNumber, s.dateRegistered, s.totalAmount, COALESCE(SUM(p.amountPaid), 0) " +
           "FROM Shipment s " +
           "JOIN s.client c " +
           "LEFT JOIN Payment p ON p.shipment = s " +
           "GROUP BY s.shipmentId, c.clientId, c.name, c.contactNumber, s.dateRegistered, s.totalAmount " +
           "HAVING s.totalAmount > COALESCE(SUM(p.amountPaid), 0)")
    List<Object[]> findUnpaidShipmentsWithPayments();

    @Query(value = """
            SELECT 
                unpaid.client_id AS clientId,
                unpaid.client_name AS clientName,
                unpaid.client_contact AS clientContact,
                COUNT(*) AS unpaidShipmentsCount,
                COALESCE(SUM(CASE WHEN DATEDIFF(:asOfDate, unpaid.date_registered) <= 7 THEN unpaid.balance ELSE 0 END), 0) AS currentDue,
                COALESCE(SUM(CASE WHEN DATEDIFF(:asOfDate, unpaid.date_registered) BETWEEN 8 AND 14 THEN unpaid.balance ELSE 0 END), 0) AS pastDue,
                COALESCE(SUM(CASE WHEN DATEDIFF(:asOfDate, unpaid.date_registered) > 14 THEN unpaid.balance ELSE 0 END), 0) AS overdue,
                COALESCE(SUM(unpaid.balance), 0) AS totalOutstanding,
                COALESCE(SUM(unpaid.paid), 0) AS openPaid
            FROM (
                SELECT 
                    s.client_id,
                    c.name AS client_name,
                    c.contact_number AS client_contact,
                    s.shipment_id,
                    s.date_registered,
                    s.total_amount,
                    COALESCE(p.paid, 0) AS paid,
                    (s.total_amount - COALESCE(p.paid, 0)) AS balance
                FROM shipment s
                JOIN client c ON c.client_id = s.client_id
                LEFT JOIN (
                    SELECT shipment_id, SUM(amount_paid) AS paid
                    FROM payment
                    GROUP BY shipment_id
                ) p ON p.shipment_id = s.shipment_id
                WHERE s.total_amount > COALESCE(p.paid, 0)
            ) unpaid
            GROUP BY unpaid.client_id, unpaid.client_name, unpaid.client_contact
            HAVING SUM(unpaid.balance) > 0
            ORDER BY totalOutstanding DESC
            """, nativeQuery = true)
    List<ClientAgingProjection> aggregateClientReceivablesAging(@Param("asOfDate") LocalDate asOfDate);

    @Query(value = """
            SELECT COUNT(*) AS totalShipments,
                   COALESCE(SUM(total_amount), 0) AS totalBilled
            FROM shipment
            WHERE date_registered BETWEEN :start AND :end
            """, nativeQuery = true)
    PeriodShipmentTotals getPeriodShipmentTotals(
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);

    @Query(value = """
            SELECT s.client_id AS clientId,
                   c.name AS clientName,
                   COUNT(*) AS totalShipments,
                   COALESCE(SUM(s.total_amount), 0) AS totalBilled
            FROM shipment s
            JOIN client c ON c.client_id = s.client_id
            WHERE s.date_registered BETWEEN :start AND :end
            GROUP BY s.client_id, c.name
            """, nativeQuery = true)
    List<ClientPeriodShipmentTotals> aggregateClientPeriodShipments(
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);

    @Query(value = """
            SELECT DATE(s.date_registered) AS regDate,
                   COUNT(*) AS shipmentsCount
            FROM shipment s
            WHERE s.date_registered BETWEEN :start AND :end
            GROUP BY DATE(s.date_registered)
            """, nativeQuery = true)
    List<DailyShipmentTotals> aggregateDailyShipments(
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);
}

