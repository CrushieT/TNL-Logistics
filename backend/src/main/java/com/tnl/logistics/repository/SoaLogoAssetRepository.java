package com.tnl.logistics.repository;

import com.tnl.logistics.model.SoaLogoAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SoaLogoAssetRepository extends JpaRepository<SoaLogoAsset, String> {

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "INSERT INTO soa_logo_asset (asset_hash, content_type, content) VALUES (:hash, :type, :content) ON DUPLICATE KEY UPDATE asset_hash = asset_hash", nativeQuery = true)
    void insertIfAbsent(@org.springframework.data.repository.query.Param("hash") String hash,
                        @org.springframework.data.repository.query.Param("type") String type,
                        @org.springframework.data.repository.query.Param("content") byte[] content);

    Optional<SoaLogoAsset> findByAssetHash(String assetHash);
}
