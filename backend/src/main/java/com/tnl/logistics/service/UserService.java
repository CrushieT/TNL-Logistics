package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import org.springframework.data.domain.Page;

/**
 * Service interface for staff account management operations.
 */
public interface UserService {

    Page<UserResponse> listUsers(String roleFilter, String statusFilter, int page, int size);

    UserResponse getUser(String userId);

    UserResponse createUser(UserCreateRequest request);

    UserResponse updateUser(String userId, UserUpdateRequest request, String requestingUserId);

    void deleteUser(String userId, String requestingUserId);

    void resetPassword(String userId, AdminPasswordResetRequest request, String requestingUserId);

    void resetPin(String userId, AdminPinResetRequest request, String requestingUserId);
}
