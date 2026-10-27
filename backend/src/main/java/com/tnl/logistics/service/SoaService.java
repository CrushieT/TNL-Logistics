package com.tnl.logistics.service;

import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.SoaLogoAsset;

import java.time.LocalDate;
import java.util.List;

/**
 * Service interface for Statement of Account (SOA) previewing, deductions, and version persistence.
 */
public interface SoaService {

    StatementPreviewResponse getStatementPreview(String clientId, LocalDate targetDate);

    StatementPreviewResponse getStatementVersion(String clientId, LocalDate targetDate, Integer versionNumber);

    StatementPreviewResponse saveStatement(SaveStatementRequest request, String actingUserId);

    StatementPreviewResponse generateStatement(SaveStatementRequest request, String actingUserId);

    StatementPreviewResponse saveStatementVersion(SaveStatementVersionRequest request, String actingUserId);

    StatementPreviewResponse ensureV1Snapshot(EnsureV1Request request, String actingUserId);

    List<SoaVersionSummaryDto> listVersions(String clientId, LocalDate targetDate);

    List<SoaVersionSummaryDto> listVersionsBySoaNo(String soaNo);

    SoaLogoAsset getLogoAsset(String logoHash);

    List<CollectorOptionDto> getAuthorizedCollectors();
}
