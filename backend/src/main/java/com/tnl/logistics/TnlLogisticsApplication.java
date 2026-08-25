package com.tnl.logistics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.web.config.EnableSpringDataWebSupport;

/**
 * Main entry point for the TNL Logistics modular monolith backend application.
 * Defines standard Spring Boot application scanning and startup logic.
 */
@SpringBootApplication
@EnableSpringDataWebSupport(pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class TnlLogisticsApplication {

	public static void main(String[] args) {
		SpringApplication.run(TnlLogisticsApplication.class, args);
	}

}
