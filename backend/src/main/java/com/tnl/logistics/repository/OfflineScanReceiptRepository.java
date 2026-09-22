package com.tnl.logistics.repository;

import com.tnl.logistics.model.OfflineScanReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OfflineScanReceiptRepository extends JpaRepository<OfflineScanReceipt, String> {
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select receipt from OfflineScanReceipt receipt where receipt.clientEventId = :clientEventId")
    Optional<OfflineScanReceipt> findByClientEventIdForRecovery(@Param("clientEventId") String clientEventId);

    List<OfflineScanReceipt> findTop1000ByProcessedAtBeforeOrderByProcessedAtAsc(LocalDateTime cutoff);
}
