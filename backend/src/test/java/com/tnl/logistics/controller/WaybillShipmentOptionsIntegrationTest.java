package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.Waybill;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.ParcelUnit;
import com.tnl.logistics.model.WaybillStatus;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.WaybillRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WaybillShipmentOptionsIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired ClientRepository clientRepository;
    @Autowired ShipmentRepository shipmentRepository;
    @Autowired WaybillRepository waybillRepository;
    @Autowired ParcelUnitRepository parcelUnitRepository;
    @Autowired AppUserRepository appUserRepository;
    @Autowired EntityManager entityManager;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private Client client;

    @BeforeEach
    void setup() {
        client = clientRepository.findById("CL-001").orElseThrow();
    }

    @Test
    void paginatesShipmentOptionsWithStableOrderingAndNoOverlap() throws Exception {
        LocalDateTime registeredAt = LocalDateTime.of(2026, 10, 6, 9, 30);
        for (int index = 1; index <= 25; index++) {
            saveShipment(String.format("SHP-PAGE-%04d", index), registeredAt);
        }
        shipmentRepository.flush();

        JsonNode firstPage = getPage(0, 20, "SHP-PAGE-");
        JsonNode secondPage = getPage(1, 20, "SHP-PAGE-");

        assertEquals(20, firstPage.path("content").size());
        assertEquals(5, secondPage.path("content").size());
        assertEquals(25, firstPage.path("totalElements").asInt());
        assertEquals(2, firstPage.path("totalPages").asInt());
        assertEquals(0, firstPage.path("number").asInt());
        assertEquals(20, firstPage.path("size").asInt());
        assertTrue(firstPage.path("first").asBoolean());
        assertTrue(secondPage.path("last").asBoolean());
        assertFalse(firstPage.path("empty").asBoolean());
        assertEquals("SHP-PAGE-0025", firstPage.path("content").get(0).path("shipmentId").asText());
        assertEquals("SHP-PAGE-0006", firstPage.path("content").get(19).path("shipmentId").asText());
        assertEquals("SHP-PAGE-0005", secondPage.path("content").get(0).path("shipmentId").asText());

        Set<String> firstIds = shipmentIds(firstPage);
        Set<String> secondIds = shipmentIds(secondPage);
        assertEquals(20, firstIds.size());
        assertEquals(5, secondIds.size());
        assertTrue(firstIds.stream().noneMatch(secondIds::contains));
    }

    @Test
    void searchesShipmentIdsCaseInsensitivelyAndReturnsEmptyPages() throws Exception {
        saveShipment("SHP-LOOKUP-AbC1", LocalDateTime.of(2026, 10, 6, 10, 0));
        saveShipment("SHP-LOOKUP-ABC2", LocalDateTime.of(2026, 10, 6, 11, 0));
        saveShipment("SHP-UNRELATED-01", LocalDateTime.of(2026, 10, 6, 12, 0));
        shipmentRepository.flush();

        JsonNode matches = getPage(0, 8, "  abc  ");
        assertEquals(2, matches.path("totalElements").asInt());
        assertEquals(2, matches.path("content").size());
        assertEquals("SHP-LOOKUP-ABC2", matches.path("content").get(0).path("shipmentId").asText());
        assertEquals("SHP-LOOKUP-AbC1", matches.path("content").get(1).path("shipmentId").asText());

        JsonNode empty = getPage(0, 8, "NO-SUCH-SHIPMENT");
        assertEquals(0, empty.path("totalElements").asInt());
        assertEquals(0, empty.path("content").size());
        assertTrue(empty.path("empty").asBoolean());
    }

    @Test
    void clampsPageAndPageSizeBounds() throws Exception {
        for (int index = 1; index <= 105; index++) {
            saveShipment(String.format("SHP-BOUND-%04d", index),
                    LocalDateTime.of(2026, 10, 6, 8, 0).plusSeconds(index));
        }
        shipmentRepository.flush();

        mockMvc.perform(get("/api/v1/waybills/shipment-options")
                        .param("page", "-4")
                        .param("size", "1000")
                        .param("search", "SHP-BOUND-")
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.content.length()").value(100));

        mockMvc.perform(get("/api/v1/waybills/shipment-options")
                        .param("size", "0")
                        .param("search", "SHP-BOUND-")
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    @Test
    void restrictsShipmentOptionPagesToAuthenticatedHaulerStaff() throws Exception {
        mockMvc.perform(get("/api/v1/waybills/shipment-options"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/waybills/shipment-options")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/shipment-options")
                        .with(user("USR-FIELD").roles("FIELD_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/shipment-options")
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/waybills/shipments")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void paginatesAndSearchesReturnedWaybillOptionsForHaulerStaff() throws Exception {
        Shipment shipment = saveShipment("SHP-WOPT-BASE", LocalDateTime.of(2026, 10, 6, 7, 0));
        var hauler = appUserRepository.findById("USR-HAULER").orElseThrow();
        for (int index = 1; index <= 25; index++) {
            Waybill waybill = new Waybill(String.format("WYB-OPT-%04d", index), shipment, hauler, "Test Hauler");
            waybill.setStatus(WaybillStatus.SENT_TO_HAULER);
            waybillRepository.save(waybill);
        }
        Waybill excluded = new Waybill("WYB-OPT-GENERATED", shipment, hauler, "Test Hauler");
        waybillRepository.save(excluded);
        waybillRepository.flush();
        jdbcTemplate.update(
                "UPDATE waybill SET generated_at = ? WHERE waybill_id LIKE 'WYB-OPT-%'",
                java.sql.Timestamp.valueOf(LocalDateTime.of(2026, 10, 6, 13, 0)));
        entityManager.clear();

        JsonNode firstPage = getWaybillOptionPage(0, 20, "WYB-OPT-", "SENT_TO_HAULER");
        JsonNode secondPage = getWaybillOptionPage(1, 20, "WYB-OPT-", "SENT_TO_HAULER");
        assertEquals(25, firstPage.path("totalElements").asInt());
        assertEquals(20, firstPage.path("content").size());
        assertEquals(5, secondPage.path("content").size());
        assertEquals("WYB-OPT-0025", firstPage.path("content").get(0).path("waybillId").asText());
        assertEquals("SHP-WOPT-BASE", firstPage.path("content").get(0).path("shipmentId").asText());
        assertEquals("SENT_TO_HAULER", firstPage.path("content").get(0).path("status").asText());
        assertTrue(shipmentIds(firstPage).stream().noneMatch(shipmentIds(secondPage)::contains));

        JsonNode caseInsensitive = getWaybillOptionPage(0, 8, "opt-0003", "SENT_TO_HAULER");
        assertEquals(1, caseInsensitive.path("totalElements").asInt());
        assertEquals("WYB-OPT-0003", caseInsensitive.path("content").get(0).path("waybillId").asText());

        JsonNode empty = getWaybillOptionPage(0, 8, "NOT-A-WAYBILL", "SENT_TO_HAULER");
        assertTrue(empty.path("empty").asBoolean());
    }

    @Test
    void restrictsWaybillOptionsToAuthenticatedHaulerStaff() throws Exception {
        mockMvc.perform(get("/api/v1/waybills/options"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/waybills/options")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/options")
                        .with(user("USR-FIELD").roles("FIELD_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills/options")
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(20));
    }

    private JsonNode getPage(int page, int size, String search) throws Exception {
        var request = get("/api/v1/waybills/shipment-options")
                .param("page", String.valueOf(page))
                .param("size", String.valueOf(size))
                .with(user("USR-HAULER").roles("FIELD_STAFF"));
        if (search != null) {
            request.param("search", search);
        }
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode getWaybillOptionPage(int page, int size, String search, String statusFilter) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/waybills/options")
                        .param("page", String.valueOf(page))
                        .param("size", String.valueOf(size))
                        .param("search", search)
                        .param("status", statusFilter)
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Set<String> shipmentIds(JsonNode page) {
        Set<String> ids = new HashSet<>();
        page.path("content").forEach(option -> ids.add(
                option.hasNonNull("waybillId")
                        ? option.path("waybillId").asText()
                        : option.path("shipmentId").asText()));
        return ids;
    }

    @Test
    void availableUnitsEndpointReturnsArrivedAtTnlAndLoadedToHaulerUnits() throws Exception {
        Shipment shipment = saveShipment("SHP-AVAIL-TEST", LocalDateTime.of(2026, 10, 6, 12, 0));
        var hauler = appUserRepository.findById("USR-HAULER").orElseThrow();

        // Unit 1: ARRIVED_AT_TNL, unassigned
        ParcelUnit u1 = new ParcelUnit("TRK-AVAIL-0001", shipment, 1, new BigDecimal("2.50"),
                new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("0.001000"));
        u1.setCurrentStatus(ParcelStatus.ARRIVED_AT_TNL);

        // Unit 2: LOADED_TO_HAULER, unassigned
        ParcelUnit u2 = new ParcelUnit("TRK-AVAIL-0002", shipment, 2, new BigDecimal("2.50"),
                new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("0.001000"));
        u2.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);

        // Unit 3: LOADED_TO_HAULER, but already assigned to waybill
        Waybill waybill = new Waybill("WYB-2026-9998", shipment, hauler, "Hauler Test");
        waybill.setGenerationKey(UUID.randomUUID().toString());
        waybillRepository.save(waybill);
        ParcelUnit u3 = new ParcelUnit("TRK-AVAIL-0003", shipment, 3, new BigDecimal("2.50"),
                new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("0.001000"));
        u3.setCurrentStatus(ParcelStatus.LOADED_TO_HAULER);
        u3.setWaybill(waybill);

        // Unit 4: REGISTERED (not yet arrived)
        ParcelUnit u4 = new ParcelUnit("TRK-AVAIL-0004", shipment, 4, new BigDecimal("2.50"),
                new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("0.001000"));
        u4.setCurrentStatus(ParcelStatus.REGISTERED);

        parcelUnitRepository.saveAll(List.of(u1, u2, u3, u4));
        parcelUnitRepository.flush();

        mockMvc.perform(get("/api/v1/waybills/shipments/" + shipment.getShipmentId() + "/available")
                        .with(user("USR-HAULER").roles("FIELD_STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].trackingId").value("TRK-AVAIL-0001"))
                .andExpect(jsonPath("$[0].status").value("ARRIVED_AT_TNL"))
                .andExpect(jsonPath("$[1].trackingId").value("TRK-AVAIL-0002"))
                .andExpect(jsonPath("$[1].status").value("LOADED_TO_HAULER"));
    }

    private Shipment saveShipment(String shipmentId, LocalDateTime registeredAt) {
        Shipment shipment = new Shipment(
                shipmentId,
                client,
                "Pagination Recipient",
                "Baguio City",
                "09170000000",
                1,
                ChargeModel.FLAT,
                new BigDecimal("100.00"),
                BigDecimal.ZERO,
                new BigDecimal("100.00"),
                false,
                RegisteredVia.DESKTOP_OFFICE);
        shipment.setDateRegistered(registeredAt);
        return shipmentRepository.save(shipment);
    }
}
