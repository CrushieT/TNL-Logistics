package com.tnl.logistics.dto;

import java.util.List;

public class PrintLabelRequest {

    private List<String> packageIds;
    private String printerId;

    public PrintLabelRequest() {}

    public PrintLabelRequest(List<String> packageIds) {
        this.packageIds = packageIds;
    }

    public PrintLabelRequest(List<String> packageIds, String printerId) {
        this.packageIds = packageIds;
        this.printerId = printerId;
    }

    public List<String> getPackageIds() { return packageIds; }
    public void setPackageIds(List<String> packageIds) { this.packageIds = packageIds; }

    public String getPrinterId() { return printerId; }
    public void setPrinterId(String printerId) { this.printerId = printerId; }
}
