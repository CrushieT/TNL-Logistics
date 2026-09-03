package com.tnl.logistics.service;

import com.tnl.logistics.dto.CollectorOptionDto;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.StatementPreviewResponse;

import java.time.LocalDate;
import java.util.List;

/**
 * Service interface for Statement of Account (SOA) previewing, deductions, and persistence.
 */
public interface SoaService {

    StatementPreviewResponse getStatementPreview(String clientId, LocalDate targetDate);

    StatementPreviewResponse saveStatement(SaveStatementRequest request, String actingUsername);

    List<CollectorOptionDto> getAuthorizedCollectors();
}
