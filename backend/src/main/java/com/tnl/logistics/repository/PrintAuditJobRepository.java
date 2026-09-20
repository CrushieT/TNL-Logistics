package com.tnl.logistics.repository;

import com.tnl.logistics.model.PrintAuditJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PrintAuditJobRepository extends JpaRepository<PrintAuditJob, String> {
}
