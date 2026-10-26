package com.tnl.logistics.config;

import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.service.*;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import com.tnl.logistics.model.AppUser;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class LoadTestDataSeederTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private ShipmentRepository shipmentRepository;

    @Mock
    private TransactionTemplate transactionTemplate;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @Mock private ShipmentService shipmentService;
    @Mock private TrackingService trackingService;
    @Mock private PaymentService paymentService;
    @Mock private WaybillService waybillService;
    @Mock private ParcelExceptionService exceptionService;
    @Mock private SoaService soaService;
    @Mock private CollectionsService collectionsService;
    @Mock private SystemSettingService systemSettingService;
    @Mock private Validator validator;
    @Mock private IdentifierCounterService counters;

    private LoadTestDataSeeder createSeeder(boolean enabled, int shipments, long seed, int batchSize, String password) {
        return new LoadTestDataSeeder(entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                shipmentService, trackingService, paymentService, waybillService, exceptionService, soaService,
                collectionsService, systemSettingService, validator, counters, enabled, shipments, seed, batchSize, password);
    }

    @Test
    void disabledSeedingDoesNotQueryOrModifyDatabase() {
        LoadTestDataSeeder seeder = createSeeder(
                false, 50000, 20260925L, 250, "testpassword"
        );

        seeder.run();

        verify(shipmentRepository, never()).count();
    }

    @Test
    void interruptedPartialSeedFailsStartup() {
        when(shipmentRepository.count()).thenReturn(250L);

        LoadTestDataSeeder seeder = createSeeder(
                true, 50000, 20260925L, 250, "testpassword"
        );

        IllegalStateException exception = assertThrows(IllegalStateException.class, seeder::run);
        assertTrue(exception.getMessage().contains("invalid/mismatched state"));
        assertTrue(exception.getMessage().contains("found 250 shipments, expected 50000"));
    }

    @Test
    void overTargetDatabaseFailsStartup() {
        when(shipmentRepository.count()).thenReturn(51000L);

        LoadTestDataSeeder seeder = createSeeder(
                true, 50000, 20260925L, 250, "testpassword"
        );

        IllegalStateException exception = assertThrows(IllegalStateException.class, seeder::run);
        assertTrue(exception.getMessage().contains("invalid/mismatched state"));
        assertTrue(exception.getMessage().contains("found 51000 shipments, expected 50000"));
    }

    @Test
    void fullySeededDatabaseSkipsWithoutRunningBatches() {
        when(shipmentRepository.count()).thenReturn(50000L);
        when(transactionTemplate.execute(any())).thenReturn(true);

        LoadTestDataSeeder seeder = createSeeder(
                true, 50000, 20260925L, 250, "testpassword"
        );

        seeder.run();

        verify(transactionTemplate, never()).executeWithoutResult(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void matchingShipmentCountWithoutCompletionMarkerRejectsOldOrInterruptedSeed() {
        when(shipmentRepository.count()).thenReturn(50000L);

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                createSeeder(true, 50000, 20260925L, 250, "testpassword")::run);

        assertTrue(exception.getMessage().contains("outdated or incomplete"));
        verify(transactionTemplate, never()).executeWithoutResult(any());
    }

    @Test
    void referenceOnlyPartialSeedRejectsStartupBeforeWritingDuplicates() {
        when(entityManager.find(AppUser.class, "LT-ADMIN")).thenReturn(new AppUser());
        doAnswer(invocation -> {
            Consumer<org.springframework.transaction.TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(null);
            return null;
        }).when(transactionTemplate).executeWithoutResult(any());

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                createSeeder(true, 50000, 20260925L, 250, "testpassword")::run);

        assertTrue(exception.getMessage().contains("reference data already exists"));
        verify(entityManager, never()).persist(any());
    }

    @Test
    void invalidConfigurationRejectsStartup() {
        LoadTestDataSeeder invalidTarget = createSeeder(
                true, 0, 20260925L, 250, "testpassword"
        );
        assertThrows(IllegalStateException.class, invalidTarget::run);

        LoadTestDataSeeder invalidBatch = createSeeder(
                true, 1000, 20260925L, 0, "testpassword"
        );
        assertThrows(IllegalStateException.class, invalidBatch::run);

        LoadTestDataSeeder emptyPassword = createSeeder(
                true, 1000, 20260925L, 250, "   "
        );
        assertThrows(IllegalStateException.class, emptyPassword::run);
    }
}
