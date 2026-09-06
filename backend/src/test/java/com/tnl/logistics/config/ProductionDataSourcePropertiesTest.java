package com.tnl.logistics.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

import java.io.IOException;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ProductionDataSourcePropertiesTest {

    @Test
    void testProductionDatabaseConfigurationEnforcesSsl() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application-prod.properties"));
        String datasourceUrl = properties.getProperty("spring.datasource.url");

        assertNotNull(datasourceUrl, "spring.datasource.url must be configured in application-prod.properties");
        assertTrue(datasourceUrl.contains("useSSL=true"), "Production datasource must set useSSL=true");
        assertTrue(datasourceUrl.contains("requireSSL=true"), "Production datasource must set requireSSL=true");
        assertTrue(datasourceUrl.contains("allowPublicKeyRetrieval=false"), "Production datasource must set allowPublicKeyRetrieval=false");
        assertFalse(datasourceUrl.contains("useSSL=false"), "Production datasource must not set useSSL=false");
        assertFalse(datasourceUrl.contains("allowPublicKeyRetrieval=true"), "Production datasource must not set allowPublicKeyRetrieval=true");
    }

    @Test
    void testProductionDatabaseUsesProductionDefaultDatabaseName() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application-prod.properties"));
        String datasourceUrl = properties.getProperty("spring.datasource.url");

        assertNotNull(datasourceUrl);
        assertFalse(datasourceUrl.contains("tnl_dev"), "Production default database must not be tnl_dev");
        assertTrue(datasourceUrl.contains("tnl_prod"), "Production default database must fall back to tnl_prod");
    }
}
