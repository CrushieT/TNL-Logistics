package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ParcelUnitDetailResponse;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.PrintLabelRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ParcelPrintIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private PrintEventRepository printEventRepository;

    @Autowired
    private WaybillRepository waybillRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private String officeToken;

    @BeforeEach
    public void setUp() {
        printEventRepository.deleteAll();
        waybillRepository.deleteAll();
        trackingEventRepository.deleteAll();
        paymentRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        shipmentRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("office", "OFFICE_STAFF");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    private ShipmentResponse createSampleShipment() throws Exception {
        ParcelUnitRequest parcel = new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("15"), new BigDecimal("10"), new BigDecimal("5"));

        ShipmentRegistrationRequest request = new ShipmentRegistrationRequest();
        request.setClientId("CL-001");
        request.setRecipientName("Audit Test Recipient");
        request.setRecipientAddress("Baguio City");
        request.setRecipientContact("09181112222");
        request.setQuantity(1);
        request.setChargeModel(ChargeModel.FLAT);
        request.setShippingFee(new BigDecimal("150.00"));
        request.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        request.setParcels(List.of(parcel));

        MvcResult result = mockMvc.perform(post("/api/v1/shipments")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readValue(result.getResponse().getContentAsString(), ShipmentResponse.class);
    }

    @Test
    public void testInitialParcelRegistrationHasPendingPrintMetadata() throws Exception {
        ShipmentResponse created = createSampleShipment();
        String trackingId = created.getTrackingIds().get(0);

        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse response = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);

        assertEquals("Pending", response.getLabelStatus());
        assertNotNull(response.getPrinting());
        assertEquals("Pending", response.getPrinting().getStatus());
        assertEquals("—", response.getPrinting().getDate());
        assertEquals("—", response.getPrinting().getBy());
        assertEquals("—", response.getPrinting().getPrinter());
        assertEquals(0, response.getPrinting().getCount());
    }

    @Test
    public void testPrintLabelRecordsAuditMetadataAndUpdatesParcelUnit() throws Exception {
        ShipmentResponse created = createSampleShipment();
        String shipmentId = created.getShipmentId();
        String trackingId = created.getTrackingIds().get(0);

        PrintLabelRequest printRequest = new PrintLabelRequest(List.of(trackingId), "ZEBRA-GK420D");

        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(printRequest)))
                .andExpect(status().isOk());

        List<PrintEvent> printEvents = printEventRepository.findByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(trackingId);
        assertEquals(1, printEvents.size());

        PrintEvent printEvent = printEvents.get(0);
        assertEquals(PrintKind.PRINT, printEvent.getKind());
        assertEquals("ZEBRA-GK420D", printEvent.getPrinterId());
        assertEquals("office", printEvent.getStaff().getUsername());
        assertEquals("Office Staff", printEvent.getStaff().getFullName());
        assertEquals(1, printEvent.getLabelsProduced());
        assertNotNull(printEvent.getPrintTimestamp());

        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse response = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);

        assertEquals("Printed", response.getLabelStatus());
        assertNotNull(response.getPrinting());
        assertEquals("Printed", response.getPrinting().getStatus());
        assertEquals("Office Staff", response.getPrinting().getBy());
        assertEquals("ZEBRA-GK420D", response.getPrinting().getPrinter());
        assertEquals(1, response.getPrinting().getCount());
        assertNotEquals("—", response.getPrinting().getDate());
        assertFalse(response.getPrinting().getDate().contains("Aug 24, 2026"));
    }

    @Test
    public void testReprintLabelAppendsReprintAuditRecordAndIncrementsCount() throws Exception {
        ShipmentResponse created = createSampleShipment();
        String shipmentId = created.getShipmentId();
        String trackingId = created.getTrackingIds().get(0);

        PrintLabelRequest initialRequest = new PrintLabelRequest(List.of(trackingId), "ZEBRA-GK420D");
        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initialRequest)))
                .andExpect(status().isOk());

        PrintLabelRequest reprintRequest = new PrintLabelRequest(List.of(trackingId), "HP-DESKJET-01");
        mockMvc.perform(post("/api/v1/shipments/" + shipmentId + "/labels/print")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reprintRequest)))
                .andExpect(status().isOk());

        List<PrintEvent> printEvents = printEventRepository.findByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(trackingId);
        assertEquals(2, printEvents.size());

        PrintEvent latestEvent = printEvents.get(0);
        assertEquals(PrintKind.REPRINT, latestEvent.getKind());
        assertEquals("HP-DESKJET-01", latestEvent.getPrinterId());

        PrintEvent firstEvent = printEvents.get(1);
        assertEquals(PrintKind.PRINT, firstEvent.getKind());
        assertEquals("ZEBRA-GK420D", firstEvent.getPrinterId());

        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
        assertEquals(1, parcel.getReprintCount());

        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse response = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);

        assertEquals("Printed", response.getLabelStatus());
        assertEquals("HP-DESKJET-01", response.getPrinting().getPrinter());
        assertEquals(2, response.getPrinting().getCount());
    }

    @Test
    public void testLegacyPrintedParcelFallbackResolvesStaff() throws Exception {
        ShipmentResponse created = createSampleShipment();
        String trackingId = created.getTrackingIds().get(0);

        ParcelUnit parcel = parcelUnitRepository.findById(trackingId).orElseThrow();
        parcel.setLabelStatus(LabelStatus.PRINTED);
        parcelUnitRepository.saveAndFlush(parcel);

        printEventRepository.deleteAll();

        MvcResult unitResult = mockMvc.perform(get("/api/v1/parcel-units/" + trackingId)
                        .header("Authorization", officeToken))
                .andExpect(status().isOk())
                .andReturn();

        ParcelUnitDetailResponse response = objectMapper.readValue(unitResult.getResponse().getContentAsString(), ParcelUnitDetailResponse.class);

        assertEquals("Printed", response.getLabelStatus());
        assertEquals("Office Staff", response.getPrinting().getBy());
        assertEquals("Brother RJ-2035B", response.getPrinting().getPrinter());
        assertNotEquals("Maria Santos", response.getPrinting().getBy());
    }
}
