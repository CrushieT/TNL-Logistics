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

    Optional<Soa> findByClient_ClientIdAndStatementDate(String clientId, LocalDate statementDate);

    @Query("SELECT s FROM Soa s LEFT JOIN FETCH s.client WHERE s.statementDate = :statementDate")
    java.util.List<Soa> findByStatementDate(@Param("statementDate") LocalDate statementDate);

    @Query("SELECT s FROM Soa s LEFT JOIN FETCH s.client WHERE s.statementDate >= :startDate AND s.statementDate <= :endDate")
    java.util.List<Soa> findByStatementDateBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT MAX(s.soaNo) FROM Soa s WHERE s.soaNo LIKE :prefix")
    Optional<String> findMaxSoaNoWithPrefix(@Param("prefix") String prefix);

    @Query("SELECT DISTINCT s.statementDate FROM Soa s WHERE s.statementDate IS NOT NULL ORDER BY s.statementDate DESC")
    java.util.List<LocalDate> findDistinctStatementDates();
}
