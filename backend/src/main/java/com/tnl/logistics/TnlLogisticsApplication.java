package com.tnl.logistics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main entry point for the TNL Logistics modular monolith backend application.
 * Defines standard Spring Boot application scanning and startup logic.
 */
@SpringBootApplication
public class TnlLogisticsApplication {

	public static void main(String[] args) {
		SpringApplication.run(TnlLogisticsApplication.class, args);
	}

}
