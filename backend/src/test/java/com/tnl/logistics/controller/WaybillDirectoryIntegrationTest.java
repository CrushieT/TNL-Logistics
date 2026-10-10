package com.tnl.logistics.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.ParcelUnit;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.Waybill;
import com.tnl.logistics.model.WaybillStatus;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.WaybillRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WaybillDirectoryIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired ClientRepository clientRepository;
    @Autowired ShipmentRepository shipmentRepository;
    @Autowired WaybillRepository waybillRepository;
    @Autowired ParcelUnitRepository parcelUnitRepository;
    @Autowired AppUserRepository appUserRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired EntityManager entityManager;

    private Client client;
    private Client secondaryClient;
    private AppUser administrator;

    @BeforeEach
    void setup() {
        client = clientRepository.save(new Client(
                "CL-DIR",
                "Directory Search Client",
                "Baguio City",
                "09170000000",
                "directory@example.test"));
        secondaryClient = clientRepository.save(new Client(
                "CL-DIR-2",
                "Secondary Directory Client",
                "Baguio City",
                "09170000001",
                "directory2@example.test"));
        administrator = appUserRepository.findById("USR-ADMIN").orElseThrow();
    }

    @Test
    void paginatesWithStableOrderingAndBatchedParcelQuantities() throws Exception {
        LocalDateTime generatedAt = LocalDateTime.of(2026, 10, 6, 14, 0);
        for (int index = 1; index <= 25; index++) {
            saveWaybill(index, WaybillStatus.GENERATED, "Directory Hauler", index == 25 ? 2 : 1);
        }
        waybillRepository.flush();
        parcelUnitRepository.flush();
        jdbcTemplate.update(
                "UPDATE waybill SET generated_at = ? WHERE waybill_id LIKE 'WYB-DIR-%'",
                Timestamp.valueOf(generatedAt));
        entityManager.clear();

        JsonNode firstPage = getAdminPage(0, 20, "WYB-DIR-", null, null);
        JsonNode secondPage = getAdminPage(1, 20, "WYB-DIR-", null, null);

        assertEquals(20, firstPage.path("content").size());
        assertEquals(5, secondPage.path("content").size());
        assertEquals(25, firstPage.path("page").path("totalElements").asInt());
        assertEquals(2, firstPage.path("page").path("totalPages").asInt());
        assertEquals("WYB-DIR-0025", firstPage.path("content").get(0).path("waybillId").asText());
        assertEquals(2, firstPage.path("content").get(0).path("quantity").asInt());
        assertEquals("WYB-DIR-0006", firstPage.path("content").get(19).path("waybillId").asText());
        assertEquals("WYB-DIR-0005", secondPage.path("content").get(0).path("waybillId").asText());

        Set<String> firstIds = waybillIds(firstPage);
        Set<String> secondIds = waybillIds(secondPage);
        assertTrue(firstIds.stream().noneMatch(secondIds::contains));
    }

    @Test
    void searchesAllDirectoryFieldsAndReturnsEmptyResults() throws Exception {
        saveWaybill(41, WaybillStatus.GENERATED, "Cordillera Express", 1);
        waybillRepository.flush();

        assertSingleMatch("dir-0041", "WYB-DIR-0041");
        assertSingleMatch("shp-dir-0041", "WYB-DIR-0041");
        assertSingleMatch(client.getName(), "WYB-DIR-0041");
        assertSingleMatch("recipient 41", "WYB-DIR-0041");
        assertSingleMatch("cordillera express", "WYB-DIR-0041");

        JsonNode empty = getAdminPage(0, 20, "NO-SUCH-WAYBILL", null, null);
        assertEquals(0, empty.path("page").path("totalElements").asInt());
        assertTrue(empty.path("content").isEmpty());
    }

    @Test
    void filtersByStatusAndClientAndClampsPageBounds() throws Exception {
        for (int index = 51; index <= 155; index++) {
            WaybillStatus status = index % 2 == 0 ? WaybillStatus.SENT_TO_HAULER : WaybillStatus.GENERATED;
            Client currentClient = index % 3 == 0 ? secondaryClient : client;
            saveWaybill(index, status, "Test Hauler", 1, currentClient);
        }
        waybillRepository.flush();

        JsonNode filtered = getAdminPage(0, 100, "WYB-DIR-", "SENT_TO_HAULER", "Secondary Directory Client");
        filtered.path("content").forEach(record -> {
            assertEquals("SENT_TO_HAULER", record.path("status").asText());
            assertEquals("Secondary Directory Client", record.path("clientName").asText());
        });
        assertTrue(filtered.path("page").path("totalElements").asInt() > 0);

        JsonNode filteredById = getAdminPage(0, 100, "WYB-DIR-", "SENT_TO_HAULER", "CL-DIR-2");
        assertEquals(filtered.path("page").path("totalElements").asInt(), filteredById.path("page").path("totalElements").asInt());

        mockMvc.perform(get("/api/v1/waybills")
                        .param("page", "-3")
                        .param("size", "1000")
                        .param("search", "WYB-DIR-")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.size").value(100))
                .andExpect(jsonPath("$.content.length()").value(100));

        mockMvc.perform(get("/api/v1/waybills")
                        .param("size", "0")
                        .param("search", "WYB-DIR-")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(1))
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    @Test
    void restrictsDirectoryToAdministrators() throws Exception {
        mockMvc.perform(get("/api/v1/waybills"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/waybills")
                .with(user("USR-OFFICE").roles("RECEIVING_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills")
                .with(user("USR-HAULER").roles("DISPATCH_STAFF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/waybills")
                        .with(user("USR-ADMIN").roles("ADMIN")))
                .andExpect(status().isOk());
    }

    private void assertSingleMatch(String search, String expectedWaybillId) throws Exception {
        JsonNode result = getAdminPage(0, 20, search, null, null);
        assertEquals(1, result.path("page").path("totalElements").asInt());
        assertEquals(expectedWaybillId, result.path("content").get(0).path("waybillId").asText());
    }

    private JsonNode getAdminPage(int page, int size, String search, String statusFilter, String clientFilter) throws Exception {
        var request = get("/api/v1/waybills")
                .param("page", String.valueOf(page))
                .param("size", String.valueOf(size))
                .with(user("USR-ADMIN").roles("ADMIN"));
        if (search != null) request.param("search", search);
        if (statusFilter != null) request.param("status", statusFilter);
        if (clientFilter != null) request.param("client", clientFilter);
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Set<String> waybillIds(JsonNode page) {
        Set<String> ids = new HashSet<>();
        page.path("content").forEach(record -> ids.add(record.path("waybillId").asText()));
        return ids;
    }

    private Waybill saveWaybill(int index, WaybillStatus status, String haulerName, int parcelCount) {
        return saveWaybill(index, status, haulerName, parcelCount, client);
    }

    private Waybill saveWaybill(int index, WaybillStatus status, String haulerName, int parcelCount, Client shipmentClient) {
        String suffix = String.format("%04d", index);
        Shipment shipment = new Shipment(
                "SHP-DIR-" + suffix,
                shipmentClient,
                "Directory Recipient " + index,
                "Baguio City",
                "09170000000",
                parcelCount,
                ChargeModel.FLAT,
                new BigDecimal("100.00"),
                BigDecimal.ZERO,
                new BigDecimal("100.00"),
                false,
                RegisteredVia.DESKTOP_OFFICE);
        shipment.setRoute("Manila to Directory Hub " + index);
        shipmentRepository.save(shipment);

        Waybill waybill = new Waybill("WYB-DIR-" + suffix, shipment, administrator, haulerName);
        waybill.setStatus(status);
        waybillRepository.save(waybill);

        for (int parcelIndex = 1; parcelIndex <= parcelCount; parcelIndex++) {
            ParcelUnit parcel = new ParcelUnit(
                    "TRK-D" + suffix + "-" + parcelIndex,
                    shipment,
                    parcelIndex,
                    new BigDecimal("2.50"),
                    new BigDecimal("10"),
                    new BigDecimal("10"),
                    new BigDecimal("10"),
                    new BigDecimal("0.001000"));
            parcel.setWaybill(waybill);
            parcelUnitRepository.save(parcel);
        }
        return waybill;
    }
}
