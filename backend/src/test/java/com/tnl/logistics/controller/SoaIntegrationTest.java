package com.tnl.logistics.controller;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.PaymentMethod;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Soa;
import com.tnl.logistics.model.SoaBatch;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.SoaBatchRepository;
import com.tnl.logistics.repository.SoaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SoaIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private SoaBatchRepository soaBatchRepository;

    @Autowired
    private SoaRepository soaRepository;

    @BeforeEach
    void setUp() {
        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client != null) {
            client.setActive(true);
            clientRepository.save(client);
        }

        Client client2 = clientRepository.findById("CL-002").orElse(null);
        if (client2 == null) {
            clientRepository.save(new Client("CL-002", "Beta Logistics Client", "Cebu", "09170000002", "client2@beta.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client2.getActive())) {
            client2.setActive(true);
            clientRepository.save(client2);
        }
    }

    @Test
    @WithMockUser(username = "USR-ADMIN", roles = {"ADMIN"})
    void testWeeklyCollectionsAndActiveCyclesEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/collections/weekly"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").exists())
                .andExpect(jsonPath("$.totalDue").exists())
                .andExpect(jsonPath("$.items").isArray());

        mockMvc.perform(get("/api/v1/collections/cycles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0]").exists());
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testStatementPreviewAndSaveLifecycle() throws Exception {
        // 1. Register a shipment for CL-001 to ensure unbilled items in current cycle
        ShipmentRegistrationRequest shipmentReq = new ShipmentRegistrationRequest();
        shipmentReq.setClientId("CL-001");
        shipmentReq.setRecipientName("SOA Test Consignee");
        shipmentReq.setRecipientContact("0917-888-0001");
        shipmentReq.setRecipientAddress("Baguio City Center");
        shipmentReq.setRoute("Manila -> Baguio");
        shipmentReq.setDescription("Textile Goods");
        shipmentReq.setQuantity(1);
        shipmentReq.setChargeModel(ChargeModel.FLAT);
        shipmentReq.setShippingFee(new BigDecimal("1200.00"));
        shipmentReq.setOtherCharges(BigDecimal.ZERO);
        shipmentReq.setPaidAtRegistration(false);
        shipmentReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        shipmentReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("3.0"), new BigDecimal("20"), new BigDecimal("20"), new BigDecimal("20"))
        ));

        mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shipmentReq)))
                .andExpect(status().isCreated());

        // 2. Query Statement Preview for CL-001
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", "CL-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("CL-001"))
                .andExpect(jsonPath("$.clientName").exists())
                .andExpect(jsonPath("$.items").isArray());

        // 3. Save Statement with itemized deduction and collector
        SaveStatementRequest saveReq = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                new BigDecimal("150.00"),
                "Refused damaged outer packaging",
                "Carlos Mendoza (Field Collector)"
        );

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("CL-001"))
                .andExpect(jsonPath("$.deductionAmount").value(150.00))
                .andExpect(jsonPath("$.deductionNote").value("Refused damaged outer packaging"))
                .andExpect(jsonPath("$.collectedBy").value("Carlos Mendoza (Field Collector)"))
                .andExpect(jsonPath("$.isSaved").value(true));

        // 4. Verify preview subsequently reflects persisted deduction and updated balance
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", "CL-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("CL-001"))
                .andExpect(jsonPath("$.deductionAmount").value(150.00))
                .andExpect(jsonPath("$.isSaved").value(true));
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testAuthorizedCollectorsEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/soa/collectors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "USR-FIELD", roles = {"FIELD_STAFF"})
    void testFieldStaffForbiddenFromSoaManagement() throws Exception {
        SaveStatementRequest saveReq = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                BigDecimal.ZERO,
                null,
                "Unauthorized Collector"
        );

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", "CL-001"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testSaveStatementValidationConstraints() throws Exception {
        // 1. Negative deduction amount
        SaveStatementRequest negativeDeduction = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                new BigDecimal("-50.00"),
                "Invalid negative deduction",
                "Carlos Mendoza"
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(negativeDeduction)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.deductionAmount").value("Deduction amount must be zero or positive"));

        // 2. Blank client ID
        SaveStatementRequest blankClientId = new SaveStatementRequest(
                "   ",
                LocalDate.now(),
                BigDecimal.ZERO,
                "Valid note",
                "Carlos Mendoza"
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankClientId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.clientId").value("Client ID is required"));

        // 3. Missing target date
        SaveStatementRequest missingTargetDate = new SaveStatementRequest(
                "CL-001",
                null,
                BigDecimal.ZERO,
                "Valid note",
                "Carlos Mendoza"
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(missingTargetDate)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.targetDate").value("Target date is required"));

        // 4. Oversized deduction note (>255 characters)
        SaveStatementRequest oversizedNote = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                BigDecimal.ZERO,
                "X".repeat(256),
                "Carlos Mendoza"
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oversizedNote)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.deductionNote").value("Deduction note must not exceed 255 characters"));

        // 5. Oversized collectedBy (>150 characters)
        SaveStatementRequest oversizedCollector = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                BigDecimal.ZERO,
                "Valid note",
                "Y".repeat(151)
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oversizedCollector)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.collectedBy").value("Collected by must not exceed 150 characters"));

        // 6. Fractional precision exceeding 2 decimal places
        SaveStatementRequest excessDecimals = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                new BigDecimal("100.555"),
                "Valid note",
                "Carlos Mendoza"
        );
        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(excessDecimals)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.deductionAmount").value("Deduction amount must have at most 2 decimal places"));
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testSaveStatementDeductionExceedingTotalChargesRejected() throws Exception {
        // Register a shipment with 1200.00 total charges
        ShipmentRegistrationRequest shipmentReq = new ShipmentRegistrationRequest();
        shipmentReq.setClientId("CL-001");
        shipmentReq.setRecipientName("Consignee Limit Test");
        shipmentReq.setRecipientContact("0917-111-2233");
        shipmentReq.setRecipientAddress("Baguio City Center");
        shipmentReq.setRoute("Manila -> Baguio");
        shipmentReq.setDescription("Textile Goods");
        shipmentReq.setQuantity(1);
        shipmentReq.setChargeModel(ChargeModel.FLAT);
        shipmentReq.setShippingFee(new BigDecimal("1200.00"));
        shipmentReq.setOtherCharges(BigDecimal.ZERO);
        shipmentReq.setPaidAtRegistration(false);
        shipmentReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        shipmentReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))
        ));

        mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shipmentReq)))
                .andExpect(status().isCreated());

        // Attempt to save deduction of 1500.00 (which exceeds 1200.00 total charges)
        SaveStatementRequest excessiveDeduction = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                new BigDecimal("1500.00"),
                "Excessive deduction attempt",
                "Carlos Mendoza"
        );

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(excessiveDeduction)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message", containsString("cannot exceed total charges")));
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testManualSoaBatchIsolationBetweenDistinctClients() throws Exception {
        LocalDate today = LocalDate.now();
        SaveStatementRequest saveReq1 = new SaveStatementRequest(
                "CL-001",
                today,
                BigDecimal.ZERO,
                null,
                "Carlos Mendoza"
        );
        SaveStatementRequest saveReq2 = new SaveStatementRequest(
                "CL-002",
                today,
                BigDecimal.ZERO,
                null,
                "Carlos Mendoza"
        );

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq1)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq2)))
                .andExpect(status().isOk());

        List<SoaBatch> batches = soaBatchRepository.findAll();
        boolean hasClient1Batch = batches.stream().anyMatch(b -> b.getBatchId().contains("CL-001"));
        boolean hasClient2Batch = batches.stream().anyMatch(b -> b.getBatchId().contains("CL-002"));
        assertTrue(hasClient1Batch, "Expected distinct batch scoped to CL-001");
        assertTrue(hasClient2Batch, "Expected distinct batch scoped to CL-002");
    }

    @Test
    @WithMockUser(username = "USR-OFFICE", roles = {"OFFICE_STAFF"})
    void testSavedSoaReflectsSubsequentPayments() throws Exception {
        // 1. Register a shipment with 1000.00 fee
        ShipmentRegistrationRequest shipmentReq = new ShipmentRegistrationRequest();
        shipmentReq.setClientId("CL-001");
        shipmentReq.setRecipientName("Payment Sync Consignee");
        shipmentReq.setRecipientContact("0917-222-3333");
        shipmentReq.setRecipientAddress("Baguio City Center");
        shipmentReq.setRoute("Manila -> Baguio");
        shipmentReq.setDescription("Payment Sync Test");
        shipmentReq.setQuantity(1);
        shipmentReq.setChargeModel(ChargeModel.FLAT);
        shipmentReq.setShippingFee(new BigDecimal("1000.00"));
        shipmentReq.setOtherCharges(BigDecimal.ZERO);
        shipmentReq.setPaidAtRegistration(false);
        shipmentReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        shipmentReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("2.0"), new BigDecimal("15"), new BigDecimal("15"), new BigDecimal("15"))
        ));

        var regRes = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shipmentReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String shipmentId = objectMapper.readTree(regRes.getResponse().getContentAsString()).get("shipmentId").asText();

        // 2. Record initial payment of 300.00 prior to saving SOA
        PaymentRecordRequest initialPayment = new PaymentRecordRequest(
                shipmentId,
                new BigDecimal("300.00"),
                PaymentMethod.CASH,
                "CASH-INIT-001",
                LocalDate.now(),
                "Initial partial payment"
        );
        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initialPayment)))
                .andExpect(status().isCreated());

        // 3. Save SOA for CL-001
        SaveStatementRequest saveReq = new SaveStatementRequest(
                "CL-001",
                LocalDate.now(),
                BigDecimal.ZERO,
                null,
                "Carlos Mendoza"
        );
        var saveRes = mockMvc.perform(post("/api/v1/soa/save")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(saveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCharges").value(1000.00))
                .andExpect(jsonPath("$.totalPaid").value(300.00))
                .andExpect(jsonPath("$.amountDue").value(700.00))
                .andExpect(jsonPath("$.isSaved").value(true))
                .andReturn();

        String statementId = objectMapper.readTree(saveRes.getResponse().getContentAsString()).get("soaNo").asText();

        // 4. Record subsequent payment of 200.00 after SOA is saved
        PaymentRecordRequest subsequentPayment = new PaymentRecordRequest(
                shipmentId,
                new BigDecimal("200.00"),
                PaymentMethod.GCASH,
                "GCASH-SUB-002",
                LocalDate.now(),
                "Subsequent payment after SOA finalized"
        );
        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(subsequentPayment)))
                .andExpect(status().isCreated());

        // 5. Verify statement preview dynamically reflects live payments (totalPaid = 500.00, amountDue = 500.00)
        mockMvc.perform(get("/api/v1/soa/preview")
                        .param("clientId", "CL-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("CL-001"))
                .andExpect(jsonPath("$.isSaved").value(true))
                .andExpect(jsonPath("$.totalCharges").value(1000.00))
                .andExpect(jsonPath("$.totalPaid").value(500.00))
                .andExpect(jsonPath("$.amountDue").value(500.00));

        // 6. Verify persisted SOA entity in database is synchronized
        Soa persistedSoa = soaRepository.findById(statementId).orElseThrow();
        assertEquals(0, new BigDecimal("500.00").compareTo(persistedSoa.getTotalPaid()));
        assertEquals(0, new BigDecimal("500.00").compareTo(persistedSoa.getOutstandingBalance()));
    }
}
