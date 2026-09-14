package com.tnl.logistics.repository;

import com.tnl.logistics.model.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
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

}
