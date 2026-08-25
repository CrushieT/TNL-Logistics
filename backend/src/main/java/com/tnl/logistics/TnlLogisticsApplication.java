package com.tnl.logistics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main entry point for the TNL Logistics modular monolith backend application.
 * Defines standard Spring Boot application scanning, scheduling, and startup logic.
 */
@SpringBootApplication
@EnableScheduling
@EnableSpringDataWebSupport(pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class TnlLogisticsApplication {

	public static void main(String[] args) {
		SpringApplication.run(TnlLogisticsApplication.class, args);
	}

}
