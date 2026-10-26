package com.tnl.logistics.repository;

import com.tnl.logistics.model.Soa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface SoaRepository extends JpaRepository<Soa, String> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Soa s WHERE s.soaNo = :id")
    Optional<Soa> findByIdForUpdate(@Param("id") String id);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Soa s WHERE s.client.clientId = :clientId AND s.statementDate = :statementDate")
    Optional<Soa> findByClientAndStatementDateForUpdate(@Param("clientId") String clientId,
                                                      @Param("statementDate") LocalDate statementDate);

    Optional<Soa> findByClient_ClientIdAndStatementDate(String clientId, LocalDate statementDate);

    @Query("SELECT s FROM Soa s LEFT JOIN FETCH s.client WHERE s.statementDate = :statementDate")
    java.util.List<Soa> findByStatementDate(@Param("statementDate") LocalDate statementDate);

    @Query("SELECT s FROM Soa s LEFT JOIN FETCH s.client WHERE s.statementDate >= :startDate AND s.statementDate <= :endDate")
    java.util.List<Soa> findByStatementDateBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT MAX(s.soaNo) FROM Soa s WHERE s.soaNo LIKE :prefix")
    Optional<String> findMaxSoaNoWithPrefix(@Param("prefix") String prefix);

    @Query("SELECT DISTINCT s.statementDate FROM Soa s WHERE s.statementDate IS NOT NULL ORDER BY s.statementDate DESC")
    java.util.List<LocalDate> findDistinctStatementDates();

    @Query(value = """
            SELECT 
                CASE 
                    WHEN UPPER(COALESCE(s.deduction_reason, '')) LIKE '%BAD%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%DAMAGE%' THEN 'BAD_ORDER'
                    WHEN UPPER(COALESCE(s.deduction_reason, '')) LIKE '%DISCREPANCY%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%SHORT%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%WEIGHT%' THEN 'DISCREPANCY'
                    ELSE 'CLAIM'
                END AS category,
                COUNT(*) AS count,
                COALESCE(SUM(s.deductions), 0) AS totalAmount
            FROM soa s
            WHERE s.statement_date BETWEEN :startDate AND :endDate
              AND s.deductions > 0
            GROUP BY 
                CASE 
                    WHEN UPPER(COALESCE(s.deduction_reason, '')) LIKE '%BAD%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%DAMAGE%' THEN 'BAD_ORDER'
                    WHEN UPPER(COALESCE(s.deduction_reason, '')) LIKE '%DISCREPANCY%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%SHORT%' OR UPPER(COALESCE(s.deduction_reason, '')) LIKE '%WEIGHT%' THEN 'DISCREPANCY'
                    ELSE 'CLAIM'
                END
            """, nativeQuery = true)
    java.util.List<DeductionCategoryTotals> aggregateDeductionsBetween(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
