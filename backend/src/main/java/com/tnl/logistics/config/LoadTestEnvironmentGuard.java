package com.tnl.logistics.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Prevents the load-test profile from connecting to any non-load-test database. */
@Component
@Profile("loadtest")
public class LoadTestEnvironmentGuard {

    private final String datasourceUrl;
    private final String expectedDatabase;

    public LoadTestEnvironmentGuard(
            @Value("${spring.datasource.url}") String datasourceUrl,
            @Value("${app.loadtest.expected-database}") String expectedDatabase) {
        this.datasourceUrl = datasourceUrl;
        this.expectedDatabase = expectedDatabase;
    }

    @PostConstruct
    void verifyDatasource() {
        String configuredDatabase = extractDatabaseName(datasourceUrl);
        if (!expectedDatabase.equalsIgnoreCase(configuredDatabase)) {
            throw new IllegalStateException("loadtest profile requires database " + expectedDatabase);
        }
    }

    static String extractDatabaseName(String jdbcUrl) {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            return "";
        }
        String withoutParameters = jdbcUrl.substring(0, jdbcUrl.indexOf('?') >= 0 ? jdbcUrl.indexOf('?') : jdbcUrl.length());
        int separator = withoutParameters.lastIndexOf('/');
        return separator >= 0 ? withoutParameters.substring(separator + 1) : "";
    }
}
