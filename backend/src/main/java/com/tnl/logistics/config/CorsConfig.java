package com.tnl.logistics.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * Global CORS configuration.
 * Enables communication between the backend and configured frontend origins.
 */
@Configuration
public class CorsConfig {

	@Value("${cors.allowed-origins:http://localhost:*,http://127.0.0.1:*}")
	private String allowedOrigins;

	@Bean
	public WebMvcConfigurer corsConfigurer() {
		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(CorsRegistry registry) {
				String[] origins = Arrays.stream(allowedOrigins.split(","))
						.map(String::trim)
						.filter(s -> !s.isEmpty())
						.toArray(String[]::new);

				registry.addMapping("/**")
						.allowedOriginPatterns(origins)
						.allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
						.allowedHeaders("*")
						.allowCredentials(true)
						.maxAge(3600);
			}
		};
	}

}
