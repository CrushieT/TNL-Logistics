package com.tnl.logistics.repository;

import com.tnl.logistics.model.Waybill;
import com.tnl.logistics.model.WaybillStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data Repository for Waybill entity.
 */
@Repository
public interface WaybillRepository extends JpaRepository<Waybill, String> {

    Optional<Waybill> findByShipment_ShipmentId(String shipmentId);

    @Query("SELECT w FROM Waybill w WHERE w.shipment.shipmentId IN :shipmentIds")
    List<Waybill> findByShipment_ShipmentIdIn(@Param("shipmentIds") Collection<String> shipmentIds);

    @Query(value = "SELECT w FROM Waybill w JOIN FETCH w.shipment s LEFT JOIN FETCH s.client c WHERE " +
           "(:search IS NULL OR LOWER(w.waybillId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.haulerName) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR w.status = :status) AND " +
           "(:hauler IS NULL OR LOWER(w.haulerName) = LOWER(:hauler))",
           countQuery = "SELECT COUNT(w) FROM Waybill w JOIN w.shipment s LEFT JOIN s.client c WHERE " +
           "(:search IS NULL OR LOWER(w.waybillId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.haulerName) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR w.status = :status) AND " +
           "(:hauler IS NULL OR LOWER(w.haulerName) = LOWER(:hauler))")
    Page<Waybill> searchWaybills(@Param("search") String search,
                                 @Param("status") WaybillStatus status,
                                 @Param("hauler") String hauler,
                                 Pageable pageable);

    long countByStatus(WaybillStatus status);

    List<Waybill> findAllByOrderByGeneratedAtDesc();
}
