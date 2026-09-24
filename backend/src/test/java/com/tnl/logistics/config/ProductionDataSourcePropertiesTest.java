package com.tnl.logistics.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

import java.io.IOException;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ProductionDataSourcePropertiesTest {

    private ConfigurableApplicationContext applicationContext;

    @AfterEach
    void closeApplicationContext() {
        if (applicationContext != null) {
            applicationContext.close();
        }
    }

    @Test
    void testPackagedDefaultsDoNotActivateDevelopmentOrProvideJwtFallback() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application.properties"));

        assertNull(properties.getProperty("spring.profiles.active"),
                "Packaged defaults must not activate the development profile");
        assertEquals("${JWT_SECRET}", properties.getProperty("jwt.secret"),
                "Packaged defaults must require JWT_SECRET without a fallback value");
    }

    @Test
    void testNonDevelopmentStartupFailsWithoutJwtSecret() {
        SpringApplication application = new SpringApplication(JwtStartupTestApplication.class);
        application.setWebApplicationType(WebApplicationType.NONE);

        Exception startupFailure = assertThrows(Exception.class, () ->
                applicationContext = application.run(
                        "--spring.profiles.active=prod",
                        "--jwt.secret=",
                        "--spring.main.banner-mode=off"));

        Throwable rootCause = startupFailure;
        while (rootCause.getCause() != null) {
            rootCause = rootCause.getCause();
        }

        assertTrue(rootCause.getMessage().contains("JWT secret must be configured"),
                "Startup failure must identify the missing JWT secret");
    }

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

    @Test
    void testProductionDataSeedingIsExplicitlyDisabled() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application-prod.properties"));
        org.junit.jupiter.api.Assertions.assertEquals("false", properties.getProperty("app.seed.admin"),
                "Production must explicitly disable admin seeding");
        org.junit.jupiter.api.Assertions.assertEquals("false", properties.getProperty("app.seed.sample-data"),
                "Production must explicitly disable sample data seeding");
        org.junit.jupiter.api.Assertions.assertEquals("false", properties.getProperty("app.seed.mobile-pins"),
                "Production must explicitly disable mobile PIN seeding");
    }

    @Test
    void testProductionCorsOriginsConfigured() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application-prod.properties"));
        String corsOrigins = properties.getProperty("cors.allowed-origins");

        assertNotNull(corsOrigins, "Production properties must configure cors.allowed-origins");
        assertTrue(corsOrigins.contains("${CORS_ALLOWED_ORIGINS"), "cors.allowed-origins must be configurable via environment variable");
    }

    @Test
    void testProductionJwtSecretRequiresEnvironmentVariableWithoutFallback() throws IOException {
        Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application-prod.properties"));
        String jwtSecret = properties.getProperty("jwt.secret");

        org.junit.jupiter.api.Assertions.assertEquals("${JWT_SECRET}", jwtSecret,
                "Production jwt.secret must strictly bind to ${JWT_SECRET} without hardcoded fallback");
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = {
            DataSourceAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class,
            FlywayAutoConfiguration.class
    })
    @ConfigurationPropertiesScan
    @Import(JwtTokenProvider.class)
    static class JwtStartupTestApplication {
    }
}
