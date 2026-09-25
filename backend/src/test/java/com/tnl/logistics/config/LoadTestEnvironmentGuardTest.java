package com.tnl.logistics.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LoadTestEnvironmentGuardTest {

    @Test
    void acceptsMatchingLoadTestDatabase() {
        LoadTestEnvironmentGuard guard = new LoadTestEnvironmentGuard(
                "jdbc:mysql://localhost:3306/tnl_loadtest?useSSL=false&serverTimezone=UTC",
                "tnl_loadtest"
        );
        assertDoesNotThrow(guard::verifyDatasource);
    }

    @Test
    void acceptsMatchingDatabaseCaseInsensitive() {
        LoadTestEnvironmentGuard guard = new LoadTestEnvironmentGuard(
                "jdbc:mysql://mysql-loadtest:3306/TNL_LOADTEST",
                "tnl_loadtest"
        );
        assertDoesNotThrow(guard::verifyDatasource);
    }

    @Test
    void rejectsDevelopmentDatabaseTarget() {
        LoadTestEnvironmentGuard guard = new LoadTestEnvironmentGuard(
                "jdbc:mysql://localhost:3306/tnl_dev?useSSL=false",
                "tnl_loadtest"
        );
        IllegalStateException exception = assertThrows(IllegalStateException.class, guard::verifyDatasource);
        assertEquals("loadtest profile requires database tnl_loadtest", exception.getMessage());
    }

    @Test
    void rejectsProductionDatabaseTarget() {
        LoadTestEnvironmentGuard guard = new LoadTestEnvironmentGuard(
                "jdbc:mysql://prod-cluster:3306/tnl_prod",
                "tnl_loadtest"
        );
        IllegalStateException exception = assertThrows(IllegalStateException.class, guard::verifyDatasource);
        assertEquals("loadtest profile requires database tnl_loadtest", exception.getMessage());
    }

    @Test
    void rejectsEmptyOrNullDatasource() {
        LoadTestEnvironmentGuard emptyGuard = new LoadTestEnvironmentGuard("", "tnl_loadtest");
        assertThrows(IllegalStateException.class, emptyGuard::verifyDatasource);

        LoadTestEnvironmentGuard nullGuard = new LoadTestEnvironmentGuard(null, "tnl_loadtest");
        assertThrows(IllegalStateException.class, nullGuard::verifyDatasource);
    }

    @Test
    void extractsDatabaseNameFromVariousUrlFormats() {
        assertEquals("tnl_loadtest", LoadTestEnvironmentGuard.extractDatabaseName("jdbc:mysql://localhost:3306/tnl_loadtest?useSSL=false"));
        assertEquals("tnl_loadtest", LoadTestEnvironmentGuard.extractDatabaseName("jdbc:mysql://localhost:3306/tnl_loadtest"));
        assertEquals("custom_db", LoadTestEnvironmentGuard.extractDatabaseName("jdbc:mysql://host:port/custom_db?p1=v1&p2=v2"));
        assertEquals("", LoadTestEnvironmentGuard.extractDatabaseName(""));
        assertEquals("", LoadTestEnvironmentGuard.extractDatabaseName(null));
    }
}
