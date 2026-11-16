package com.tnl.logistics.dto;

/**
 * Public DTO representing mobile application version status and update gating requirements.
 */
public class MobileAppVersionDto {

    private Integer minSupportedVersionCode;
    private Integer latestVersionCode;
    private String latestVersionName;
    private String apkDownloadUrl;
    private Boolean forceUpdate;
    private String releaseNotes;

    public MobileAppVersionDto() {}

    public MobileAppVersionDto(Integer minSupportedVersionCode, Integer latestVersionCode,
                               String latestVersionName, String apkDownloadUrl,
                               Boolean forceUpdate, String releaseNotes) {
        this.minSupportedVersionCode = minSupportedVersionCode;
        this.latestVersionCode = latestVersionCode;
        this.latestVersionName = latestVersionName;
        this.apkDownloadUrl = apkDownloadUrl;
        this.forceUpdate = forceUpdate;
        this.releaseNotes = releaseNotes;
    }

    public Integer getMinSupportedVersionCode() {
        return minSupportedVersionCode;
    }

    public void setMinSupportedVersionCode(Integer minSupportedVersionCode) {
        this.minSupportedVersionCode = minSupportedVersionCode;
    }

    public Integer getLatestVersionCode() {
        return latestVersionCode;
    }

    public void setLatestVersionCode(Integer latestVersionCode) {
        this.latestVersionCode = latestVersionCode;
    }

    public String getLatestVersionName() {
        return latestVersionName;
    }

    public void setLatestVersionName(String latestVersionName) {
        this.latestVersionName = latestVersionName;
    }

    public String getApkDownloadUrl() {
        return apkDownloadUrl;
    }

    public void setApkDownloadUrl(String apkDownloadUrl) {
        this.apkDownloadUrl = apkDownloadUrl;
    }

    public Boolean getForceUpdate() {
        return forceUpdate;
    }

    public void setForceUpdate(Boolean forceUpdate) {
        this.forceUpdate = forceUpdate;
    }

    public String getReleaseNotes() {
        return releaseNotes;
    }

    public void setReleaseNotes(String releaseNotes) {
        this.releaseNotes = releaseNotes;
    }
}
