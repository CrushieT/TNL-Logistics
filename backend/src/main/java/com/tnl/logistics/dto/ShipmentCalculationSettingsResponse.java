package com.tnl.logistics.dto;

import java.math.BigDecimal;

public class ShipmentCalculationSettingsResponse {

    private String clientId;
    private BigDecimal ratePerKilo;
    private Integer volumetricDivisor;

    public ShipmentCalculationSettingsResponse() {}

    public ShipmentCalculationSettingsResponse(String clientId, BigDecimal ratePerKilo, Integer volumetricDivisor) {
        this.clientId = clientId;
        this.ratePerKilo = ratePerKilo;
        this.volumetricDivisor = volumetricDivisor;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public BigDecimal getRatePerKilo() { return ratePerKilo; }
    public void setRatePerKilo(BigDecimal ratePerKilo) { this.ratePerKilo = ratePerKilo; }

    public Integer getVolumetricDivisor() { return volumetricDivisor; }
    public void setVolumetricDivisor(Integer volumetricDivisor) { this.volumetricDivisor = volumetricDivisor; }
}
