package com.tnl.logistics.dto;

/**
 * DTO for successful login responses.
 */
public class LoginResponse {

    private String token;
    private String userId;
    private String username;
    private String role;
    private boolean mustChangePassword;

    public LoginResponse() {}

    public LoginResponse(String token, String userId, String username, String role, boolean mustChangePassword) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.role = role;
        this.mustChangePassword = mustChangePassword;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
}
