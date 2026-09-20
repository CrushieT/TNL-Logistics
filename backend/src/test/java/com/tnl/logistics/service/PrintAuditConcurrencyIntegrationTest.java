package com.tnl.logistics.service;

import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.LabelStatus;
import com.tnl.logistics.model.ParcelUnit;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.PrintAuditJobRepository;
import com.tnl.logistics.repository.PrintEventRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
class PrintAuditConcurrencyIntegrationTest {

    private static final String SHIPMENT_ID = "SHP-CONCURRENT";
    private static final String TRACKING_ID = "TRK-CONCURRENT";

    @Autowired private ShipmentService shipmentService;
    @Autowired private ShipmentRepository shipmentRepository;
    @Autowired private ParcelUnitRepository parcelUnitRepository;
    @Autowired private ClientRepository clientRepository;
    @Autowired private PrintEventRepository printEventRepository;
    @Autowired private PrintAuditJobRepository printAuditJobRepository;

    @BeforeEach
    void setUp() {
        cleanUp();
        Client client = clientRepository.findById("CL-001").orElseThrow();
        Shipment shipment = new Shipment(
                SHIPMENT_ID, client, "Concurrent Recipient", "Baguio", "09170000000", 1,
                ChargeModel.FLAT, new BigDecimal("100.00"), BigDecimal.ZERO,
                new BigDecimal("100.00"), false, RegisteredVia.DESKTOP_OFFICE
        );
        shipmentRepository.saveAndFlush(shipment);
        parcelUnitRepository.saveAndFlush(new ParcelUnit(
                TRACKING_ID, shipment, 1, BigDecimal.ONE, null, null, null, null
        ));
    }

    @AfterEach
    void tearDown() {
        cleanUp();
    }

    @Test
    void concurrentExactReplayCreatesOneAuditMutation() throws Exception {
        UUID printJobId = UUID.randomUUID();
        CountDownLatch startSignal = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> recordAfterSignal(startSignal, printJobId));
            Future<?> second = executor.submit(() -> recordAfterSignal(startSignal, printJobId));
            startSignal.countDown();
            first.get();
            second.get();
        } finally {
            executor.shutdownNow();
        }

        ParcelUnit parcel = parcelUnitRepository.findById(TRACKING_ID).orElseThrow();
        assertEquals(LabelStatus.PRINTED, parcel.getLabelStatus());
        assertEquals(0, parcel.getReprintCount());
        assertEquals(1, printAuditJobRepository.count());
        assertEquals(1, printEventRepository
                .findByParcelUnit_TrackingIdOrderByPrintTimestampDescPrintIdDesc(TRACKING_ID).size());
    }

    private void recordAfterSignal(CountDownLatch startSignal, UUID printJobId) {
        try {
            startSignal.await();
            shipmentService.recordLabelPrint(
                    printJobId, SHIPMENT_ID, List.of(TRACKING_ID), "USR-OFFICE", "SYSTEM-PDF"
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private void cleanUp() {
        printEventRepository.deleteAll();
        printAuditJobRepository.deleteAll();
        parcelUnitRepository.deleteById(TRACKING_ID);
        shipmentRepository.deleteById(SHIPMENT_ID);
    }
}
