package com.tnl.logistics.repository;

import com.tnl.logistics.model.ParcelUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data Repository for ParcelUnit entity.
 */
@Repository
public interface ParcelUnitRepository extends JpaRepository<ParcelUnit, String> {
}
