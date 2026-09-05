package com.tnl.logistics.repository;

import com.tnl.logistics.model.Payment;
import com.tnl.logistics.model.PaymentMethod;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * Spring Data Repository for Payment entity.
 */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByShipment_ShipmentId(String shipmentId);

    List<Payment> findByShipment_ShipmentIdOrderByRecordedAtDesc(String shipmentId);

    @Query("SELECT p FROM Payment p WHERE p.shipment.shipmentId IN :shipmentIds")
    List<Payment> findByShipment_ShipmentIdIn(@Param("shipmentIds") Collection<String> shipmentIds);

    @Query("SELECT p FROM Payment p JOIN p.shipment s LEFT JOIN s.client c " +
           "WHERE (:search IS NULL OR LOWER(s.shipmentId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(s.recipientName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "   OR LOWER(p.referenceNo) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:method IS NULL OR p.method = :method) " +
           "AND (:clientId IS NULL OR c.clientId = :clientId) " +
           "AND (:startDate IS NULL OR p.paymentDate >= :startDate) " +
           "AND (:endDate IS NULL OR p.paymentDate <= :endDate)")
    Page<Payment> searchPayments(@Param("search") String search,
                                 @Param("method") PaymentMethod method,
                                 @Param("clientId") String clientId,
                                 @Param("startDate") LocalDate startDate,
                                 @Param("endDate") LocalDate endDate,
                                 Pageable pageable);
}
