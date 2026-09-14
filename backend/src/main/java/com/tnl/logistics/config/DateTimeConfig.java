package com.tnl.logistics.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Configuration providing central date and time abstractions for the application.
 * Enables deterministic, clock-injected testing for financial reporting and age calculations.
 */
@Configuration
public class DateTimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
