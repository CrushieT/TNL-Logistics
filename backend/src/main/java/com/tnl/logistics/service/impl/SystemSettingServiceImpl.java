package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.CompanyBrandingDto;
import com.tnl.logistics.dto.MobileAppVersionDto;
import com.tnl.logistics.dto.SystemSettingDto;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.repository.SystemSettingRepository;
import com.tnl.logistics.service.SseService;
import com.tnl.logistics.service.SystemSettingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;

/**
 * Service implementation for system configuration management with in-memory caching
 * and real-time SSE synchronization.
 */
@Service
public class SystemSettingServiceImpl implements SystemSettingService {

    private static final Logger log = LoggerFactory.getLogger(SystemSettingServiceImpl.class);

    private final SystemSettingRepository systemSettingRepository;
    private final SseService sseService;

    private volatile SystemSettingDto cachedSettings;
    private volatile MobileAppVersionDto cachedMobileVersionPolicy;
    private volatile long lastVersionCheckTime = 0;
    private static final long VERSION_CACHE_TTL_MS = 5000L;

    public SystemSettingServiceImpl(SystemSettingRepository systemSettingRepository, SseService sseService) {
        this.systemSettingRepository = systemSettingRepository;
        this.sseService = sseService;
    }

    @Override
    @Transactional(readOnly = true)
    public SystemSettingDto getSettings() {
        if (cachedSettings != null) {
            return cachedSettings;
        }
        refreshCachedSettings();
        return cachedSettings;
    }

    @Override
    @Transactional(readOnly = true)
    public CompanyBrandingDto getCompanyBranding() {
        SystemSettingDto settings = getSettings();
        return new CompanyBrandingDto(
                settings.getCompanyName(),
                settings.getCompanyAddress(),
                settings.getCompanyContact(),
                settings.getBillingEmail(),
                settings.getCollectionDay(),
                settings.getVolumetricDivisor(),
                settings.getRatePerKilo()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public MobileAppVersionDto getMobileAppVersion() {
        SystemSetting setting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)
                .orElseGet(SystemSetting::new);
        return toMobileAppVersionDto(setting);
    }

    @Override
    public MobileAppVersionDto getCachedMobileVersionPolicy() {
        long now = System.currentTimeMillis();
        MobileAppVersionDto cached = this.cachedMobileVersionPolicy;
        if (cached != null && (now - lastVersionCheckTime < VERSION_CACHE_TTL_MS)) {
            return cached;
        }
        synchronized (this) {
            now = System.currentTimeMillis();
            if (this.cachedMobileVersionPolicy != null && (now - lastVersionCheckTime < VERSION_CACHE_TTL_MS)) {
                return this.cachedMobileVersionPolicy;
            }
            MobileAppVersionDto fetched = getMobileAppVersion();
            this.cachedMobileVersionPolicy = fetched;
            this.lastVersionCheckTime = now;
            return fetched;
        }
    }

    @Override
    @Transactional
    public SystemSettingDto updateSettings(UpdateSystemSettingRequest request, String actingUserId) {
        SystemSetting setting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)
                .orElseGet(() -> new SystemSetting(
                        SystemSetting.DEFAULT_SETTING_ID,
                        "TNL Logistics",
                        "Manila Central Hub",
                        "0917-555-0000",
                        "billing@tnllogistics.ph",
                        DayOfWeek.THURSDAY,
                        5000,
                        "TRK",
                        "SHP"
                ));

        setting.setCompanyName(request.getCompanyName().trim());
        setting.setCompanyAddress(request.getCompanyAddress().trim());
        setting.setCompanyContact(request.getCompanyContact().trim());
        setting.setBillingEmail(request.getBillingEmail().trim());
        setting.setCollectionDay(request.getCollectionDay());
        setting.setVolumetricDivisor(request.getVolumetricDivisor());
        setting.setRatePerKilo(request.getRatePerKilo());
        setting.setSoaBankName(request.getSoaBankName().trim());
        setting.setSoaAccountName(request.getSoaAccountName().trim());
        setting.setSoaAccountNumber(request.getSoaAccountNumber().trim());
        if (request.getMinMobileVersionCode() != null) {
            setting.setMinMobileVersionCode(request.getMinMobileVersionCode());
        }
        if (request.getLatestMobileVersionCode() != null) {
            setting.setLatestMobileVersionCode(request.getLatestMobileVersionCode());
        }
        if (request.getLatestMobileVersionName() != null && !request.getLatestMobileVersionName().isBlank()) {
            setting.setLatestMobileVersionName(request.getLatestMobileVersionName().trim());
        }
        if (request.getMobileApkDownloadUrl() != null) {
            String url = request.getMobileApkDownloadUrl().trim();
            setting.setMobileApkDownloadUrl(url.isEmpty() ? null : url);
        }
        if (request.getMobileForceUpdate() != null) {
            setting.setMobileForceUpdate(request.getMobileForceUpdate());
        }
        if (request.getMobileUpdateReleaseNotes() != null) {
            String notes = request.getMobileUpdateReleaseNotes().trim();
            setting.setMobileUpdateReleaseNotes(notes.isEmpty() ? null : notes);
        }
        setting.setUpdatedBy(actingUserId != null ? actingUserId : "ADMIN");

        SystemSetting saved = systemSettingRepository.save(setting);
        SystemSettingDto dto = toDto(saved);
        this.cachedSettings = dto;
        this.cachedMobileVersionPolicy = toMobileAppVersionDto(saved);
        this.lastVersionCheckTime = System.currentTimeMillis();

        log.info("System settings updated by {}: collectionDay={}, volumetricDivisor={}, ratePerKilo={}",
                actingUserId, dto.getCollectionDay(), dto.getVolumetricDivisor(), dto.getRatePerKilo());

        try {
            sseService.broadcastEvent("SETTINGS_UPDATED", toCompanyBrandingDto(dto));
        } catch (Exception e) {
            log.warn("Failed to broadcast SETTINGS_UPDATED SSE event: {}", e.getMessage());
        }

        return dto;
    }

