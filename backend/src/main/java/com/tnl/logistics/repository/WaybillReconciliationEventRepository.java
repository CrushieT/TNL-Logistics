package com.tnl.logistics.repository;
import com.tnl.logistics.model.WaybillReconciliationEvent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface WaybillReconciliationEventRepository extends JpaRepository<WaybillReconciliationEvent, Long> {
    Optional<WaybillReconciliationEvent> findByRequestId(String requestId);
    List<WaybillReconciliationEvent> findByWaybillIdOrderByEventIdAsc(String waybillId);
}
