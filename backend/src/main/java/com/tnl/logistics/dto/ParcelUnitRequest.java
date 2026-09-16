package com.tnl.logistics.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * Request payload for an individual parcel unit specification.
 */
public class ParcelUnitRequest {

    @NotNull(message = "Seq number is required")
    @Positive(message = "Sequence number must be positive")
    private Integer seq;

    @DecimalMin(value = "0.01", message = "Weight must be positive")
    @Digits(integer = 6, fraction = 2, message = "Weight must have up to 6 integer digits and 2 decimal places")
    private BigDecimal weightKg;

    @DecimalMin(value = "0.1", message = "Length must be positive")
    @Digits(integer = 6, fraction = 2, message = "Length must have up to 6 integer digits and 2 decimal places")
    private BigDecimal lengthCm;

    @DecimalMin(value = "0.1", message = "Height must be positive")
    @Digits(integer = 6, fraction = 2, message = "Height must have up to 6 integer digits and 2 decimal places")
    private BigDecimal heightCm;

    @DecimalMin(value = "0.1", message = "Width must be positive")
    @Digits(integer = 6, fraction = 2, message = "Width must have up to 6 integer digits and 2 decimal places")
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
