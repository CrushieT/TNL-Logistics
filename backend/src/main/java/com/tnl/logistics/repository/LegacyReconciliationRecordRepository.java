package com.tnl.logistics.repository;

import com.tnl.logistics.model.LegacyReconciliationRecord;
import com.tnl.logistics.model.ReconciliationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data Repository for LegacyReconciliationRecord entity.
 */
@Repository
public interface LegacyReconciliationRecordRepository extends JpaRepository<LegacyReconciliationRecord, Long> {

    List<LegacyReconciliationRecord> findByStatus(ReconciliationStatus status);

    List<LegacyReconciliationRecord> findBySourceTable(String sourceTable);

    long countByStatus(ReconciliationStatus status);
}
