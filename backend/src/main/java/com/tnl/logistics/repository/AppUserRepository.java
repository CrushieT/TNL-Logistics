package com.tnl.logistics.repository;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for AppUser entity.
 */
@Repository
public interface AppUserRepository extends JpaRepository<AppUser, String> {

    Optional<AppUser> findByUsername(String username);

    List<AppUser> findByStaffTypeAndActiveTrue(com.tnl.logistics.model.StaffType staffType);

    List<AppUser> findByRoleAndActiveTrue(UserRole role);

    boolean existsByRole(UserRole role);

    // Paginated list — all statuses, filtered by role membership
    Page<AppUser> findByRoleInOrderByUserIdAsc(List<UserRole> roles, Pageable pageable);

    // Paginated list — filtered by role and active status
    Page<AppUser> findByActiveAndRoleInOrderByUserIdAsc(Boolean active, List<UserRole> roles, Pageable pageable);

    // Sequential ID generation: find the highest U-NNN style user ID
    @Query("SELECT MAX(u.userId) FROM AppUser u WHERE u.userId LIKE :prefix")
    Optional<String> findMaxUserIdWithPrefix(@Param("prefix") String prefix);

    // Smart-delete data checks
    @Query("SELECT COUNT(t) FROM TrackingEvent t WHERE t.staff.userId = :userId")
    long countTrackingEventsByStaff(@Param("userId") String userId);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.staff.userId = :userId")
    long countPaymentsByStaff(@Param("userId") String userId);

    @Query("SELECT COUNT(w) FROM Waybill w WHERE w.generatedBy.userId = :userId")
    long countWaybillsByStaff(@Param("userId") String userId);

    @Query("SELECT COUNT(b) FROM SoaBatch b WHERE b.generatedBy.userId = :userId")
    long countSoaBatchesByStaff(@Param("userId") String userId);

    @Query("SELECT COUNT(p) FROM PrintEvent p WHERE p.staff.userId = :userId")
    long countPrintEventsByStaff(@Param("userId") String userId);
}
