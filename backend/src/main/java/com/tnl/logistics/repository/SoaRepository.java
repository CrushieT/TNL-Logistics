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

    java.util.List<Soa> findByStatementDate(LocalDate statementDate);

    @Query("SELECT MAX(s.soaNo) FROM Soa s WHERE s.soaNo LIKE :prefix")
    Optional<String> findMaxSoaNoWithPrefix(@Param("prefix") String prefix);
}
