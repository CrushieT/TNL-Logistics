package com.tnl.logistics.repository;

import com.tnl.logistics.model.MobileDeviceBinding;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MobileDeviceBindingRepository extends JpaRepository<MobileDeviceBinding, Long> {

    Optional<MobileDeviceBinding> findByDeviceIdAndActiveTrue(String deviceId);

    List<MobileDeviceBinding> findByUserIdAndActiveTrue(String userId);

    Optional<MobileDeviceBinding> findByDeviceIdAndUserIdAndActiveTrue(String deviceId, String userId);

    Optional<MobileDeviceBinding> findByDeviceId(String deviceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select binding from MobileDeviceBinding binding
            where binding.deviceId = :deviceId
              and binding.userId = :userId
            """)
    Optional<MobileDeviceBinding> findByDeviceIdAndUserIdForUpdate(
            @Param("deviceId") String deviceId,
            @Param("userId") String userId);
}
