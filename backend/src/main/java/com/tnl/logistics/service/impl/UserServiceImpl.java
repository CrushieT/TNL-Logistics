package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.model.StaffType;
import com.tnl.logistics.model.UserRole;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
public class UserServiceImpl implements UserService {

    private static final String USER_ID_PREFIX = "U-";

    private final AppUserRepository appUserRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserServiceImpl(AppUserRepository appUserRepository, BCryptPasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> listUsers(String roleFilter, String statusFilter, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        List<UserRole> roles = resolveRoleFilter(roleFilter);

        if (statusFilter != null && statusFilter.equalsIgnoreCase("active")) {
            return appUserRepository.findByActiveAndRoleInOrderByUserIdAsc(true, roles, pageable)
                    .map(UserResponse::from);
        }
        if (statusFilter != null && statusFilter.equalsIgnoreCase("inactive")) {
            return appUserRepository.findByActiveAndRoleInOrderByUserIdAsc(false, roles, pageable)
                    .map(UserResponse::from);
        }
        return appUserRepository.findByRoleInOrderByUserIdAsc(roles, pageable)
                .map(UserResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUser(String userId) {
        AppUser user = findUserOrThrow(userId);
        return UserResponse.from(user);
    }

    @Override
    public synchronized UserResponse createUser(UserCreateRequest request) {
        if (request.getRole() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Administrator account creation is not permitted. Only one system administrator account is allowed.");
        }

        String normalizedUsername = request.getUsername() != null ? request.getUsername().trim().toLowerCase() : null;
        if (appUserRepository.findByUsername(normalizedUsername).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Username '" + normalizedUsername + "' is already taken.");
        }

        if (request.getRole() == UserRole.FIELD_STAFF && request.getStaffType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Staff type is required for Field Staff accounts.");
        }

        String userId = generateNextUserId();

        AppUser user = new AppUser(
                userId,
                normalizedUsername,
                passwordEncoder.encode(request.getPassword()),
                request.getFullName(),
                request.getRole()
        );
        user.setMustChangePassword(true);

        if (request.getRole() == UserRole.FIELD_STAFF) {
            user.setStaffType(request.getStaffType());
        }

        if (request.getPin() != null && !request.getPin().isBlank()) {
            user.setPinHash(passwordEncoder.encode(request.getPin()));
        }

        appUserRepository.save(user);
        return UserResponse.from(user);
    }

    @Override
    public UserResponse updateUser(String userId, UserUpdateRequest request, String requestingUserId) {
        guardSelfModification(userId, requestingUserId);
        AppUser user = findUserOrThrow(userId);

        if (user.getRole() != UserRole.ADMIN && request.getRole() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot promote account to administrator. Only one system administrator account is allowed.");
        }

        if (user.getRole() == UserRole.ADMIN && request.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The administrator account role cannot be changed.");
        }

        String normalizedUsername = request.getUsername() != null ? request.getUsername().trim().toLowerCase() : null;
        appUserRepository.findByUsername(normalizedUsername).ifPresent(existing -> {
            if (!existing.getUserId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Username '" + normalizedUsername + "' is already taken.");
            }
        });

        if (request.getRole() == UserRole.FIELD_STAFF && request.getStaffType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Staff type is required for Field Staff accounts.");
        }

        user.setFullName(request.getFullName());
        user.setUsername(normalizedUsername);
        user.setRole(request.getRole());
        user.setActive(request.getActive());

        if (request.getRole() == UserRole.FIELD_STAFF) {
            user.setStaffType(request.getStaffType());
        } else {
            user.setStaffType(null);
        }

        appUserRepository.save(user);
        return UserResponse.from(user);
    }

    @Override
    public void deleteUser(String userId, String requestingUserId) {
        guardSelfModification(userId, requestingUserId);
        AppUser user = findUserOrThrow(userId);

        if (user.getRole() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The system administrator account cannot be deleted or deactivated.");
        }

        long linkedRecords = appUserRepository.countTrackingEventsByStaff(userId)
                + appUserRepository.countPaymentsByStaff(userId)
                + appUserRepository.countWaybillsByStaff(userId)
                + appUserRepository.countSoaBatchesByStaff(userId)
                + appUserRepository.countPrintEventsByStaff(userId);

        if (linkedRecords > 0) {
            // Soft deactivate — preserves audit trail
            user.setActive(false);
            appUserRepository.save(user);
        } else {
            appUserRepository.delete(user);
        }
    }

    @Override
    public void resetPassword(String userId, AdminPasswordResetRequest request, String requestingUserId) {
        guardSelfModification(userId, requestingUserId);
        AppUser user = findUserOrThrow(userId);
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(true);
        user.incrementTokenVersion();
        appUserRepository.save(user);
    }

    @Override
    public void resetPin(String userId, AdminPinResetRequest request, String requestingUserId) {
        guardSelfModification(userId, requestingUserId);
        AppUser user = findUserOrThrow(userId);
        if (Boolean.TRUE.equals(request.getClearPin()) || request.getPin() == null || request.getPin().isBlank()) {
            user.setPinHash(null);
        } else {
            user.setPinHash(passwordEncoder.encode(request.getPin()));
        }
        user.incrementTokenVersion();
        appUserRepository.save(user);
    }

    // Generates the next U-NNN sequential user ID
    private String generateNextUserId() {
        String maxId = appUserRepository.findMaxUserIdWithPrefix(USER_ID_PREFIX + "%").orElse(null);
        int nextSeq = 1;
        if (maxId != null && maxId.startsWith(USER_ID_PREFIX)) {
            try {
                nextSeq = Integer.parseInt(maxId.substring(USER_ID_PREFIX.length())) + 1;
            } catch (NumberFormatException ignored) {}
        }
        return String.format("U-%03d", nextSeq);
    }

    private AppUser findUserOrThrow(String userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));
    }

    private void guardSelfModification(String targetUserId, String requestingUserId) {
        if (targetUserId.equals(requestingUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot modify your own account from this screen.");
        }
    }

    private List<UserRole> resolveRoleFilter(String roleFilter) {
        if (roleFilter == null || roleFilter.isBlank() || roleFilter.equalsIgnoreCase("all")) {
            return List.of(UserRole.ADMIN, UserRole.OFFICE_STAFF, UserRole.FIELD_STAFF);
        }
        try {
            return List.of(UserRole.valueOf(roleFilter.toUpperCase()));
        } catch (IllegalArgumentException e) {
            return List.of(UserRole.ADMIN, UserRole.OFFICE_STAFF, UserRole.FIELD_STAFF);
        }
    }
}
