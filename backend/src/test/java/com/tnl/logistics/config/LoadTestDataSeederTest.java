package com.tnl.logistics.config;

import com.tnl.logistics.repository.ShipmentRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void disabledSeedingDoesNotQueryOrModifyDatabase() {
        LoadTestDataSeeder seeder = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                false, 10000, 20260925L, 250, "testpassword"
        );

        seeder.run();

        verify(shipmentRepository, never()).count();
    }

    @Test
    void interruptedPartialSeedFailsStartup() {
        when(shipmentRepository.count()).thenReturn(250L);

        LoadTestDataSeeder seeder = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 10000, 20260925L, 250, "testpassword"
        );

        IllegalStateException exception = assertThrows(IllegalStateException.class, seeder::run);
        assertTrue(exception.getMessage().contains("invalid/mismatched state"));
        assertTrue(exception.getMessage().contains("found 250 shipments, expected 10000"));
    }

    @Test
    void overTargetDatabaseFailsStartup() {
        when(shipmentRepository.count()).thenReturn(11000L);

        LoadTestDataSeeder seeder = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 10000, 20260925L, 250, "testpassword"
        );

        IllegalStateException exception = assertThrows(IllegalStateException.class, seeder::run);
        assertTrue(exception.getMessage().contains("invalid/mismatched state"));
        assertTrue(exception.getMessage().contains("found 11000 shipments, expected 10000"));
    }

    @Test
    void fullySeededDatabaseSkipsWithoutRunningBatches() {
        when(shipmentRepository.count()).thenReturn(10000L);

        LoadTestDataSeeder seeder = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 10000, 20260925L, 250, "testpassword"
        );

        seeder.run();

        verify(transactionTemplate, never()).executeWithoutResult(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void invalidConfigurationRejectsStartup() {
        LoadTestDataSeeder invalidTarget = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 0, 20260925L, 250, "testpassword"
        );
        assertThrows(IllegalStateException.class, invalidTarget::run);

        LoadTestDataSeeder invalidBatch = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 1000, 20260925L, 0, "testpassword"
        );
        assertThrows(IllegalStateException.class, invalidBatch::run);

        LoadTestDataSeeder emptyPassword = new LoadTestDataSeeder(
                entityManager, shipmentRepository, transactionTemplate, passwordEncoder,
                true, 1000, 20260925L, 250, "   "
        );
        assertThrows(IllegalStateException.class, emptyPassword::run);
    }
}