    @Override
    public DayOfWeek getCollectionDay() {
        return getSettings().getCollectionDay();
    }

    @Override
    public Integer getVolumetricDivisor() {
        return getSettings().getVolumetricDivisor();
    }

    @Override
    public java.math.BigDecimal getRatePerKilo() {
        return getSettings().getRatePerKilo();
    }

    @Override
    public synchronized void refreshCachedSettings() {
        SystemSetting setting = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)
                .orElseGet(() -> systemSettingRepository.save(new SystemSetting(
                        SystemSetting.DEFAULT_SETTING_ID,
                        "TNL Logistics",
                        "Manila Central Hub",
                        "0917-555-0000",
                        "billing@tnllogistics.ph",
                        DayOfWeek.THURSDAY,
                        5000,
                        "TRK",
                        "SHP"
                )));
        SystemSettingDto dto = toDto(setting);
        this.cachedSettings = dto;
        this.cachedMobileVersionPolicy = toMobileAppVersionDto(setting);
        this.lastVersionCheckTime = System.currentTimeMillis();
    }

    private MobileAppVersionDto toMobileAppVersionDto(SystemSetting setting) {
        if (setting == null) {
            return new MobileAppVersionDto(1, 1, "1.0.0", null, true, null);
        }
        return new MobileAppVersionDto(
                setting.getMinMobileVersionCode(),
                setting.getLatestMobileVersionCode(),
                setting.getLatestMobileVersionName(),
                setting.getMobileApkDownloadUrl(),
                setting.getMobileForceUpdate(),
                setting.getMobileUpdateReleaseNotes()
        );
    }

    private SystemSettingDto toDto(SystemSetting setting) {
        return new SystemSettingDto(
                setting.getSettingId(),
                setting.getCompanyName(),
                setting.getCompanyAddress(),
                setting.getCompanyContact(),
                setting.getBillingEmail(),
                setting.getCollectionDay() != null ? setting.getCollectionDay() : DayOfWeek.THURSDAY,
                setting.getVolumetricDivisor() != null ? setting.getVolumetricDivisor() : 5000,
                setting.getRatePerKilo(),
                setting.getSoaBankName(),
                setting.getSoaAccountName(),
                setting.getSoaAccountNumber(),
                setting.getTrackingPrefix() != null ? setting.getTrackingPrefix() : "TRK",
                setting.getShipmentPrefix() != null ? setting.getShipmentPrefix() : "SHP",
                setting.getMinMobileVersionCode() != null ? setting.getMinMobileVersionCode() : 1,
                setting.getLatestMobileVersionCode() != null ? setting.getLatestMobileVersionCode() : 1,
                setting.getLatestMobileVersionName() != null ? setting.getLatestMobileVersionName() : "1.0.0",
                setting.getMobileApkDownloadUrl(),
                setting.getMobileForceUpdate() != null ? setting.getMobileForceUpdate() : true,
                setting.getMobileUpdateReleaseNotes(),
                setting.getUpdatedAt(),
                setting.getUpdatedBy()
        );
    }

    private CompanyBrandingDto toCompanyBrandingDto(SystemSettingDto settings) {
        return new CompanyBrandingDto(
                settings.getCompanyName(),
                settings.getCompanyAddress(),
                settings.getCompanyContact(),
                settings.getBillingEmail(),
                settings.getCollectionDay(),
                settings.getVolumetricDivisor(),
                settings.getRatePerKilo()
        );
    }
}
