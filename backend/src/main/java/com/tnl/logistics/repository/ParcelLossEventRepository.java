package com.tnl.logistics.repository;
import com.tnl.logistics.model.ParcelLossEvent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ParcelLossEventRepository extends JpaRepository<ParcelLossEvent, Long> {
    Optional<ParcelLossEvent> findByRequestId(String requestId);
    List<ParcelLossEvent> findByTrackingIdOrderByEventIdAsc(String trackingId);
}
