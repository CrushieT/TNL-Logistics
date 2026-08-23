package com.tnl.logistics.controller;

import com.tnl.logistics.config.JwtTokenProvider;
import com.tnl.logistics.dto.LoginRequest;
import com.tnl.logistics.dto.LoginResponse;
import com.tnl.logistics.dto.PasswordChangeRequest;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller handling authentication endpoints (Login and Password Change).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthController(AppUserRepository appUserRepository, BCryptPasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        AppUser user = appUserRepository.findByUsername(request.getUsername())
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        }

        if (!user.getActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Account is deactivated"));
        }

        String token = JwtTokenProvider.generateToken(user.getUsername(), user.getRole().name());

        LoginResponse response = new LoginResponse(
                token,
                user.getUserId(),
                user.getUsername(),
                user.getRole().name(),
                user.getMustChangePassword()
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping("/password-change")
    public ResponseEntity<?> changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        AppUser user = appUserRepository.findByUsername(username)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "User not found"));
        }

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Incorrect current password"));
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(false);
        appUserRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }
}
