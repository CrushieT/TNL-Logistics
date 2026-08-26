package com.tnl.logistics.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security configuration for Spring Boot 3.4+.
 * Configured for a stateless REST API using stateless JWT authorization.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

	@Bean
	public BCryptPasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.cors(Customizer.withDefaults()) // Integrates with CorsConfig
			.csrf(csrf -> csrf.disable()) // Disabled for stateless APIs
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth
				// Allow CORS preflight OPTIONS requests
				.requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
				// Allow public access to API documentation (Swagger/OpenAPI)
				.requestMatchers(
						"/v3/api-docs/**",
						"/swagger-ui/**",
						"/swagger-ui.html"
				).permitAll()
				// Allow public access to Login auth endpoint
				.requestMatchers("/api/v1/auth/login").permitAll()
				// Secure all other REST API endpoints
				.requestMatchers("/api/v1/**").authenticated()
				.anyRequest().authenticated()
			)
			// Wire the JWT token verification filter
			.addFilterBefore(new JwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

}
