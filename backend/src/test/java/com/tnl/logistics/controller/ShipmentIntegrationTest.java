package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.ShipmentResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
public class ShipmentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private String officeToken;
    private String fieldToken;
    private String currentYear;

    @BeforeEach
    public void setup() {
        trackingEventRepository.deleteAll();
        paymentRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        shipmentRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("office", "OFFICE_STAFF");
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("field", "FIELD_STAFF");

        // Seed Client if not present
        if (clientRepository.findById("CL-001").isEmpty()) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com"));
        }

        currentYear = String.valueOf(LocalDate.now().getYear());
    }

    @Test
    public void testFlatRateShipmentRegistrationAndSequenceFormatting() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("3.0"), new BigDecimal("10"), new BigDecimal("20"), new BigDecimal("30"));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("John Doe");
        request.setRecipientAddress("Cebu City");
        request.setRecipientContact("09181112222");
        request.setQuantity(2);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("150.00"));
        request.setOtherCharges(new BigDecimal("50.00"));
        request.setPaidAtRegistration(false);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1, p2));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);

        // Verify ID formatting
        assertTrue(response.getShipmentId().startsWith("SHP-" + currentYear + "-"));
        assertEquals(2, response.getTrackingIds().size());
        assertTrue(response.getTrackingIds().get(0).startsWith("TRK-" + currentYear + "-"));
        assertTrue(response.getTrackingIds().get(1).startsWith("TRK-" + currentYear + "-"));

        // Verify Flat Pricing: total = 150 + 50 = 200 (fee doesn't multiply for flat)
        assertEquals(new BigDecimal("200.00"), response.getTotalAmount());
    }

    @Test
    public void testPerParcelPricingAndAutoPaymentCreation() throws Exception {
        ParcelUnitRequest p1 = new ParcelUnitRequest(1, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));
        ParcelUnitRequest p2 = new ParcelUnitRequest(2, new BigDecimal("1.0"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Jane Smith");
        request.setRecipientAddress("Davao City");
        request.setRecipientContact("09193334444");
        request.setQuantity(2);
        request.setChargeModel(ChargeModel.PER_PARCEL);
        request.setShippingFee(new BigDecimal("100.00")); // 100 * 2 = 200
        request.setOtherCharges(new BigDecimal("20.00"));  // 200 + 20 = 220
        request.setPaidAtRegistration(true);
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(p1, p2));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        ShipmentResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);

        // Verify Per-parcel pricing: total = (100 * 2) + 20 = 220
        assertEquals(new BigDecimal("220.00"), response.getTotalAmount());
        assertTrue(response.getPaidAtRegistration());

        // Verify Payment record auto-created
        List<Payment> payments = paymentRepository.findAll();
        assertEquals(1, payments.size());
        assertEquals(new BigDecimal("220.00"), payments.get(0).getAmountPaid());
        assertEquals(PaymentMethod.CASH, payments.get(0).getMethod());

        // Verify Tracking Events created for each unit
        List<TrackingEvent> events = trackingEventRepository.findAll();
        assertEquals(2, events.size());
        assertEquals(ParcelStatus.REGISTERED, events.get(0).getStatus());
    }

    @Test
    public void testRoleGatingForFieldStaff() throws Exception {
        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Unauthorized Access");
        request.setRecipientAddress("Test");
        request.setRecipientContact("000");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("100.00"));
        request.setRegisteredVia(RegisteredVia.MOBILE_FIELD);
        request.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("1"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        // FIELD_STAFF should be rejected with 403 Forbidden
        mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", fieldToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }
}
