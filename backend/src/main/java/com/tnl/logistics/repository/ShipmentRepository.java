package com.tnl.logistics.repository;

import com.tnl.logistics.model.Shipment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for Shipment entity.
 */
@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, String> {

    @Query("SELECT MAX(s.shipmentId) FROM Shipment s WHERE s.shipmentId LIKE :prefix")
    Optional<String> findMaxShipmentIdWithPrefix(@Param("prefix") String prefix);

    @Query("SELECT s FROM Shipment s JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Shipment> searchShipments(@Param("search") String search, Pageable pageable);

    @Query(value = "SELECT s FROM Shipment s JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:paymentFilter IS NULL " +
           "  OR (:paymentFilter = 'PAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) >= s.totalAmount) " +
           "  OR (:paymentFilter = 'UNPAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) = 0) " +
           "  OR (:paymentFilter = 'PARTIAL' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) > 0 AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount)) " +
           "AND (:statusFilter IS NULL " +
           "  OR (:statusFilter = 'REGISTERED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.REGISTERED)) " +
           "  OR (:statusFilter = 'QR_GENERATED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.QR_GENERATED) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK, com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_ON_TRUCK' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'ARRIVED_AT_TNL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_TO_HAULER' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)) " +
           "  OR (:statusFilter = 'COMPLETED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)))",
           countQuery = "SELECT COUNT(s) FROM Shipment s JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(s.recipientContact) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:paymentFilter IS NULL " +
           "  OR (:paymentFilter = 'PAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) >= s.totalAmount) " +
           "  OR (:paymentFilter = 'UNPAID' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) = 0) " +
           "  OR (:paymentFilter = 'PARTIAL' AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) > 0 AND (SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.shipment = s) < s.totalAmount)) " +
           "AND (:statusFilter IS NULL " +
           "  OR (:statusFilter = 'REGISTERED' AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus != com.tnl.logistics.model.ParcelStatus.REGISTERED)) " +
           "  OR (:statusFilter = 'QR_GENERATED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.QR_GENERATED) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK, com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_ON_TRUCK' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL, com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'ARRIVED_AT_TNL' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.ARRIVED_AT_TNL) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus IN (com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER, com.tnl.logistics.model.ParcelStatus.COMPLETED))) " +
           "  OR (:statusFilter = 'LOADED_TO_HAULER' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.LOADED_TO_HAULER) AND NOT EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)) " +
           "  OR (:statusFilter = 'COMPLETED' AND EXISTS (SELECT pu FROM ParcelUnit pu WHERE pu.shipment = s AND pu.currentStatus = com.tnl.logistics.model.ParcelStatus.COMPLETED)))")
    Page<Shipment> searchShipmentsWithFilters(
            @Param("search") String search,
            @Param("statusFilter") String statusFilter,
            @Param("paymentFilter") String paymentFilter,
            Pageable pageable);

    @Query("SELECT s.client.clientId, COUNT(s), COALESCE(SUM(s.quantity), 0), COALESCE(SUM(s.totalAmount), 0) " +
           "FROM Shipment s WHERE s.client.clientId IN :clientIds GROUP BY s.client.clientId")
    List<Object[]> countAndSumShipmentsByClientIds(@Param("clientIds") Collection<String> clientIds);

    @Query("SELECT s.client.clientId, COALESCE(SUM(p.amountPaid), 0) " +
           "FROM Payment p JOIN p.shipment s WHERE s.client.clientId IN :clientIds GROUP BY s.client.clientId")
    List<Object[]> sumPaymentsByClientIds(@Param("clientIds") Collection<String> clientIds);

    long countByClient_ClientId(String clientId);

    List<Shipment> findByClient_ClientIdOrderByDateRegisteredDesc(String clientId);

    List<Shipment> findAllByOrderByDateRegisteredDesc();

    List<Shipment> findByDateRegisteredBetweenOrderByDateRegisteredDesc(java.time.LocalDateTime start, java.time.LocalDateTime end);

    List<Shipment> findByClient_ClientIdAndDateRegisteredBetween(String clientId, java.time.LocalDateTime start, java.time.LocalDateTime end);
}

