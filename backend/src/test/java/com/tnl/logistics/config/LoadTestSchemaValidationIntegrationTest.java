package com.tnl.logistics.config;

import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integration test verifying that all 17 JPA entity mappings strictly validate
 * against the Flyway-migrated database schema under ddl-auto=validate.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true"
})
public class LoadTestSchemaValidationIntegrationTest {

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void verifiesAllEntitiesPassStrictSchemaValidationAgainstMigratedDatabase() {
        assertNotNull(entityManagerFactory);
        assertTrue(entityManagerFactory.isOpen());
    }
}
