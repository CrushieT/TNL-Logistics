package com.tnl.logistics.repository;

import com.tnl.logistics.model.WeeklyCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WeeklyCollectionRepository extends JpaRepository<WeeklyCollection, String> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM WeeklyCollection c WHERE c.client.clientId = :clientId AND c.collectionDate = :collectionDate")
    Optional<WeeklyCollection> findByClientAndCollectionDateForUpdate(
            @org.springframework.data.repository.query.Param("clientId") String clientId,
            @org.springframework.data.repository.query.Param("collectionDate") LocalDate collectionDate);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM WeeklyCollection c WHERE c.collectionId = :id")
    Optional<WeeklyCollection> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") String id);

    Optional<WeeklyCollection> findByClient_ClientIdAndCollectionDate(String clientId, LocalDate collectionDate);
}
