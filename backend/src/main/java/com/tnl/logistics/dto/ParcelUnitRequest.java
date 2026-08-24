package com.tnl.logistics.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * Request payload for an individual parcel unit specification.
 */
public class ParcelUnitRequest {

    @NotNull(message = "Seq number is required")
    private Integer seq;

    @DecimalMin(value = "0.01", message = "Weight must be positive")
    private BigDecimal weightKg;

    @DecimalMin(value = "0.1", message = "Length must be positive")
    private BigDecimal lengthCm;

    @DecimalMin(value = "0.1", message = "Height must be positive")
    private BigDecimal heightCm;

    @DecimalMin(value = "0.1", message = "Width must be positive")
    private BigDecimal widthCm;

    public ParcelUnitRequest() {}

    public ParcelUnitRequest(Integer seq, BigDecimal weightKg, BigDecimal lengthCm, BigDecimal heightCm, BigDecimal widthCm) {
        this.seq = seq;
        this.weightKg = weightKg;
        this.lengthCm = lengthCm;
        this.heightCm = heightCm;
        this.widthCm = widthCm;
    }

    public Integer getSeq() { return seq; }
    public void setSeq(Integer seq) { this.seq = seq; }

    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }

    public BigDecimal getLengthCm() { return lengthCm; }
    public void setLengthCm(BigDecimal lengthCm) { this.lengthCm = lengthCm; }

    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal heightCm) { this.heightCm = heightCm; }

    public BigDecimal getWidthCm() { return widthCm; }
    public void setWidthCm(BigDecimal widthCm) { this.widthCm = widthCm; }
}
