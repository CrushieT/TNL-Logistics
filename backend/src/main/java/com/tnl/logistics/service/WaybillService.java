package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.WaybillStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface WaybillService {

    List<WaybillShipmentOptionResponse> getShipmentOptions();

    List<HaulerStaffOptionResponse> getHaulerStaffOptions();

    WaybillManifestResponse getManifestByShipmentId(String shipmentId);

    WaybillManifestResponse sendToHauler(WaybillCreateRequest request, String actingStaffUsername);

    WaybillManifestResponse markSignedCompleted(String shipmentId, WaybillStatusUpdateRequest request, String actingStaffUsername);

    Page<WaybillSummaryResponse> getWaybills(String search, WaybillStatus status, String hauler, Pageable pageable);
}
