package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test verifying GET /api/v1/tracking-events audit log feed,
 * query filtering, metrics summary, and RBAC authorization boundaries.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class TrackingLogIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private com.tnl.logistics.service.ShipmentService shipmentService;

    @Autowired
    private com.tnl.logistics.service.TrackingService trackingService;

    @Autowired
    private com.tnl.logistics.repository.ClientRepository clientRepository;

    @Autowired
    private com.tnl.logistics.repository.VehicleRepository vehicleRepository;

    @Autowired
    private com.tnl.logistics.repository.TrackingEventRepository trackingEventRepository;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetTrackingLogsAsAdminReturns200AndPageStructure() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("page", "0")
                .param("size", "10")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page.totalElements").isNumber())
                .andExpect(jsonPath("$.page.totalPages").isNumber())
                .andExpect(jsonPath("$.page.size").value(10))
                .andExpect(jsonPath("$.page.number").value(0));
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testGetTrackingLogsAsOfficeStaffReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetTrackingLogsAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void testGetTrackingLogsUnauthenticatedReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetTrackingLogsWithStatusFilterReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events")
                .param("status", "LOADED_ON_TRUCK")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testGetTrackingMetricsAsAdminReturns200() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").isNumber())
                .andExpect(jsonPath("$.activeCouriersCount").isNumber())
                .andExpect(jsonPath("$.loadedOnTruckToday").isNumber())
                .andExpect(jsonPath("$.handedToHaulerToday").isNumber());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
    void testGetTrackingMetricsAsFieldStaffReturns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testMetricsDistinguishesDeskRegistrationFromCourierScans() throws Exception {
        trackingEventRepository.deleteAll();

        if (!clientRepository.existsById("CL-001")) {
            clientRepository.save(new com.tnl.logistics.model.Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", com.tnl.logistics.model.ChargeModel.FLAT, true));
        }

        // 1. Initially metrics are all 0
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(0))
                .andExpect(jsonPath("$.activeCouriersCount").value(0))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(0))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 2. Desk registration as office staff
        com.tnl.logistics.dto.ShipmentRegistrationRequest regReq = new com.tnl.logistics.dto.ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Realtime Recipient");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(1);
        regReq.setChargeModel(com.tnl.logistics.model.ChargeModel.FLAT);
        regReq.setShippingFee(new java.math.BigDecimal("350.00"));
        regReq.setRegisteredVia(com.tnl.logistics.model.RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(java.util.List.of(new com.tnl.logistics.dto.ParcelUnitRequest(1, new java.math.BigDecimal("2.5"), new java.math.BigDecimal("20"), new java.math.BigDecimal("15"), new java.math.BigDecimal("10"))));

        var shipResp = shipmentService.registerShipment(regReq, "office");
        String trackingId = shipResp.getTrackingIds().get(0);

        // Operational scans and active couriers must remain 0 for desk registrations
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(0))
                .andExpect(jsonPath("$.activeCouriersCount").value(0))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(0))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));

        // 3. Field courier performs a status scan (LOADED_ON_TRUCK)
        if (!vehicleRepository.existsById("VH-001")) {
            vehicleRepository.save(new com.tnl.logistics.model.Vehicle("VH-001", "ABC-1234", "TNL Truck 1"));
        }
        trackingService.processStatusScan(
                new com.tnl.logistics.dto.TrackingScanRequest(trackingId, com.tnl.logistics.model.ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Loaded for delivery"),
                "field"
        );

        // Metrics should now reflect 1 operational scan, 1 active courier, 1 loaded on truck
        mockMvc.perform(get("/api/v1/tracking-events/metrics")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayTotalScans").value(1))
                .andExpect(jsonPath("$.activeCouriersCount").value(1))
                .andExpect(jsonPath("$.loadedOnTruckToday").value(1))
                .andExpect(jsonPath("$.handedToHaulerToday").value(0));
    }
}
