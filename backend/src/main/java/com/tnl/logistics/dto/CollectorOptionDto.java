package com.tnl.logistics.dto;

public class CollectorOptionDto {

    private String userId;
    private String fullName;
    private String username;
    private String role;

    public CollectorOptionDto() {}

    public CollectorOptionDto(String userId, String fullName, String username, String role) {
        this.userId = userId;
        this.fullName = fullName;
        this.username = username;
        this.role = role;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
