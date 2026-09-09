package com.tnl.logistics.controller;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST endpoints for admin-managed staff account operations.
 * All endpoints require ADMIN role.
 */
@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;
    private final AppUserRepository appUserRepository;

    public UserController(UserService userService, AppUserRepository appUserRepository) {
        this.userService = userService;
        this.appUserRepository = appUserRepository;
    }

    @GetMapping
    public ResponseEntity<Page<UserResponse>> listUsers(
            @RequestParam(defaultValue = "all") String role,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(userService.listUsers(role, status, page, size));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserResponse> getUser(@PathVariable String userId) {
        return ResponseEntity.ok(userService.getUser(userId));
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        return new ResponseEntity<>(userService.createUser(request), HttpStatus.CREATED);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UserUpdateRequest request) {
        String requestingUserId = resolveCurrentUserId();
        return ResponseEntity.ok(userService.updateUser(userId, request, requestingUserId));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable String userId) {
        String requestingUserId = resolveCurrentUserId();
        userService.deleteUser(userId, requestingUserId);
        return ResponseEntity.ok(Map.of("message", "User processed successfully."));
    }

    @PutMapping("/{userId}/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @PathVariable String userId,
            @Valid @RequestBody AdminPasswordResetRequest request) {
        String requestingUserId = resolveCurrentUserId();
        userService.resetPassword(userId, request, requestingUserId);
        return ResponseEntity.ok(Map.of("message", "Password reset. User will be prompted to change it on next login."));
    }

    @PutMapping("/{userId}/reset-pin")
    public ResponseEntity<Map<String, String>> resetPin(
            @PathVariable String userId,
            @Valid @RequestBody AdminPinResetRequest request) {
        String requestingUserId = resolveCurrentUserId();
        userService.resetPin(userId, request, requestingUserId);
        return ResponseEntity.ok(Map.of("message", "Mobile PIN updated successfully."));
    }

    private String resolveCurrentUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        String username = authentication.getName();
        return appUserRepository.findByUsername(username)
                .map(AppUser::getUserId)
                .orElse(username);
    }
}
