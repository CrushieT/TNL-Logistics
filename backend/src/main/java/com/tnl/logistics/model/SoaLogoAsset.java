package com.tnl.logistics.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "soa_logo_asset")
public class SoaLogoAsset {

    @Id
    @Column(name = "asset_hash", length = 64, columnDefinition = "CHAR(64)", nullable = false)
    private String assetHash;

    @Column(name = "content_type", length = 100, nullable = false)
    private String contentType;

    @Lob
    @Column(name = "content", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public SoaLogoAsset() {}

    public SoaLogoAsset(String assetHash, String contentType, byte[] content) {
        this.assetHash = assetHash;
        this.contentType = contentType;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public String getAssetHash() { return assetHash; }
    public void setAssetHash(String assetHash) { this.assetHash = assetHash; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public byte[] getContent() { return content; }
    public void setContent(byte[] content) { this.content = content; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
