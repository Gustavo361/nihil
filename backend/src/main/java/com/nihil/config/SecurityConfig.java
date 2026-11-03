package com.nihil.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;

/**
 * Initial Security setup only. Full authentication and authorization will be
 * implemented in the identity module later. Health endpoints stay public so
 * local smoke checks work without credentials.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.cors(Customizer.withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
						.anyRequest().authenticated())
				.httpBasic(Customizer.withDefaults());

		return http.build();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(
			@org.springframework.beans.factory.annotation.Value("${nihil.cors.allowed-origins:http://localhost:4200}") String allowedOrigins) {
		var configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
				.map(String::trim).filter(origin -> !origin.isEmpty()).toList());
		configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "Accept"));
		configuration.setAllowCredentials(false);
		configuration.setMaxAge(3600L);
		var source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

	@Bean
	UserDetailsService userDetailsService(JdbcTemplate jdbc) {
		return username -> jdbc.query(
				"select username, password_hash, active from app_user where username = ?",
				resultSet -> {
					if (!resultSet.next() || !resultSet.getBoolean("active")) {
						throw new org.springframework.security.core.userdetails.UsernameNotFoundException(username);
					}
					return User.withUsername(resultSet.getString("username"))
							.password("{bcrypt}" + resultSet.getString("password_hash"))
							.authorities("USER")
							.build();
				}, username);
	}
}
