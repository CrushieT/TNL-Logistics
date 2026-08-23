package com.tnl.logistics.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security configuration for Spring Boot 3.4+.
 * Configured for a stateless REST API, enabling CORS (delegated to CorsConfig),
 * disabling CSRF, and permitting Swagger-UI documentation.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.cors(Customizer.withDefaults()) // Integrates with Spring MVC CORS config (CorsConfig)
			.csrf(csrf -> csrf.disable()) // Disabled for stateless REST APIs
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth
				// Allow public access to API documentation (Swagger/OpenAPI)
				.requestMatchers(
						"/v3/api-docs/**",
						"/swagger-ui/**",
						"/swagger-ui.html"
				).permitAll()
				// TODO: Secure endpoints in production; permitting all for local development boostrap
				.requestMatchers("/api/v1/**").permitAll()
				.anyRequest().authenticated()
			)
			// Configure HTTP Basic as a fallback placeholder (or swap to JWT/OAuth2 filter)
			.httpBasic(Customizer.withDefaults());

		return http.build();
	}

}
