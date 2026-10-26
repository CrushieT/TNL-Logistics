package com.tnl.logistics.repository;
import com.tnl.logistics.model.ParcelExceptionCommand;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ParcelExceptionCommandRepository extends JpaRepository<ParcelExceptionCommand, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ParcelExceptionCommand c where c.requestId = :id")
    Optional<ParcelExceptionCommand> findLocked(@Param("id") String id);
}
