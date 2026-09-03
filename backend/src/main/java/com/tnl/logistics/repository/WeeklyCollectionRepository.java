package com.tnl.logistics.repository;

import com.tnl.logistics.model.WeeklyCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface WeeklyCollectionRepository extends JpaRepository<WeeklyCollection, String> {
    Optional<WeeklyCollection> findByClient_ClientIdAndCollectionDate(String clientId, LocalDate collectionDate);
}
