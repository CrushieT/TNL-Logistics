package com.tnl.logistics.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.PaymentRecordRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.PaymentMethod;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class PaymentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @BeforeEach
    void setup() {
        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client != null) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void testCompletePaymentLifecycleAndValidations() throws Exception {
        // 1. Register an UNPAID shipment with ₱1,500 total amount
        ShipmentRegistrationRequest shipmentReq = new ShipmentRegistrationRequest();
        shipmentReq.setClientId("CL-001");
        shipmentReq.setRecipientName("Payment Test Recipient");
        shipmentReq.setRecipientContact("0917-888-9999");
        shipmentReq.setRecipientAddress("Baguio City Center");
        shipmentReq.setRoute("Manila → TNL Baguio Hub");
        shipmentReq.setDescription("Electronics & Parts");
        shipmentReq.setQuantity(2);
        shipmentReq.setChargeModel(ChargeModel.FLAT);
        shipmentReq.setShippingFee(new BigDecimal("1400.00"));
        shipmentReq.setOtherCharges(new BigDecimal("100.00"));
        shipmentReq.setPaidAtRegistration(false);
        shipmentReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);

        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("4.0"), new BigDecimal("30"), new BigDecimal("20"), new BigDecimal("15"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("6.0"), new BigDecimal("40"), new BigDecimal("30"), new BigDecimal("25"));
        shipmentReq.setParcels(List.of(p1, p2));

        MvcResult createResult = mockMvc.perform(post("/api/v1/shipments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shipmentReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse createdShipment = objectMapper.readValue(createResult.getResponse().getContentAsString(), ShipmentResponse.class);
        String shipmentId = createdShipment.getShipmentId();

        // 2. Verify initial state is Unpaid with ₱1,500 balance
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment").value("Unpaid"))
                .andExpect(jsonPath("$.totalAmount").value(1500.00))
                .andExpect(jsonPath("$.amountPaid").value(0))
                .andExpect(jsonPath("$.balance").value(1500.00));

        // 3. Record partial payment: ₱500.00 via GCASH
        PaymentRecordRequest partialPayment = new PaymentRecordRequest(
                shipmentId,
                new BigDecimal("500.00"),
                PaymentMethod.GCASH,
                "GCASH-REF-10023",
                LocalDate.now(),
                "Initial deposit via GCash"
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(partialPayment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shipmentId").value(shipmentId))
                .andExpect(jsonPath("$.amountPaid").value(500.00))
                .andExpect(jsonPath("$.method").value("GCASH"))
                .andExpect(jsonPath("$.referenceNo").value("GCASH-REF-10023"))
                .andExpect(jsonPath("$.shipmentTotalPaid").value(500.00))
                .andExpect(jsonPath("$.shipmentBalance").value(1000.00))
                .andExpect(jsonPath("$.shipmentPaymentStatus").value("Partial"));

        // 4. Verify shipment details now shows "Partial"
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment").value("Partial"))
                .andExpect(jsonPath("$.amountPaid").value(500.00))
                .andExpect(jsonPath("$.balance").value(1000.00));

        // 5. Test Overpayment Validation: attempting to pay ₱1,200 when balance is ₱1,000
        PaymentRecordRequest overpayment = new PaymentRecordRequest(
                shipmentId,
                new BigDecimal("1200.00"),
                PaymentMethod.CASH,
                null,
                LocalDate.now(),
                "Excessive payment"
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overpayment)))
                .andExpect(status().isBadRequest());

        // 6. Complete remaining balance: ₱1,000.00 via BANK
        PaymentRecordRequest finalPayment = new PaymentRecordRequest(
                shipmentId,
                new BigDecimal("1000.00"),
                PaymentMethod.BANK,
                "BDO-DEP-99482",
                LocalDate.now(),
                "Final settlement"
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(finalPayment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shipmentTotalPaid").value(1500.00))
                .andExpect(jsonPath("$.shipmentBalance").value(0.00))
                .andExpect(jsonPath("$.shipmentPaymentStatus").value("Paid"));

        // 7. Verify shipment details now shows "Paid" with balance 0
        mockMvc.perform(get("/api/v1/shipments/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment").value("Paid"))
                .andExpect(jsonPath("$.amountPaid").value(1500.00))
                .andExpect(jsonPath("$.balance").value(0.00));

        // 8. Retrieve itemized payment breakdown for this shipment
        mockMvc.perform(get("/api/v1/payments/shipment/" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shipmentId").value(shipmentId))
                .andExpect(jsonPath("$.totalAmount").value(1500.00))
                .andExpect(jsonPath("$.totalPaid").value(1500.00))
                .andExpect(jsonPath("$.balance").value(0.00))
                .andExpect(jsonPath("$.paymentStatus").value("Paid"))
                .andExpect(jsonPath("$.payments.length()").value(2));

        // 9. Query global paginated payments directory
        mockMvc.perform(get("/api/v1/payments?search=" + shipmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));
    }

    @Test
    @WithMockUser(username = "field_driver", roles = {"FIELD_STAFF"})
    void testFieldStaffCannotRecordPayment() throws Exception {
        PaymentRecordRequest req = new PaymentRecordRequest(
                "SHP-2026-001",
                new BigDecimal("100.00"),
                PaymentMethod.CASH,
                null,
                LocalDate.now(),
                "Driver collection"
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }
}
