package com.tnl.logistics.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;

public class ClientRatePerKiloRequest {

    @DecimalMin(value = "0.01", message = "Client rate per kilo must be positive")
    @DecimalMax(value = "9999999999.99", message = "Client rate per kilo exceeds the maximum allowed value")
    @Digits(integer = 10, fraction = 2, message = "Client rate per kilo must have up to 10 integer digits and 2 decimal places")
    private BigDecimal ratePerKilo;

    public ClientRatePerKiloRequest() {}

    public BigDecimal getRatePerKilo() {
        return ratePerKilo;
    }

    public void setRatePerKilo(BigDecimal ratePerKilo) {
        this.ratePerKilo = ratePerKilo;
    }
}
