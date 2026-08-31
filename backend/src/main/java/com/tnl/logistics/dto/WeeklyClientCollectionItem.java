package com.tnl.logistics.dto;

import java.math.BigDecimal;

/**
 * Summary item for an individual client in the weekly collections dashboard.
 */
public class WeeklyClientCollectionItem {

    private String clientId;
    private String clientName;
    private String clientCode;
    private String contactNumber;
    private Integer shipmentsCount;
    private Integer unbilledShipmentsCount;
    private BigDecimal currentCharges;
    private BigDecimal previousBalance;
    private BigDecimal paid;
    private BigDecimal totalDeductions;
    private BigDecimal netAmountDue;
    private BigDecimal balance;
    private String status;
    private String statementId;

    public WeeklyClientCollectionItem() {}

    public WeeklyClientCollectionItem(String clientId, String clientName, String clientCode, String contactNumber,
                                      Integer shipmentsCount, Integer unbilledShipmentsCount, BigDecimal currentCharges,
                                      BigDecimal previousBalance, BigDecimal paid, BigDecimal totalDeductions,
                                      BigDecimal netAmountDue, BigDecimal balance, String status, String statementId) {
        this.clientId = clientId;
        this.clientName = clientName;
        this.clientCode = clientCode;
        this.contactNumber = contactNumber;
        this.shipmentsCount = shipmentsCount != null ? shipmentsCount : 0;
        this.unbilledShipmentsCount = unbilledShipmentsCount != null ? unbilledShipmentsCount : 0;
        this.currentCharges = currentCharges != null ? currentCharges : BigDecimal.ZERO;
        this.previousBalance = previousBalance != null ? previousBalance : BigDecimal.ZERO;
        this.paid = paid != null ? paid : BigDecimal.ZERO;
        this.totalDeductions = totalDeductions != null ? totalDeductions : BigDecimal.ZERO;
        this.netAmountDue = netAmountDue != null ? netAmountDue : BigDecimal.ZERO;
        this.balance = balance != null ? balance : BigDecimal.ZERO;
        this.status = status;
        this.statementId = statementId;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getClientCode() { return clientCode; }
    public void setClientCode(String clientCode) { this.clientCode = clientCode; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public Integer getShipmentsCount() { return shipmentsCount; }
    public void setShipmentsCount(Integer shipmentsCount) { this.shipmentsCount = shipmentsCount; }

    public Integer getUnbilledShipmentsCount() { return unbilledShipmentsCount; }
    public void setUnbilledShipmentsCount(Integer unbilledShipmentsCount) { this.unbilledShipmentsCount = unbilledShipmentsCount; }

    public BigDecimal getCurrentCharges() { return currentCharges; }
    public void setCurrentCharges(BigDecimal currentCharges) { this.currentCharges = currentCharges; }

    public BigDecimal getPreviousBalance() { return previousBalance; }
    public void setPreviousBalance(BigDecimal previousBalance) { this.previousBalance = previousBalance; }

    public BigDecimal getPaid() { return paid; }
    public void setPaid(BigDecimal paid) { this.paid = paid; }

    public BigDecimal getTotalDeductions() { return totalDeductions; }
    public void setTotalDeductions(BigDecimal totalDeductions) { this.totalDeductions = totalDeductions; }

    public BigDecimal getNetAmountDue() { return netAmountDue; }
    public void setNetAmountDue(BigDecimal netAmountDue) { this.netAmountDue = netAmountDue; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getStatementId() { return statementId; }
    public void setStatementId(String statementId) { this.statementId = statementId; }
}
