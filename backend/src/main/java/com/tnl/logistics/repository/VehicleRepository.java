package com.tnl.logistics.repository;

import com.tnl.logistics.model.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for Vehicle entity.
 */
@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, String> {

    List<Vehicle> findByActiveTrueOrderByVehicleIdAsc();

    List<Vehicle> findAllByOrderByVehicleIdAsc();

    Optional<Vehicle> findByPlateNumber(String plateNumber);

    Page<Vehicle> findByActiveTrue(Pageable pageable);

    @Query("SELECT v FROM Vehicle v WHERE v.active = true AND (" +
           "LOWER(v.vehicleId) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.plateNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(v.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Vehicle> findActiveVehicleOptions(@Param("search") String search, Pageable pageable);

}
