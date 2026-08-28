package com.tnl.logistics.repository;

import com.tnl.logistics.model.Waybill;
import com.tnl.logistics.model.WaybillStatus;
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

    @Query("SELECT MAX(w.waybillId) FROM Waybill w WHERE w.waybillId LIKE :prefix")
    Optional<String> findMaxWaybillIdWithPrefix(@Param("prefix") String prefix);

    Optional<Waybill> findByShipment_ShipmentId(String shipmentId);

    @Query("SELECT w FROM Waybill w WHERE " +
           "(:search IS NULL OR LOWER(w.waybillId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.shipment.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.shipment.client.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.shipment.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
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
