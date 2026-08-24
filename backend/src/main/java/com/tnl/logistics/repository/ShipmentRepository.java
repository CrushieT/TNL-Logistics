package com.tnl.logistics.repository;

import com.tnl.logistics.model.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Spring Data Repository for Shipment entity.
 */
@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, String> {

    @Query("SELECT MAX(s.shipmentId) FROM Shipment s WHERE s.shipmentId LIKE :prefix")
    Optional<String> findMaxShipmentIdWithPrefix(@Param("prefix") String prefix);
}
