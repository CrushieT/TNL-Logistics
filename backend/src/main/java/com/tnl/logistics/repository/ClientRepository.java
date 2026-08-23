package com.tnl.logistics.repository;

import com.tnl.logistics.model.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data Repository for Client entity.
 */
@Repository
public interface ClientRepository extends JpaRepository<Client, String> {
}
