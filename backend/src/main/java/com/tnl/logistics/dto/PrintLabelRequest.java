package com.tnl.logistics.dto;

import java.util.List;

public class PrintLabelRequest {

    private List<String> packageIds;

    public PrintLabelRequest() {}

    public PrintLabelRequest(List<String> packageIds) {
        this.packageIds = packageIds;
    }

    public List<String> getPackageIds() { return packageIds; }
    public void setPackageIds(List<String> packageIds) { this.packageIds = packageIds; }
}
