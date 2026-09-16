package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class TrackingConcurrencyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ClientRepository clientRepository;

    private String fieldToken;
    private String createdShipmentId;
    private String createdTrackingId;
    private final String testVehicleId = "VH-CONC-01";

    @BeforeEach
    public void setup() {
        fieldToken = "Bearer " + JwtTokenProvider.generateToken("USR-FIELD", "FIELD_STAFF");

        // Ensure client CL-001 exists and is active without clearing other clients
        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
        }

        cleanupTestEntities();
    }

    @AfterEach
    public void tearDown() {
        cleanupTestEntities();
    }

    private void cleanupTestEntities() {
        if (createdTrackingId != null) {
            List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(createdTrackingId);
            trackingEventRepository.deleteAll(events);
            parcelUnitRepository.deleteById(createdTrackingId);
            createdTrackingId = null;
        }
        if (createdShipmentId != null) {
            shipmentRepository.deleteById(createdShipmentId);
            createdShipmentId = null;
        }
        if (vehicleRepository.existsById(testVehicleId)) {
            vehicleRepository.deleteById(testVehicleId);
        }
    }

    @Test
    public void testConcurrentStatusScansAreSerializedWithNoDuplicateEvents() throws Exception {
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(testVehicleId, "CONC-1234", "Concurrency Van"));

        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Concurrent Scan Test");
        regReq.setRecipientAddress("Makati City");
        regReq.setRecipientContact("09181112222");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("300.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10"))));

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        createdShipmentId = shipResp.getShipmentId();
        createdTrackingId = shipResp.getTrackingIds().get(0);

        TrackingScanRequest scanRequest = new TrackingScanRequest(
                createdTrackingId,
                ParcelStatus.LOADED_ON_TRUCK,
                vehicle.getVehicleId(),
                "Concurrent Load on Truck"
        );
        String payload = objectMapper.writeValueAsString(scanRequest);

        int threadCount = 2;
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        List<CompletableFuture<Integer>> futures = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            futures.add(CompletableFuture.supplyAsync(() -> {
                readyLatch.countDown();
                try {
                    startGate.await();
                    MvcResult mvcResult = mockMvc.perform(post("/api/v1/tracking-events/scan")
                                    .header("Authorization", fieldToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(payload))
                            .andReturn();
                    return mvcResult.getResponse().getStatus();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }, executor));
        }

        assertTrue(readyLatch.await(5, TimeUnit.SECONDS));
        startGate.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        for (CompletableFuture<Integer> future : futures) {
            assertEquals(200, future.get().intValue());
        }

        List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(createdTrackingId);
        assertEquals(3, events.size(), "Expected exactly 3 tracking events: REGISTERED, QR_GENERATED, and serialized LOADED_ON_TRUCK");
        assertEquals(ParcelStatus.REGISTERED, events.get(0).getStatus());
        assertEquals(ParcelStatus.QR_GENERATED, events.get(1).getStatus());
        assertEquals(ParcelStatus.LOADED_ON_TRUCK, events.get(2).getStatus());

        ParcelUnit unit = parcelUnitRepository.findById(createdTrackingId).orElseThrow();
        assertEquals(ParcelStatus.LOADED_ON_TRUCK, unit.getCurrentStatus());
        assertNotNull(unit.getCurrentVehicle());
        assertEquals(testVehicleId, unit.getCurrentVehicle().getVehicleId());
    }

    @Test
    public void testConcurrentReverseOrderBatchScansDoNotDeadlock() throws Exception {
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(testVehicleId, "CONC-1234", "Concurrency Van"));

        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Batch Deadlock Test");
        regReq.setRecipientAddress("Pasay City");
        regReq.setRecipientContact("09183334444");
        regReq.setQuantity(2);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("500.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(
                new ParcelUnitRequest(1, new BigDecimal("1.5"), new BigDecimal("10"), new BigDecimal("10"), new BigDecimal("10")),
                new ParcelUnitRequest(2, new BigDecimal("2.0"), new BigDecimal("12"), new BigDecimal("12"), new BigDecimal("12"))
        ));

        ShipmentResponse shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        createdShipmentId = shipResp.getShipmentId();
        List<String> trackingIds = shipResp.getTrackingIds();
        assertEquals(2, trackingIds.size());
        String idA = trackingIds.get(0);
        String idB = trackingIds.get(1);

        // Thread 1 sends [idA, idB], Thread 2 sends [idB, idA] (reversed order)
        BatchTrackingScanRequest reqForward = new BatchTrackingScanRequest(
                List.of(idA, idB),
                ParcelStatus.LOADED_ON_TRUCK,
                vehicle.getVehicleId(),
                "Forward Batch"
        );
        BatchTrackingScanRequest reqReverse = new BatchTrackingScanRequest(
                List.of(idB, idA),
                ParcelStatus.LOADED_ON_TRUCK,
                vehicle.getVehicleId(),
                "Reverse Batch"
        );

        String payloadForward = objectMapper.writeValueAsString(reqForward);
        String payloadReverse = objectMapper.writeValueAsString(reqReverse);

        int threadCount = 2;
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        List<CompletableFuture<Integer>> futures = new ArrayList<>();
        futures.add(CompletableFuture.supplyAsync(() -> {
            readyLatch.countDown();
            try {
                startGate.await();
                MvcResult res = mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                                .header("Authorization", fieldToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payloadForward))
                        .andReturn();
                return res.getResponse().getStatus();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, executor));

        futures.add(CompletableFuture.supplyAsync(() -> {
            readyLatch.countDown();
            try {
                startGate.await();
                MvcResult res = mockMvc.perform(post("/api/v1/tracking-events/batch-scan")
                                .header("Authorization", fieldToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payloadReverse))
                        .andReturn();
                return res.getResponse().getStatus();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, executor));

        assertTrue(readyLatch.await(5, TimeUnit.SECONDS));
        startGate.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        for (CompletableFuture<Integer> future : futures) {
            assertEquals(200, future.get().intValue(), "Both forward and reverse batch scans must succeed without deadlocks");
        }

        ParcelUnit unitA = parcelUnitRepository.findById(idA).orElseThrow();
        ParcelUnit unitB = parcelUnitRepository.findById(idB).orElseThrow();
        assertEquals(ParcelStatus.LOADED_ON_TRUCK, unitA.getCurrentStatus());
        assertEquals(ParcelStatus.LOADED_ON_TRUCK, unitB.getCurrentStatus());

        // Cleanup the two parcels
        for (String tid : trackingIds) {
            List<TrackingEvent> events = trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(tid);
            trackingEventRepository.deleteAll(events);
            parcelUnitRepository.deleteById(tid);
        }
    }
}
