package com.tnl.logistics.exception;

import com.tnl.logistics.model.AppUser;
import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.service.AuthSecurityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final Logger securityAuditLog = LoggerFactory.getLogger("SECURITY_AUDIT");

    private final AppUserRepository appUserRepository;
    private final AuthSecurityService authSecurityService;

    public GlobalExceptionHandler(
            AppUserRepository appUserRepository,
            AuthSecurityService authSecurityService) {
        this.appUserRepository = appUserRepository;
        this.authSecurityService = authSecurityService;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request) {
        auditSecurityFailure(request, "MOBILE_ROLE_REQUIRED");
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.FORBIDDEN.value());
        error.put("error", "Forbidden");
        if (request.getRequestURI().endsWith("/auth/mobile-setup-pin")
                || request.getRequestURI().endsWith("/auth/mobile-unbind")) {
            error.put("code", "MOBILE_ROLE_REQUIRED");
            error.put("message", "A mobile staff role is required.");
        } else {
            error.put("message", "Access is denied.");
        }
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleSecurityMutationConflict(
            PessimisticLockingFailureException ex,
            HttpServletRequest request) {
        auditSecurityFailure(request, "SECURITY_MUTATION_CONFLICT");
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.CONFLICT.value());
        error.put("error", "Conflict");
        error.put("code", "SECURITY_MUTATION_CONFLICT");
        error.put("message", "The security update conflicted with another request. Please retry.");
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        log.warn("Illegal state: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Illegal State Transition");
        error.put("message", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        auditSecurityFailure(request, "VALIDATION_FAILED");
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Validation Failed");

        Map<String, String> fieldErrors = new HashMap<>();
        String primaryMessage = null;
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
            if (primaryMessage == null) {
                primaryMessage = fe.getDefaultMessage();
            }
        }
        error.put("message", primaryMessage != null ? primaryMessage : "Validation failed");
        error.put("fieldErrors", fieldErrors);

        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.CONFLICT.value());
        error.put("error", "Conflict");
        error.put("message", "Database constraint violation occurred. A duplicate key, invalid reference, or restricted record prevented this operation.");
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex,
            HttpServletRequest request) {
        auditSecurityFailure(request, "MALFORMED_REQUEST");
        log.warn("Malformed HTTP request body.");
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Malformed request body or invalid data format.");
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParams(MissingServletRequestParameterException ex) {
        log.warn("Missing parameter: {}", ex.getParameterName());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Required parameter '" + ex.getParameterName() + "' is missing.");
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Parameter type mismatch: {}", ex.getName());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.BAD_REQUEST.value());
        error.put("error", "Bad Request");
        error.put("message", "Invalid format for parameter '" + ex.getName() + "'.");
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(org.springframework.web.server.ResponseStatusException ex) {
        log.warn("Response status exception: [{}] {}", ex.getStatusCode(), ex.getReason());
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", ex.getStatusCode().value());
        error.put("error", ex.getStatusCode().toString());
        error.put("message", ex.getReason());
        return new ResponseEntity<>(error, ex.getStatusCode());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(
            Exception ex,
            HttpServletRequest request) throws Exception {
        if (ex instanceof AccessDeniedException || ex instanceof AuthenticationException) {
            throw ex;
        }

        auditSecurityFailure(request, "INTERNAL_ERROR");
        log.error("Unhandled internal server error: ", ex);
        Map<String, Object> error = new HashMap<>();
        error.put("timestamp", LocalDateTime.now());
        error.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        error.put("error", "Internal Server Error");
        error.put("message", "An unexpected internal server error occurred. Please contact system administrator.");
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private void auditSecurityFailure(HttpServletRequest request, String reason) {
        if (request == null) {
            return;
        }
        String userId = authenticatedUserId();
        AppUser user = null;
        if (userId != null) {
            try {
                user = appUserRepository.findById(userId).orElse(null);
            } catch (RuntimeException ignored) {
                user = null;
            }
        }
        String event = resolveSecurityEvent(request.getRequestURI(), user);
        if (event == null) {
            return;
        }
        String deviceId = request.getHeader("X-Device-Id");
        String maskedDeviceId = authSecurityService.isValidDeviceId(deviceId)
                ? authSecurityService.maskDeviceId(deviceId)
                : "-";
        String role = user != null && user.getRole() != null ? user.getRole().name() : "-";
        String clientIp = request.getRemoteAddr();
        securityAuditLog.warn(
                "{} userId={} role={} device={} ip={} reason={}",
                event,
                userId != null ? userId : "-",
                role,
                maskedDeviceId,
                clientIp != null && !clientIp.isBlank() ? clientIp : "-",
                reason);
    }

    private String authenticatedUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof String principal)
                || "anonymousUser".equals(principal)) {
            return null;
        }
        return principal;
    }

    private String resolveSecurityEvent(String requestUri, AppUser user) {
        if (requestUri == null) {
            return null;
        }
        if (requestUri.endsWith("/auth/password-change")) {
            return "PASSWORD_CHANGE_FAILURE";
        }
        if (requestUri.endsWith("/auth/verify-password")) {
            return "PASSWORD_VERIFY_FAILURE";
        }
        if (requestUri.endsWith("/auth/mobile-unbind")) {
            return "DEVICE_UNBIND_FAILURE";
        }
        if (requestUri.endsWith("/auth/mobile-setup-pin")) {
            return user != null && user.getPinHash() != null && !user.getPinHash().isBlank()
                    ? "PIN_ROTATION_FAILURE"
                    : "PIN_SETUP_FAILURE";
        }
        return null;
    }
}
