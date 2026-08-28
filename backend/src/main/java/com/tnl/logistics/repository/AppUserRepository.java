package com.tnl.logistics.repository;

import com.tnl.logistics.model.AppUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data Repository for AppUser entity.
 */
@Repository
public interface AppUserRepository extends JpaRepository<AppUser, String> {
    Optional<AppUser> findByUsername(String username);
    java.util.List<AppUser> findByStaffTypeAndActiveTrue(com.tnl.logistics.model.StaffType staffType);
    java.util.List<AppUser> findByRoleAndActiveTrue(com.tnl.logistics.model.UserRole role);
}
