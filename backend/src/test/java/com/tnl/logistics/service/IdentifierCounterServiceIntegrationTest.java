package com.tnl.logistics.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.repository.ClientRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class IdentifierCounterServiceIntegrationTest {

    private static final String COUNTER_KEY = "SHIPMENT:2099";

    @Autowired
    private IdentifierCounterService identifierCounterService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ClientRepository clientRepository;

    private final Set<String> concurrentClientIds = ConcurrentHashMap.newKeySet();

    @BeforeEach
    @AfterEach
    void clearCounter() {
        concurrentClientIds.forEach(clientRepository::deleteById);
        concurrentClientIds.clear();
        jdbcTemplate.update("DELETE FROM identifier_counter");
    }

    @Test
    void allocatesUniqueSequencesConcurrently() throws Exception {
        try (ExecutorService executorService = Executors.newFixedThreadPool(8)) {
            List<Callable<Long>> allocations = new ArrayList<>();
            for (int index = 0; index < 16; index++) {
                allocations.add(() -> identifierCounterService.next(
                        IdentifierCounterService.IdentifierFamily.SHIPMENT,
                        2099
                ));
            }

            List<Future<Long>> futures = executorService.invokeAll(allocations);
            Set<Long> sequences = new HashSet<>();
            for (Future<Long> future : futures) {
                sequences.add(future.get());
            }

            assertEquals(16, sequences.size());
            assertEquals(Set.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L,
                    9L, 10L, 11L, 12L, 13L, 14L, 15L, 16L), sequences);
        }
    }

    @Test
    void createsUniqueClientsConcurrently() throws Exception {
        try (ExecutorService executorService = Executors.newFixedThreadPool(8)) {
            List<Callable<String>> clientCreations = new ArrayList<>();
            for (int index = 0; index < 16; index++) {
                int clientIndex = index;
                clientCreations.add(() -> {
                    long sequence = identifierCounterService.next(IdentifierCounterService.IdentifierFamily.CLIENT, null);
                    String clientId = String.format("CL-%03d", sequence);
                    concurrentClientIds.add(clientId);
                    clientRepository.save(new Client(
                            clientId,
                            "Concurrent Client " + clientIndex,
                            "Manila",
                            String.format("091700%05d", clientIndex),
                            "concurrent-client-" + clientIndex + "@example.test",
                            ChargeModel.FLAT,
                            true
                    ));
                    return clientId;
                });
            }

            List<Future<String>> futures = executorService.invokeAll(clientCreations);
            Set<String> clientIds = new HashSet<>();
            for (Future<String> future : futures) {
                clientIds.add(future.get());
            }

            assertEquals(16, clientIds.size());
            assertEquals(16, clientRepository.findAllById(clientIds).size());
        }
    }

    @Test
    void resetsYearScopedFamiliesForANewYear() {
        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, 2098));
        assertEquals(2L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, 2098));
        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, 2099));

        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.TRACKING, 2098));
        assertEquals(2L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.TRACKING, 2098));
        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.TRACKING, 2099));

        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.WAYBILL, 2098));
        assertEquals(2L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.WAYBILL, 2098));
        assertEquals(1L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.WAYBILL, 2099));
    }

    @Test
    void allocatesBeyondEveryIdentifierDisplayWidth() {
        createInitializedCounter("CLIENT", 999);
        createInitializedCounter("USER", 999);
        createInitializedCounter("VEHICLE", 999);
        createInitializedCounter("SHIPMENT:2099", 999);
        createInitializedCounter("TRACKING:2099", 999999);
        createInitializedCounter("WAYBILL:2099", 9999);

        assertEquals(1000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.CLIENT, null));
        assertEquals(1000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.USER, null));
        assertEquals(1000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.VEHICLE, null));
        assertEquals(1000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.SHIPMENT, 2099));
        assertEquals(1000000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.TRACKING, 2099));
        assertEquals(10000L, identifierCounterService.next(IdentifierCounterService.IdentifierFamily.WAYBILL, 2099));
    }

    private void createInitializedCounter(String counterKey, long lastIssued) {
        jdbcTemplate.update(
                "INSERT INTO identifier_counter (counter_key, last_issued, initialized) VALUES (?, ?, TRUE)",
                counterKey,
                lastIssued
        );
    }
}
