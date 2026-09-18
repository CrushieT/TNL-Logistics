package com.tnl.logistics.repository;

import com.tnl.logistics.model.MobileDeviceBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MobileDeviceBindingRepository extends JpaRepository<MobileDeviceBinding, Long> {

    Optional<MobileDeviceBinding> findByDeviceIdAndActiveTrue(String deviceId);

    List<MobileDeviceBinding> findByUserIdAndActiveTrue(String userId);

    Optional<MobileDeviceBinding> findByDeviceIdAndUserIdAndActiveTrue(String deviceId, String userId);

    Optional<MobileDeviceBinding> findByDeviceId(String deviceId);
}
