package com.tnl.logistics.repository;

import com.tnl.logistics.model.PrintEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrintEventRepository extends JpaRepository<PrintEvent, Long> {

    Optional<PrintEvent> findTopByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(String trackingId);

    List<PrintEvent> findByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(String trackingId);
}
