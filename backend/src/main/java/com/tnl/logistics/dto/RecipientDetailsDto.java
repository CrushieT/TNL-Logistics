package com.tnl.logistics.dto;

public class RecipientDetailsDto {

    private String fullName;
    private String contactNumber;
    private String address;

    public RecipientDetailsDto() {}

    public RecipientDetailsDto(String fullName, String contactNumber, String address) {
        this.fullName = fullName;
        this.contactNumber = contactNumber;
        this.address = address;
    }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}
