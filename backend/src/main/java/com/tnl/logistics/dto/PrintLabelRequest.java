package com.tnl.logistics.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class PrintLabelRequest {

    @NotNull(message = "Print job ID is required")
    private UUID printJobId;

    private List<@NotBlank(message = "Tracking ID must not be blank") String> packageIds;

    @Size(max = 20, message = "Printer ID must not exceed 20 characters")
    private String printerId;

    public PrintLabelRequest() {}

    public PrintLabelRequest(UUID printJobId, List<String> packageIds) {
        this.printJobId = printJobId;
        this.packageIds = packageIds;
    }

    public PrintLabelRequest(UUID printJobId, List<String> packageIds, String printerId) {
        this.printJobId = printJobId;
        this.packageIds = packageIds;
        this.printerId = printerId;
    }

    public UUID getPrintJobId() { return printJobId; }
    public void setPrintJobId(UUID printJobId) { this.printJobId = printJobId; }

    public List<String> getPackageIds() { return packageIds; }
    public void setPackageIds(List<String> packageIds) { this.packageIds = packageIds; }

    public String getPrinterId() { return printerId; }
    public void setPrinterId(String printerId) { this.printerId = printerId; }
}
