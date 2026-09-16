package com.tnl.logistics.repository;

import com.tnl.logistics.model.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for SystemSetting singleton entity.
 */
@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, Integer> {
}
