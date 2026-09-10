package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.CompanyBrandingDto;
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
        return refreshCachedSettings();
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
                settings.getVolumetricDivisor()
        );
    }

    @Override
    @Transactional
    public SystemSettingDto updateSettings(UpdateSystemSettingRequest request, String actingUsername) {
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
        setting.setUpdatedBy(actingUsername != null ? actingUsername : "ADMIN");

        SystemSetting saved = systemSettingRepository.save(setting);
        SystemSettingDto dto = toDto(saved);
        this.cachedSettings = dto;

        log.info("System settings updated by {}: collectionDay={}, volumetricDivisor={}",
                actingUsername, dto.getCollectionDay(), dto.getVolumetricDivisor());

        try {
            sseService.broadcastEvent("SETTINGS_UPDATED", dto);
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

    private synchronized SystemSettingDto refreshCachedSettings() {
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
        return dto;
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
                setting.getTrackingPrefix() != null ? setting.getTrackingPrefix() : "TRK",
                setting.getShipmentPrefix() != null ? setting.getShipmentPrefix() : "SHP",
                setting.getUpdatedAt(),
                setting.getUpdatedBy()
        );
    }
}
