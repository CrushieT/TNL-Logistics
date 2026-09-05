package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.repository.ClientRepository;
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

    @BeforeEach
    void setUp() {
        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client != null) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testWeeklyCollectionsAndActiveCyclesEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/collections/weekly"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").exists())
                .andExpect(jsonPath("$.totalDue").exists())
                .andExpect(jsonPath("$.items").isArray());

        mockMvc.perform(get("/api/v1/collections/cycles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
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
    @WithMockUser(username = "office", roles = {"OFFICE_STAFF"})
    void testAuthorizedCollectorsEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/soa/collectors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "field", roles = {"FIELD_STAFF"})
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
}
