package com.tnl.logistics.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.ParcelUnitRequest;
import com.tnl.logistics.dto.ShipmentRegistrationRequest;
import com.tnl.logistics.dto.TrackingScanRequest;
import com.tnl.logistics.model.ChargeModel;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.RegisteredVia;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.model.Vehicle;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.ShipmentService;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.impl.SseServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SseService sseService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ShipmentService shipmentService;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private ParcelUnitRepository parcelUnitRepository;

    @Autowired
    private TrackingEventRepository trackingEventRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private com.tnl.logistics.repository.WaybillRepository waybillRepository;

    private String officeToken;
    private String adminToken;

    @BeforeEach
    public void setup() {
        waybillRepository.deleteAll();
        trackingEventRepository.deleteAll();
        parcelUnitRepository.deleteAll();
        paymentRepository.deleteAll();
        shipmentRepository.deleteAll();
        vehicleRepository.deleteAll();

        officeToken = "Bearer " + JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
        adminToken = "Bearer " + JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN");

        Client client = clientRepository.findById("CL-001").orElse(null);
        if (client == null) {
            clientRepository.save(new Client("CL-001", "Acme Logistics Client", "Manila", "09170000000", "client@acme.com", ChargeModel.FLAT, true));
        } else if (!Boolean.TRUE.equals(client.getActive())) {
            client.setActive(true);
            clientRepository.save(client);
        }
    }

    @Test
    public void testSseStreamConnectionAndBroadcastFlow() throws Exception {
        // 1. Connect to SSE stream
        MvcResult sseResult = mockMvc.perform(get("/api/v1/events/stream")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andReturn();

        assertNotNull(sseResult.getResponse());

        // 2. Setup vehicle and shipment
        vehicleRepository.saveAndFlush(new Vehicle("VH-001", "ABC-1234", "TNL Truck 1"));

        ShipmentRegistrationRequest regReq = new ShipmentRegistrationRequest();
        regReq.setClientId("CL-001");
        regReq.setRecipientName("Realtime SSE Test Recipient");
        regReq.setRecipientAddress("Baguio City");
        regReq.setRecipientContact("09181234567");
        regReq.setQuantity(1);
        regReq.setChargeModel(ChargeModel.FLAT);
        regReq.setShippingFee(new BigDecimal("350.00"));
        regReq.setRegisteredVia(RegisteredVia.DESKTOP_OFFICE);
        regReq.setParcels(List.of(new ParcelUnitRequest(1, new BigDecimal("2.5"), new BigDecimal("20"), new BigDecimal("15"), new BigDecimal("10"))));

        var shipResp = shipmentService.registerShipment(regReq, "USR-OFFICE");
        String trackingId = shipResp.getTrackingIds().get(0);

        // 3. Trigger a status scan — should broadcast SSE event without throwing
        TrackingScanRequest scanReq = new TrackingScanRequest(trackingId, ParcelStatus.LOADED_ON_TRUCK, "VH-001", "Scanned in field");
        mockMvc.perform(post("/api/v1/tracking-events/scan")
                        .header("Authorization", officeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(scanReq)))
                .andExpect(status().isOk());
    }

    @Test
    public void testSseStreamAcceptsTokenQueryParameter() throws Exception {
        String rawToken = JwtTokenProvider.generateToken("USR-ADMIN", "ADMIN");
        MvcResult sseResult = mockMvc.perform(get("/api/v1/events/stream")
                        .param("token", rawToken))
                .andExpect(status().isOk())
                .andReturn();

        assertNotNull(sseResult.getResponse());
    }

    @Test
    public void testStandardEndpointsRejectTokenQueryParameter() throws Exception {
        String rawToken = JwtTokenProvider.generateToken("USR-OFFICE", "OFFICE_STAFF");
        mockMvc.perform(get("/api/v1/shipments")
                        .param("token", rawToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void testSseHeartbeatExecutionAndDeadEmitterPruning() {
        long futureDeadline = System.currentTimeMillis() + 60000L;
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter activeEmitter = sseService.registerClient("USR-OFFICE", 1, futureDeadline);
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter deadEmitter = sseService.registerClient("USR-OFFICE", 1, futureDeadline);

        // Complete deadEmitter to simulate client disconnect
        deadEmitter.complete();

        // Heartbeat should execute without error and evict deadEmitter
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> sseService.sendHeartbeat());
    }

    @Test
    public void testSseRejectsExpiredDeadline() {
        long pastDeadline = System.currentTimeMillis() - 5000L;
        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> sseService.registerClient("USR-OFFICE", 1, pastDeadline)
        );
    }

    @Test
    public void testCommittedRevocationClosesClientAndRollbackPreservesIt() {
        String userId = "USR-SSE-TEST";
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        when(repository.findSseAuthorizationState(userId)).thenReturn(Optional.of(officeState));
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        long deadline = System.currentTimeMillis() + 60000L;
        isolatedService.registerClient(userId, 1, deadline);

        TransactionTemplate transaction = newIndependentTransaction();
        transaction.executeWithoutResult(status -> {
            isolatedService.closeStreamsForUser(userId);
            status.setRollbackOnly();
        });
        assertEquals(1, isolatedService.getActiveClientCount());

        transaction.executeWithoutResult(status -> isolatedService.closeStreamsForUser(userId));
        assertEquals(0, isolatedService.getActiveClientCount());
        assertDoesNotThrow(() -> isolatedService.broadcastEvent("PING", "TEST"));
    }

    @Test
    public void testRegistrationRejectsStaleVersionAndUnavailableLookup() {
        String userId = "USR-SSE-TEST";
        long deadline = System.currentTimeMillis() + 60000L;
        AppUserRepository revokedRepository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState rotatedState = createOfficeState(2);
        when(revokedRepository.findSseAuthorizationState(userId)).thenReturn(Optional.of(rotatedState));
        SseServiceImpl revokedService = new SseServiceImpl(revokedRepository);

        ResponseStatusException revoked = assertThrows(ResponseStatusException.class,
                () -> revokedService.registerClient(userId, 1, deadline));
        assertEquals(HttpStatus.UNAUTHORIZED, revoked.getStatusCode());
        assertEquals(0, revokedService.getActiveClientCount());

        AppUserRepository unavailableRepository = mock(AppUserRepository.class);
        when(unavailableRepository.findSseAuthorizationState(userId))
                .thenThrow(new DataAccessResourceFailureException("Test database failure"));
        SseServiceImpl unavailableService = new SseServiceImpl(unavailableRepository);
        ResponseStatusException unavailable = assertThrows(ResponseStatusException.class,
                () -> unavailableService.registerClient(userId, 1, deadline));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, unavailable.getStatusCode());
        assertEquals(0, unavailableService.getActiveClientCount());
    }

    @Test
    public void testConcurrentRevocationClosesRegistrationAfterItFinishes() throws Exception {
        String userId = "USR-SSE-TEST";
        CountDownLatch lookupStarted = new CountDownLatch(1);
        CountDownLatch allowLookup = new CountDownLatch(1);
        CountDownLatch revocationStarted = new CountDownLatch(1);
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        when(repository.findSseAuthorizationState(userId)).thenAnswer(invocation -> {
            lookupStarted.countDown();
            if (!allowLookup.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting for revocation");
            }
            return Optional.of(officeState);
        });
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<SseEmitter> registration = executor.submit(
                    () -> isolatedService.registerClient(userId, 1, System.currentTimeMillis() + 60000L));
            assertTrue(lookupStarted.await(5, TimeUnit.SECONDS));
            Future<?> revocation = executor.submit(() -> newIndependentTransaction().executeWithoutResult(status -> {
                revocationStarted.countDown();
                isolatedService.closeStreamsForUser(userId);
            }));
            assertTrue(revocationStarted.await(5, TimeUnit.SECONDS));
            assertThrows(java.util.concurrent.TimeoutException.class,
                    () -> revocation.get(100, TimeUnit.MILLISECONDS));
            allowLookup.countDown();

            assertNotNull(registration.get(5, TimeUnit.SECONDS));
            revocation.get(5, TimeUnit.SECONDS);
            assertEquals(0, isolatedService.getActiveClientCount());
        } finally {
            allowLookup.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    public void testRevocationWaitsForInFlightHeartbeatBeforeCommit() throws Exception {
        String userId = "USR-SSE-TEST";
        CountDownLatch lookupStarted = new CountDownLatch(1);
        CountDownLatch allowLookup = new CountDownLatch(1);
        CountDownLatch revocationStarted = new CountDownLatch(1);
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        when(repository.findSseAuthorizationState(userId))
                .thenReturn(Optional.of(officeState))
                .thenAnswer(invocation -> {
                    lookupStarted.countDown();
                    if (!allowLookup.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting for revocation");
                    }
                    return Optional.of(officeState);
                });
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try (MockedConstruction<SseEmitter> emitters = mockConstruction(SseEmitter.class)) {
            isolatedService.registerClient(userId, 1, System.currentTimeMillis() + 60000L);
            SseEmitter emitter = emitters.constructed().get(0);
            Future<?> heartbeat = executor.submit(isolatedService::sendHeartbeat);
            assertTrue(lookupStarted.await(5, TimeUnit.SECONDS));
            Future<?> revocation = executor.submit(() -> newIndependentTransaction().executeWithoutResult(status -> {
                revocationStarted.countDown();
                isolatedService.closeStreamsForUser(userId);
            }));
            assertTrue(revocationStarted.await(5, TimeUnit.SECONDS));
            assertThrows(java.util.concurrent.TimeoutException.class,
                    () -> revocation.get(100, TimeUnit.MILLISECONDS));
            allowLookup.countDown();
            heartbeat.get(5, TimeUnit.SECONDS);
            revocation.get(5, TimeUnit.SECONDS);
            isolatedService.sendHeartbeat();

            assertEquals(0, isolatedService.getActiveClientCount());
            verify(emitter, times(2)).send(any(SseEmitter.SseEventBuilder.class));
        } finally {
            allowLookup.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    public void testPostCommitLookupFailureDoesNotFailBusinessTransaction() {
        String userId = "USR-SSE-TEST";
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        when(repository.findSseAuthorizationState(userId))
                .thenReturn(Optional.of(officeState))
                .thenThrow(new DataAccessResourceFailureException("Test database failure"));
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        isolatedService.registerClient(userId, 1, System.currentTimeMillis() + 60000L);

        assertDoesNotThrow(() -> newIndependentTransaction().executeWithoutResult(
                status -> isolatedService.broadcastEvent("PING", "TEST")));
        assertEquals(1, isolatedService.getActiveClientCount());
    }

    @Test
    public void testUnexpectedPostCommitBroadcastFailureDoesNotFailBusinessTransaction() {
        String userId = "USR-SSE-TEST";
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        AppUserRepository.SseAuthorizationState failingState = mock(AppUserRepository.SseAuthorizationState.class);
        when(failingState.getActive()).thenThrow(new IllegalStateException("Unexpected authorization failure"));
        when(repository.findSseAuthorizationState(userId))
                .thenReturn(Optional.of(officeState))
                .thenReturn(Optional.of(failingState));
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        isolatedService.registerClient(userId, 1, System.currentTimeMillis() + 60000L);

        assertDoesNotThrow(() -> newIndependentTransaction().executeWithoutResult(
                status -> isolatedService.broadcastEvent("PING", "TEST")));
    }

    @Test
    public void testMissingAccountClosesClientBeforeBroadcast() {
        String userId = "USR-SSE-TEST";
        AppUserRepository repository = mock(AppUserRepository.class);
        AppUserRepository.SseAuthorizationState officeState = createOfficeState(1);
        when(repository.findSseAuthorizationState(userId))
                .thenReturn(Optional.of(officeState))
                .thenReturn(Optional.empty());
        SseServiceImpl isolatedService = new SseServiceImpl(repository);
        isolatedService.registerClient(userId, 1, System.currentTimeMillis() + 60000L);

        newIndependentTransaction().executeWithoutResult(
                status -> isolatedService.broadcastEvent("PING", "TEST"));
        assertEquals(0, isolatedService.getActiveClientCount());
    }

    private TransactionTemplate newIndependentTransaction() {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction;
    }

    private AppUserRepository.SseAuthorizationState createOfficeState(int tokenVersion) {
        AppUserRepository.SseAuthorizationState state = mock(AppUserRepository.SseAuthorizationState.class);
        when(state.getActive()).thenReturn(true);
        when(state.getRole()).thenReturn(UserRole.OFFICE_STAFF);
        when(state.getTokenVersion()).thenReturn(tokenVersion);
        return state;
    }
}
