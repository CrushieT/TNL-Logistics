package com.tnl.logistics.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Consolidated reporting summary payload combining KPIs, client financials,
 * active weekly collection status, operational trends, and receivables aging.
 */
public class ReportSummaryResponse {

    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDateTime generatedAt;
    private ReportKpiResponse kpis;
    private List<ClientRevenueReportRow> clientRevenue = new ArrayList<>();
    private WeeklyCollectionsResponse collectionSummary;
    private List<PaymentMethodReportRow> paymentMethods = new ArrayList<>();
    private List<DeductionReportRow> deductions = new ArrayList<>();
    private List<DailyVolumeReportRow> dailyVolume = new ArrayList<>();
    private List<StatusDistributionReportRow> statusDistribution = new ArrayList<>();
    private List<ReceivablesAgingReportRow> receivablesAging = new ArrayList<>();

    public ReportSummaryResponse() {}

    public ReportSummaryResponse(LocalDate startDate, LocalDate endDate, LocalDateTime generatedAt,
                                 ReportKpiResponse kpis, List<ClientRevenueReportRow> clientRevenue,
                                 WeeklyCollectionsResponse collectionSummary,
                                 List<PaymentMethodReportRow> paymentMethods,
                                 List<DeductionReportRow> deductions,
                                 List<DailyVolumeReportRow> dailyVolume,
                                 List<StatusDistributionReportRow> statusDistribution,
                                 List<ReceivablesAgingReportRow> receivablesAging) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.generatedAt = generatedAt;
        this.kpis = kpis;
        this.clientRevenue = clientRevenue != null ? clientRevenue : new ArrayList<>();
        this.collectionSummary = collectionSummary;
        this.paymentMethods = paymentMethods != null ? paymentMethods : new ArrayList<>();
        this.deductions = deductions != null ? deductions : new ArrayList<>();
        this.dailyVolume = dailyVolume != null ? dailyVolume : new ArrayList<>();
        this.statusDistribution = statusDistribution != null ? statusDistribution : new ArrayList<>();
        this.receivablesAging = receivablesAging != null ? receivablesAging : new ArrayList<>();
    }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public ReportKpiResponse getKpis() { return kpis; }
    public void setKpis(ReportKpiResponse kpis) { this.kpis = kpis; }

    public List<ClientRevenueReportRow> getClientRevenue() { return clientRevenue; }
    public void setClientRevenue(List<ClientRevenueReportRow> clientRevenue) { this.clientRevenue = clientRevenue; }

    public WeeklyCollectionsResponse getCollectionSummary() { return collectionSummary; }
    public void setCollectionSummary(WeeklyCollectionsResponse collectionSummary) { this.collectionSummary = collectionSummary; }

    public List<PaymentMethodReportRow> getPaymentMethods() { return paymentMethods; }
    public void setPaymentMethods(List<PaymentMethodReportRow> paymentMethods) { this.paymentMethods = paymentMethods; }

    public List<DeductionReportRow> getDeductions() { return deductions; }
    public void setDeductions(List<DeductionReportRow> deductions) { this.deductions = deductions; }

    public List<DailyVolumeReportRow> getDailyVolume() { return dailyVolume; }
    public void setDailyVolume(List<DailyVolumeReportRow> dailyVolume) { this.dailyVolume = dailyVolume; }

    public List<StatusDistributionReportRow> getStatusDistribution() { return statusDistribution; }
    public void setStatusDistribution(List<StatusDistributionReportRow> statusDistribution) { this.statusDistribution = statusDistribution; }

    public List<ReceivablesAgingReportRow> getReceivablesAging() { return receivablesAging; }
    public void setReceivablesAging(List<ReceivablesAgingReportRow> receivablesAging) { this.receivablesAging = receivablesAging; }
}
