package com.tnl.logistics.repository;

import com.tnl.logistics.model.Client;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data Repository for Client entity.
 */
@Repository
public interface ClientRepository extends JpaRepository<Client, String> {

    @Query("SELECT MAX(c.clientId) FROM Client c WHERE c.clientId LIKE :prefix")
    Optional<String> findMaxClientIdWithPrefix(@Param("prefix") String prefix);

    @Query("SELECT c FROM Client c WHERE " +
           "(:active IS NULL OR c.active = :active) AND " +
           "(:search IS NULL OR LOWER(c.clientId) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.contactNumber) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.address) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(COALESCE(c.email, '')) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Client> searchClients(@Param("search") String search, @Param("active") Boolean active, Pageable pageable);

    long countByActiveTrue();

    long countByActiveFalse();

    List<Client> findByActiveTrueOrderByClientIdAsc();

    List<Client> findAllByOrderByClientIdAsc();
}

