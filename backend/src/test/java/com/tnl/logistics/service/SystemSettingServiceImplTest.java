package com.tnl.logistics.service;

import com.tnl.logistics.dto.CompanyBrandingDto;
import com.tnl.logistics.dto.UpdateSystemSettingRequest;
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.repository.SystemSettingRepository;
import com.tnl.logistics.service.impl.SystemSettingServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemSettingServiceImplTest {

    @Mock
    private SystemSettingRepository systemSettingRepository;

    @Mock
    private SseService sseService;

    @Test
    void updateBroadcastsSafeBrandingPayloadWithoutBankDetails() {
        SystemSetting setting = new SystemSetting();
        when(systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)).thenReturn(Optional.of(setting));
        when(systemSettingRepository.save(setting)).thenReturn(setting);

        UpdateSystemSettingRequest request = new UpdateSystemSettingRequest(
                "TNL Logistics",
                "Manila Central Hub",
                "09175550000",
                "billing@tnllogistics.ph",
                DayOfWeek.THURSDAY,
                5000,
                new BigDecimal("100.00")
        );
        request.setSoaBankName("Sensitive Test Bank");
        request.setSoaAccountName("Sensitive Test Account");
        request.setSoaAccountNumber("000000123456");

        SystemSettingServiceImpl service = new SystemSettingServiceImpl(systemSettingRepository, sseService);
        service.updateSettings(request, "USR-ADMIN");

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(sseService).broadcastEvent(eq("SETTINGS_UPDATED"), payloadCaptor.capture());
        assertInstanceOf(CompanyBrandingDto.class, payloadCaptor.getValue());
    }
}
