package com.tnl.logistics.repository;

import com.tnl.logistics.model.SoaBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SoaBatchRepository extends JpaRepository<SoaBatch, String> {
    Optional<SoaBatch> findByCollection_CollectionId(String collectionId);
}
