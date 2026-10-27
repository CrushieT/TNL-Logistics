package com.tnl.logistics.repository;

import com.tnl.logistics.model.SoaVersion;
import com.tnl.logistics.model.SoaVersionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoaVersionRepository extends JpaRepository<SoaVersion, SoaVersionId> {

    interface CapturedRequest {
        String getSoaNo();
        int getVersionNumber();
        String getRequestFingerprint();
    }

    @org.springframework.data.jpa.repository.Query(value = "SELECT soa_no AS soaNo, version_number AS versionNumber, request_fingerprint AS requestFingerprint FROM soa_version_request WHERE request_id = :requestId", nativeQuery = true)
    Optional<CapturedRequest> findCapturedRequest(@org.springframework.data.repository.query.Param("requestId") String requestId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "INSERT INTO soa_version_request (request_id, request_fingerprint, soa_no, version_number) VALUES (:requestId, :fingerprint, :soaNo, :version) ON DUPLICATE KEY UPDATE request_id = request_id", nativeQuery = true)
    void rememberRequest(@org.springframework.data.repository.query.Param("requestId") String requestId,
                         @org.springframework.data.repository.query.Param("fingerprint") String fingerprint,
                         @org.springframework.data.repository.query.Param("soaNo") String soaNo,
                         @org.springframework.data.repository.query.Param("version") int version);

    Optional<SoaVersion> findBySoaNoAndVersionNumber(String soaNo, int versionNumber);

    List<SoaVersion> findBySoaNoOrderByVersionNumberDesc(String soaNo);

    Optional<SoaVersion> findFirstBySoaNoOrderByVersionNumberDesc(String soaNo);

    Optional<SoaVersion> findByRequestId(String requestId);

    boolean existsByCapturedBy_UserId(String userId);

    long countBySoaNo(String soaNo);
}
