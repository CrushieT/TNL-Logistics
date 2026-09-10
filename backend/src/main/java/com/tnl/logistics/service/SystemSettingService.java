package com.tnl.logistics.service;

import com.tnl.logistics.dto.CompanyBrandingDto;
import com.tnl.logistics.dto.SystemSettingDto;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;

import java.time.DayOfWeek;

/**
 * Service contract for managing application configuration, company branding,
 * weekly collection day, and volumetric calculation settings.
 */
public interface SystemSettingService {

    /**
     * Retrieve full system settings for administrative management.
     */
    SystemSettingDto getSettings();

    /**
     * Retrieve lightweight company branding, collection day, and calculation parameters.
     */
    CompanyBrandingDto getCompanyBranding();

    /**
     * Update system settings and broadcast real-time update event.
     */
    SystemSettingDto updateSettings(UpdateSystemSettingRequest request, String actingUsername);

    /**
     * Retrieve the active configured weekly collection closing day.
     */
    DayOfWeek getCollectionDay();

    /**
     * Retrieve the active configured volumetric weight divisor.
     */
    Integer getVolumetricDivisor();
}
