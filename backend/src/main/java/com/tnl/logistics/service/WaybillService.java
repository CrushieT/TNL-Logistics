package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.WaybillStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface WaybillService {

    void assertViewer(String actingUserId);

    List<WaybillShipmentOptionResponse> getShipmentOptions();

    Page<WaybillShipmentOptionResponse> getShipmentOptions(String search, Pageable pageable);

    Page<WaybillOptionResponse> getWaybillOptions(String search, WaybillStatus status, Pageable pageable);

    List<HaulerStaffOptionResponse> getHaulerStaffOptions();

    WaybillManifestResponse getManifestById(String waybillId);

    List<WaybillManifestResponse> getByShipmentId(String shipmentId);

    List<ParcelUnitResponse> getAvailableUnits(String shipmentId);

    WaybillManifestResponse generate(WaybillGenerationRequest request, String actingStaffUserId);

    WaybillManifestResponse sendToHauler(String waybillId, String actingStaffUserId);

    WaybillManifestResponse markSignedCompleted(String waybillId, WaybillStatusUpdateRequest request, String actingStaffUserId);

    Page<WaybillSummaryResponse> getWaybills(String search, WaybillStatus status, String hauler, Pageable pageable);
}
