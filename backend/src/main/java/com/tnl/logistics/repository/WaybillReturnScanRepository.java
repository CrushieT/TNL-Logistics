package com.tnl.logistics.repository;

import com.tnl.logistics.model.WaybillReturnScan;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WaybillReturnScanRepository extends JpaRepository<WaybillReturnScan, Long> {
    List<WaybillReturnScan> findByWaybill_WaybillIdOrderByScannedAtAsc(String waybillId);
    boolean existsByWaybill_WaybillIdAndParcel_TrackingId(String waybillId, String trackingId);
}
