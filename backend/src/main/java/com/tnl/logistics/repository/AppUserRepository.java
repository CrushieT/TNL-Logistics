package com.tnl.logistics.repository;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for AppUser entity.
 */
@Repository
public interface AppUserRepository extends JpaRepository<AppUser, String> {

    interface SseAuthorizationState {
        Boolean getActive();
        UserRole getRole();
        Integer getTokenVersion();
    }

    Optional<AppUser> findByUsername(String username);

    @Transactional(readOnly = true)
    @Query("select user.active as active, user.role as role, user.tokenVersion as tokenVersion "
            + "from AppUser user where user.userId = :userId")
    Optional<SseAuthorizationState> findSseAuthorizationState(@Param("userId") String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from AppUser user where user.userId = :userId")
    Optional<AppUser> findByIdForUpdate(@Param("userId") String userId);

    List<AppUser> findByRoleAndActiveTrue(UserRole role);


    boolean existsByRole(UserRole role);

    // Paginated list — all statuses, filtered by role membership
    Page<AppUser> findByRoleInOrderByUserIdAsc(List<UserRole> roles, Pageable pageable);

    // Paginated list — filtered by role and active status
    Page<AppUser> findByActiveAndRoleInOrderByUserIdAsc(Boolean active, List<UserRole> roles, Pageable pageable);

    @Query(value = """
            SELECT EXISTS(SELECT 1 FROM tracking_event WHERE staff_id = :userId)
                OR EXISTS(SELECT 1 FROM payment WHERE staff_id = :userId)
                OR EXISTS(SELECT 1 FROM waybill WHERE generated_by = :userId)
                OR EXISTS(SELECT 1 FROM waybill WHERE sent_by = :userId)
                OR EXISTS(SELECT 1 FROM waybill WHERE completed_by = :userId)
                OR EXISTS(SELECT 1 FROM soa_batch WHERE generated_by = :userId)
                OR EXISTS(SELECT 1 FROM print_event WHERE staff_id = :userId)
                OR EXISTS(SELECT 1 FROM print_audit_job WHERE staff_id = :userId)
                OR EXISTS(SELECT 1 FROM waybill_return_scan WHERE scanned_by = :userId)
                OR EXISTS(SELECT 1 FROM parcel_loss_event WHERE actor_id = :userId)
                OR EXISTS(SELECT 1 FROM parcel_exception_command WHERE actor_id = :userId)
                OR EXISTS(SELECT 1 FROM waybill_reconciliation_event WHERE actor_id = :userId)
            """, nativeQuery = true)
    long countAuditReferencePresence(@Param("userId") String userId);
}
