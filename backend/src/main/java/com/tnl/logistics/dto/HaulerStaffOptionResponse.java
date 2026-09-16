package com.tnl.logistics.dto;

import com.tnl.logistics.model.StaffType;

public class HaulerStaffOptionResponse {
    private String userId;
    private String fullName;
    private StaffType staffType;
    private String haulerCompany;
    private String displayLabel;

    public HaulerStaffOptionResponse() {}

    public HaulerStaffOptionResponse(String userId, String fullName, StaffType staffType, String haulerCompany, String displayLabel) {
        this.userId = userId;
        this.fullName = fullName;
        this.staffType = staffType;
        this.haulerCompany = haulerCompany;
        this.displayLabel = displayLabel;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public StaffType getStaffType() { return staffType; }
    public void setStaffType(StaffType staffType) { this.staffType = staffType; }

    public String getHaulerCompany() { return haulerCompany; }
    public void setHaulerCompany(String haulerCompany) { this.haulerCompany = haulerCompany; }

    public String getDisplayLabel() { return displayLabel; }
    public void setDisplayLabel(String displayLabel) { this.displayLabel = displayLabel; }
}
