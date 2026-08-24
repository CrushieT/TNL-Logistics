package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Spring Data Repository for ParcelUnit entity.
 */
@Repository
public interface ParcelUnitRepository extends JpaRepository<ParcelUnit, String> {

    @Query("SELECT MAX(p.trackingId) FROM ParcelUnit p WHERE p.trackingId LIKE :prefix")
    Optional<String> findMaxTrackingIdWithPrefix(@Param("prefix") String prefix);
}
