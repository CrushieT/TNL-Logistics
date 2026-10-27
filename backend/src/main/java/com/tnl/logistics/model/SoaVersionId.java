package com.tnl.logistics.model;

import java.io.Serializable;
import java.util.Objects;

public class SoaVersionId implements Serializable {

    private String soaNo;
    private int versionNumber;

    public SoaVersionId() {}

    public SoaVersionId(String soaNo, int versionNumber) {
        this.soaNo = soaNo;
        this.versionNumber = versionNumber;
    }

    public String getSoaNo() { return soaNo; }
    public void setSoaNo(String soaNo) { this.soaNo = soaNo; }

    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SoaVersionId that = (SoaVersionId) o;
        return versionNumber == that.versionNumber && Objects.equals(soaNo, that.soaNo);
    }

    @Override
    public int hashCode() {
        return Objects.hash(soaNo, versionNumber);
    }
}
