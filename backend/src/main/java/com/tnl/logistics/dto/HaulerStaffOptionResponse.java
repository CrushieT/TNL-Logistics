package com.tnl.logistics.dto;


public class HaulerStaffOptionResponse {
    private String userId;
    private String fullName;
    private String displayLabel;

    public HaulerStaffOptionResponse() {}

    public HaulerStaffOptionResponse(String userId, String fullName, String displayLabel) {
        this.userId = userId;
        this.fullName = fullName;
        this.displayLabel = displayLabel;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }



    public String getDisplayLabel() { return displayLabel; }
    public void setDisplayLabel(String displayLabel) { this.displayLabel = displayLabel; }
}
