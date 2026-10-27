package com.tnl.logistics.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tnl.logistics.dto.*;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.service.SoaService;
import com.tnl.logistics.service.SseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for Statement of Account previewing, line items, versioning, and persistence.
 */
@Service
public class SoaServiceImpl implements SoaService {

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter MONTH_DAY_YEAR = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final DateTimeFormatter CAPTURE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a");

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private final ClientRepository clientRepository;
    private final ShipmentRepository shipmentRepository;
    private final PaymentRepository paymentRepository;
    private final SoaRepository soaRepository;
    private final WeeklyCollectionRepository weeklyCollectionRepository;
    private final SoaBatchRepository soaBatchRepository;
    private final AppUserRepository appUserRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final SoaVersionRepository soaVersionRepository;
    private final SoaLogoAssetRepository soaLogoAssetRepository;
    private final CollectionsService collectionsService;
    private final SseService sseService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    private jakarta.validation.Validator validator;

    public SoaServiceImpl(ClientRepository clientRepository,
                          ShipmentRepository shipmentRepository,
                          PaymentRepository paymentRepository,
                          SoaRepository soaRepository,
                          WeeklyCollectionRepository weeklyCollectionRepository,
                          SoaBatchRepository soaBatchRepository,
                          AppUserRepository appUserRepository,
                          SystemSettingRepository systemSettingRepository,
                          SoaVersionRepository soaVersionRepository,
                          SoaLogoAssetRepository soaLogoAssetRepository,
                          CollectionsService collectionsService,
                          SseService sseService,
                          ObjectMapper objectMapper,
                          @Autowired(required = false) Clock clock) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.weeklyCollectionRepository = weeklyCollectionRepository;
        this.soaBatchRepository = soaBatchRepository;
        this.appUserRepository = appUserRepository;
        this.systemSettingRepository = systemSettingRepository;
        this.soaVersionRepository = soaVersionRepository;
        this.soaLogoAssetRepository = soaLogoAssetRepository;
        this.collectionsService = collectionsService;
        this.sseService = sseService;
        this.objectMapper = objectMapper;
        this.clock = (clock != null) ? clock : Clock.system(MANILA_ZONE);
    }

    private boolean isCycleClosed(LocalDate cycleThursday) {
        if (cycleThursday == null) {
            return false;
        }
        ZonedDateTime nowManila = ZonedDateTime.now(clock.withZone(MANILA_ZONE));
        ZonedDateTime cycleCutoff = cycleThursday.atStartOfDay(MANILA_ZONE);
        return !nowManila.isBefore(cycleCutoff);
    }

    @Override
    @Transactional(readOnly = true)
    public StatementPreviewResponse getStatementPreview(String clientId, LocalDate targetDate) {
        return buildLiveStatementPreview(clientId, targetDate);
    }

    @Override
    @Transactional(readOnly = true)
    public StatementPreviewResponse getStatementVersion(String clientId, LocalDate targetDate, Integer versionNumber) {
        if (versionNumber == null) {
            return getStatementPreview(clientId, targetDate);
        }

        if (versionNumber < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid statement version");
        LocalDate targetThursday = resolveTargetCycleDate(targetDate);
        Optional<Soa> existingSoa = soaRepository.findByClient_ClientIdAndStatementDate(clientId, targetThursday);
        if (existingSoa.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Statement of Account not found for client and date");
        }

        Soa soa = existingSoa.get();
        SoaVersion version = soaVersionRepository.findBySoaNoAndVersionNumber(soa.getSoaNo(), versionNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        String.format("SOA version %d not found for %s", versionNumber, soa.getSoaNo())));

        try {
            StatementPreviewResponse response = objectMapper.readValue(version.getPrintableData(), StatementPreviewResponse.class);
            response.setActiveVersion(versionNumber);
            response.setIsLive(false);
            response.setCapturedAt(version.getCaptureTime() != null
                    ? version.getCaptureTime().atZone(MANILA_ZONE).format(CAPTURE_TIME_FORMATTER)
                    : null);
            response.setCapturedByName(version.getCapturedByName());
            response.setLiveOutstandingBalance(soa.getOutstandingBalance());
            response.setVersionsCount((int) soaVersionRepository.countBySoaNo(soa.getSoaNo()));
            response.setLatestVersionNumber(soaVersionRepository.findFirstBySoaNoOrderByVersionNumberDesc(soa.getSoaNo())
                    .map(SoaVersion::getVersionNumber).orElse(versionNumber));
            response.setIsCycleClosed(isCycleClosed(targetThursday));
            response.setHasSnapshot(true);
            return response;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to parse saved SOA printable version data", e);
        }
    }

    private StatementPreviewResponse buildLiveStatementPreview(String clientId, LocalDate targetDate) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Client not found with id: " + clientId));

        LocalDate targetThursday = resolveTargetCycleDate(targetDate);
        LocalDate cycleStartLocalDate = collectionsService.calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atStartOfDay();

        int weekNumber = targetThursday.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        String cycleRangeLabel = formatCycleRange(cycleStartLocalDate, targetThursday.minusDays(1));

        Optional<Soa> existingSoa = soaRepository.findByClient_ClientIdAndStatementDate(clientId, targetThursday);
        String existingSoaNo = existingSoa.map(Soa::getSoaNo).orElse(null);
        List<SoaVersion> versions = existingSoa.isPresent()
                ? soaVersionRepository.findBySoaNoOrderByVersionNumberDesc(existingSoaNo)
                : Collections.emptyList();

        List<Shipment> rawShipments = shipmentRepository.findCycleShipmentsForClient(
                clientId, cycleStartLocalDate, targetThursday, cycleStart, cycleEnd, existingSoaNo);

        List<Shipment> shipments = rawShipments.stream()
                .filter(s -> {
                    if (s.getStatementId() != null && !s.getStatementId().trim().isEmpty()) {
                        return existingSoa.isPresent() && s.getStatementId().equals(existingSoa.get().getSoaNo());
                    }
                    return versions.isEmpty();
                })
                .collect(Collectors.toList());

        List<StatementShipmentItem> items = new ArrayList<>();
        BigDecimal totalCharges = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        Map<String, BigDecimal> paymentsByShipment = Collections.emptyMap();
        if (!shipmentIds.isEmpty()) {
            List<Payment> cyclePayments = paymentRepository.findByShipment_ShipmentIdIn(shipmentIds);
            paymentsByShipment = cyclePayments.stream()
                    .filter(p -> p.getShipment() != null && p.getAmountPaid() != null)
                    .collect(Collectors.groupingBy(
                            p -> p.getShipment().getShipmentId(),
                            Collectors.reducing(BigDecimal.ZERO, Payment::getAmountPaid, BigDecimal::add)
                    ));
        }

        for (Shipment s : shipments) {
            String dateStr = s.getBusinessRegistrationDate() != null
                    ? s.getBusinessRegistrationDate().format(MONTH_DAY_YEAR)
                    : (s.getDateRegistered() != null ? s.getDateRegistered().format(MONTH_DAY_YEAR) : "—");
            String desc = (s.getDescription() != null && !s.getDescription().trim().isEmpty())
                    ? s.getDescription()
                    : s.getRecipientName();

            BigDecimal fee = s.getShippingFee() != null ? s.getShippingFee() : BigDecimal.ZERO;
            BigDecimal other = s.getOtherCharges() != null ? s.getOtherCharges() : BigDecimal.ZERO;
            BigDecimal due = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;

            BigDecimal paid = paymentsByShipment.getOrDefault(s.getShipmentId(), BigDecimal.ZERO);
            BigDecimal bal = due.subtract(paid).max(BigDecimal.ZERO);

            totalCharges = totalCharges.add(due);
            totalPaid = totalPaid.add(paid);

            items.add(new StatementShipmentItem(
                    dateStr,
                    s.getShipmentId(),
                    desc,
                    s.getQuantity(),
                    fee,
                    other,
                    due,
                    paid,
                    bal
            ));
        }

        String soaNo;
        BigDecimal deductionAmount;
        String deductionNote;
        String collectedBy;
        boolean isSaved;
        int financialRevision = 1;
        BigDecimal outstandingBalance;

        if (existingSoa.isPresent()) {
            Soa soa = existingSoa.get();
            soaNo = soa.getSoaNo();
            deductionAmount = soa.getDeductions() != null ? soa.getDeductions() : BigDecimal.ZERO;
            deductionNote = soa.getDeductionReason();
            collectedBy = soa.getCollectedBy();
            isSaved = true;
            financialRevision = soa.getFinancialRevision();
            outstandingBalance = soa.getOutstandingBalance();
        } else {
            soaNo = formatPreviewSoaNo(clientId, targetThursday, weekNumber);
            deductionAmount = BigDecimal.ZERO;
            deductionNote = "";
            collectedBy = "";
            isSaved = false;
            outstandingBalance = totalCharges.subtract(totalPaid).max(BigDecimal.ZERO);
        }

        BigDecimal amountDue = totalCharges.subtract(totalPaid).subtract(deductionAmount).max(BigDecimal.ZERO);
        boolean cycleClosed = isCycleClosed(targetThursday);

        boolean hasSnapshot = !versions.isEmpty();
        Integer latestVersionNumber = versions.isEmpty() ? null : versions.get(0).getVersionNumber();

        StatementPreviewResponse response = new StatementPreviewResponse();
        response.setClientId(client.getClientId());
        response.setClientName(client.getName());
        response.setClientAddress(client.getAddress());
        response.setClientContact(client.getContactNumber());
        response.setClientEmail(client.getEmail());

        SystemSetting settings = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID)
                .orElseGet(SystemSetting::new);
        response.setCompanyName(settings.getCompanyName());
        response.setCompanyAddress(settings.getCompanyAddress());
        response.setCompanyContact(settings.getCompanyContact());
        response.setBillingEmail(settings.getBillingEmail());
        response.setSoaBankName(settings.getSoaBankName());
        response.setSoaAccountName(settings.getSoaAccountName());
        response.setSoaAccountNumber(settings.getSoaAccountNumber());

        response.setCycleThursday(targetThursday);
        response.setCycleRangeLabel(cycleRangeLabel);
        response.setWeekNumber(weekNumber);
        response.setShipmentsCount(shipments.size());

        response.setSoaNo(soaNo);
        response.setStatementDate(targetThursday);
        response.setCollectionDate(targetThursday);

        response.setDeductionAmount(deductionAmount);
        response.setDeductionNote(deductionNote);
        response.setCollectedBy(collectedBy);
        response.setIsSaved(isSaved);

        response.setTotalCharges(totalCharges);
        response.setTotalPaid(totalPaid);
        response.setAmountDue(amountDue);
        response.setStatus(existingSoa.isPresent() && amountDue.compareTo(BigDecimal.ZERO) == 0
                ? "SETTLED"
                : "FOR_COLLECTION");

        response.setFinancialRevision(financialRevision);
        response.setIsCycleClosed(cycleClosed);
        response.setHasSnapshot(hasSnapshot);
        response.setLatestVersionNumber(latestVersionNumber);
        response.setVersionsCount(versions.size());
        response.setActiveVersion(null);
        response.setIsLive(true);
        response.setLogoHash(getTrustedLogoHash());
        response.setLiveOutstandingBalance(outstandingBalance);

        response.setItems(items);
        return response;
    }

    @Override
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public StatementPreviewResponse generateStatement(SaveStatementRequest request, String actingUserId) {
        validateRequest(request);
        return internalPersistStatement(request, actingUserId, "GENERATE", null);
    }

    @Override
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public StatementPreviewResponse saveStatement(SaveStatementRequest request, String actingUserId) {
        validateRequest(request);
        return internalPersistStatement(request, actingUserId, "SAVE", requestFingerprint("SAVE", request, actingUserId, null));
    }

    @Override
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public StatementPreviewResponse saveStatementVersion(SaveStatementVersionRequest request, String actingUserId) {
        validateRequest(request);
        LocalDate targetThursday = resolveTargetCycleDate(request.getTargetDate());
        if (!isCycleClosed(targetThursday)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CANNOT_VERSION_OPEN_CYCLE");
        }
        SaveStatementRequest saveRequest = new SaveStatementRequest(request.getClientId(), targetThursday,
                request.getDeductionAmount(), request.getDeductionNote(), request.getCollectedBy());
        saveRequest.setRequestId(request.getRequestId());
        String fingerprint = requestFingerprint("VERSION", saveRequest, actingUserId, request.getExpectedFinancialRevision());
        StatementPreviewResponse replay = replayRequest(saveRequest, fingerprint);
        if (replay != null) return replay;
        return internalPersistStatementVersion(saveRequest, actingUserId, request.getExpectedFinancialRevision(), fingerprint);
    }

    @Override
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public StatementPreviewResponse ensureV1Snapshot(EnsureV1Request request, String actingUserId) {
        validateRequest(request);
        SaveStatementRequest saveRequest = new SaveStatementRequest(request.getClientId(), request.getTargetDate(),
                null, null, null);
        saveRequest.setRequestId(request.getRequestId());
        String fingerprint = requestFingerprint("ENSURE", saveRequest, actingUserId, null);
        return internalPersistStatement(saveRequest, actingUserId, "ENSURE", fingerprint);
    }

    private void validateRequest(Object request) {
        if (request == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is required");
        var violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, violations.iterator().next().getMessage());
        }
    }

    private String requestFingerprint(String operation, SaveStatementRequest request, String actor, Integer expectedRevision) {
        try {
            return "req-v1:" + computeSha256(objectMapper.writeValueAsString(Arrays.asList(operation, actor,
                    request.getClientId(), resolveTargetCycleDate(request.getTargetDate()).toString(),
                    request.getDeductionAmount() == null ? "0" : request.getDeductionAmount().stripTrailingZeros().toPlainString(),
                    Objects.toString(request.getDeductionNote(), ""), Objects.toString(request.getCollectedBy(), ""), expectedRevision)));
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot fingerprint statement request", exception);
        }
    }

    private StatementPreviewResponse replayRequest(SaveStatementRequest request, String fingerprint) {
        if (request.getRequestId() == null || request.getRequestId().isBlank()) return null;
        String requestId = request.getRequestId().trim();
        Optional<SoaVersionRepository.CapturedRequest> captured = soaVersionRepository.findCapturedRequest(requestId);
        String soaNo;
        int versionNumber;
        String storedFingerprint;
        if (captured.isPresent()) {
            soaNo = captured.get().getSoaNo();
            versionNumber = captured.get().getVersionNumber();
            storedFingerprint = captured.get().getRequestFingerprint();
        } else {
            Optional<SoaVersion> existing = soaVersionRepository.findByRequestId(requestId);
            if (existing.isEmpty()) return null;
            soaNo = existing.get().getSoaNo();
            versionNumber = existing.get().getVersionNumber();
            storedFingerprint = existing.get().getRequestFingerprint();
        }
        String statementId = soaRepository.findByClient_ClientIdAndStatementDate(request.getClientId(),
                resolveTargetCycleDate(request.getTargetDate())).map(Soa::getSoaNo).orElse(null);
        if (!Objects.equals(soaNo, statementId) || !Objects.equals(storedFingerprint, fingerprint)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_CONFLICT: Request ID belongs to a different or unverifiable request");
        }
        return getStatementVersion(request.getClientId(), request.getTargetDate(), versionNumber);
    }

    private StatementPreviewResponse rememberExistingVersion(SaveStatementRequest request, String fingerprint, Soa soa, int versionNumber) {
        soaVersionRepository.rememberRequest(request.getRequestId().trim(), fingerprint, soa.getSoaNo(), versionNumber);
        return replayRequest(request, fingerprint);
    }

    private StatementPreviewResponse internalPersistStatement(SaveStatementRequest request, String actingUserId, String operation, String fingerprint) {
        if (request.getClientId() == null || request.getClientId().trim().isEmpty()) {
            throw new IllegalArgumentException("Client ID is required");
        }
        if (request.getTargetDate() == null) {
            throw new IllegalArgumentException("Target date is required");
        }

        StatementPreviewResponse replay = replayRequest(request, fingerprint);
        if (replay != null) return replay;
        boolean captureSnapshot = !operation.equals("GENERATE") && isCycleClosed(resolveTargetCycleDate(request.getTargetDate()));

        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found: " + request.getClientId()));

        LocalDate targetThursday = resolveTargetCycleDate(request.getTargetDate());
        LocalDate cycleStartLocalDate = collectionsService.calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atStartOfDay();

        Optional<Soa> initialSoa = soaRepository.findByClient_ClientIdAndStatementDate(client.getClientId(), targetThursday);
        String initialSoaNo = initialSoa.map(Soa::getSoaNo).orElseGet(() ->
                formatPreviewSoaNo(client.getClientId(), targetThursday, targetThursday.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)));

        // Strict lock order: Shipment -> SOA -> Collection -> Payment
        List<Shipment> rawShipments = shipmentRepository.findByClientAndCycleForUpdate(
                client.getClientId(), cycleStartLocalDate, targetThursday, cycleStart, cycleEnd, initialSoaNo);
        rawShipments.forEach(s -> entityManager.refresh(s, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));

        // Serialize first creation even when the cycle contains no shipments to lock.
        if (initialSoa.isEmpty()) entityManager.refresh(client, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        Optional<Soa> existingOpt = soaRepository.findByClientAndStatementDateForUpdate(client.getClientId(), targetThursday);
        existingOpt.ifPresent(s -> entityManager.refresh(s, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));
        replay = replayRequest(request, fingerprint);
        if (replay != null) return replay;
        if (existingOpt.isPresent()) {
            Soa current = existingOpt.get();
            if (operation.equals("GENERATE")) return getStatementPreview(client.getClientId(), targetThursday);
            Optional<SoaVersion> latest = soaVersionRepository.findFirstBySoaNoOrderByVersionNumberDesc(current.getSoaNo());
            if (latest.isPresent()) {
                if (operation.equals("ENSURE")) return rememberExistingVersion(request, fingerprint, current, latest.get().getVersionNumber());
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SOA_ALREADY_FINALIZED: Use Save New Version");
            }
            if (operation.equals("ENSURE")) {
                request.setDeductionAmount(current.getDeductions());
                request.setDeductionNote(current.getDeductionReason());
                request.setCollectedBy(current.getCollectedBy());
            }
        }

        String collectionId = "COL-" + client.getClientId() + "-" + targetThursday;
        WeeklyCollection collection = weeklyCollectionRepository.findByClientAndCollectionDateForUpdate(client.getClientId(), targetThursday)
                .map(existingCollection -> {
                    entityManager.refresh(existingCollection, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
                    return existingCollection;
                })
                .orElseGet(() -> {
                    WeeklyCollection newCol = new WeeklyCollection(
                            collectionId,
                            client,
                            cycleStartLocalDate,
                            targetThursday,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            "FOR_COLLECTION"
                    );
                    return weeklyCollectionRepository.save(newCol);
                });

        String rawBatchId = "BATCH-" + targetThursday + "-" + client.getClientId();
        final String batchId = rawBatchId.length() > 30 ? rawBatchId.substring(0, 30) : rawBatchId;
        SoaBatch batch = soaBatchRepository.findById(batchId)
                .orElseGet(() -> {
                    AppUser creator = appUserRepository.findById(actingUserId)
                            .or(() -> appUserRepository.findByUsername(actingUserId))
                            .orElseGet(() -> appUserRepository.findAll().stream().findFirst().orElse(null));

                    SoaBatch newBatch = new SoaBatch(
                            batchId,
                            collection,
                            "SELECTED",
                            1,
                            creator
                    );
                    return soaBatchRepository.save(newBatch);
                });

        List<Shipment> shipments = rawShipments.stream()
                .filter(s -> {
                    if (s.getStatementId() != null && !s.getStatementId().trim().isEmpty()) {
                        return existingOpt.isPresent() && s.getStatementId().equals(existingOpt.get().getSoaNo());
                    }
                    return true;
                })
                .collect(Collectors.toList());

        BigDecimal currentCharges = shipments.stream()
                .map(Shipment::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        BigDecimal totalPaid = BigDecimal.ZERO;
        List<Payment> scopedPayments = shipmentIds.isEmpty() ? List.of() : paymentRepository.findByShipmentIdsForUpdate(shipmentIds);
        scopedPayments.forEach(p -> entityManager.refresh(p, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));
        for (Payment p : scopedPayments) {
            if (p.getAmountPaid() != null) {
                totalPaid = totalPaid.add(p.getAmountPaid());
            }
        }

        BigDecimal deduction = request.getDeductionAmount() != null ? request.getDeductionAmount() : BigDecimal.ZERO;
        BigDecimal previousBalance = BigDecimal.ZERO;
        BigDecimal remainingBeforeDeduction = currentCharges.add(previousBalance).subtract(totalPaid).max(BigDecimal.ZERO);

        if (deduction.compareTo(remainingBeforeDeduction) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Deduction amount (₱%s) cannot exceed remaining statement balance (₱%s)",
                    deduction.toPlainString(),
                    remainingBeforeDeduction.toPlainString()
            ));
        }
        BigDecimal outstandingBalance = remainingBeforeDeduction.subtract(deduction).max(BigDecimal.ZERO);

        int weekNumber = targetThursday.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        String soaNo = formatPreviewSoaNo(client.getClientId(), targetThursday, weekNumber);

        Soa soa;
        if (existingOpt.isPresent()) {
            soa = existingOpt.get();
            if (hasFinancialChange(soa, currentCharges, totalPaid, deduction, outstandingBalance)) {
                soa.setFinancialRevision(soa.getFinancialRevision() + 1);
            }
            soa.setCurrentCharges(currentCharges);
            soa.setDeductions(deduction);
            soa.setDeductionReason(request.getDeductionNote());
            soa.setCollectedBy(request.getCollectedBy());
            soa.setTotalPaid(totalPaid);
            soa.setOutstandingBalance(outstandingBalance);
            soaRepository.save(soa);
        } else {
            soa = new Soa(
                    soaNo,
                    batch,
                    collection,
                    client,
                    previousBalance,
                    currentCharges,
                    deduction,
                    request.getDeductionNote(),
                    totalPaid,
                    outstandingBalance,
                    request.getCollectedBy(),
                    targetThursday,
                    null
            );
            soaRepository.save(soa);
        }

        for (Shipment s : shipments) {
            if (s.getStatementId() == null || s.getStatementId().trim().isEmpty()) {
                s.setStatementId(soa.getSoaNo());
                shipmentRepository.save(s);
            }
        }
        for (Payment p : scopedPayments) {
            if (p.getStatementId() == null || p.getStatementId().trim().isEmpty()) {
                p.setStatementId(soa.getSoaNo());
                paymentRepository.save(p);
            }
        }

        collection.setTotalDue(currentCharges);
        collection.setTotalPaid(totalPaid);
        collection.setBalance(outstandingBalance);
        collection.setStatus(outstandingBalance.compareTo(BigDecimal.ZERO) == 0 ? "PAID" : "FOR_COLLECTION");
        weeklyCollectionRepository.save(collection);

        if (captureSnapshot) {
            ensureSnapshotStored(soa, 1, actingUserId, request.getRequestId(), fingerprint);
        }

        sseService.broadcastSoaUpdated(soa.getSoaNo(), client.getClientId(), shipmentIds);

        return captureSnapshot
                ? getStatementVersion(client.getClientId(), targetThursday, 1)
                : getStatementPreview(client.getClientId(), targetThursday);
    }

    private StatementPreviewResponse internalPersistStatementVersion(SaveStatementRequest request, String actingUserId, Integer expectedFinancialRevision, String fingerprint) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found: " + request.getClientId()));

        LocalDate targetThursday = resolveTargetCycleDate(request.getTargetDate());
        LocalDate cycleStartLocalDate = collectionsService.calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atStartOfDay();

        Optional<Soa> initialSoa = soaRepository.findByClient_ClientIdAndStatementDate(client.getClientId(), targetThursday);
        if (initialSoa.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Statement of Account not found to version.");
        }
        String initialSoaNo = initialSoa.get().getSoaNo();

        // Lock order: Shipment -> SOA -> Collection -> Payment
        List<Shipment> rawShipments = shipmentRepository.findByClientAndCycleForUpdate(
                client.getClientId(), cycleStartLocalDate, targetThursday, cycleStart, cycleEnd, initialSoaNo);
        rawShipments.forEach(s -> entityManager.refresh(s, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));

        Soa soa = soaRepository.findByClientAndStatementDateForUpdate(client.getClientId(), targetThursday)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Statement not found for update"));
        entityManager.refresh(soa, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        StatementPreviewResponse replay = replayRequest(request, fingerprint);
        if (replay != null) return replay;


        if (expectedFinancialRevision != null && !expectedFinancialRevision.equals(soa.getFinancialRevision())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "STALE_FINANCIAL_REVISION: The statement balance has changed. Please refresh and review before saving a new version.");
        }

        WeeklyCollection collection = weeklyCollectionRepository.findByClientAndCollectionDateForUpdate(client.getClientId(), targetThursday)
                .orElse(null);
        if (collection != null) {
            entityManager.refresh(collection, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        }

        List<Shipment> shipments = rawShipments.stream()
                .filter(s -> s.getStatementId() != null && s.getStatementId().equals(soa.getSoaNo()))
                .collect(Collectors.toList());

        BigDecimal currentCharges = shipments.stream()
                .map(Shipment::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        BigDecimal totalPaid = BigDecimal.ZERO;
        List<Payment> scopedPayments = shipmentIds.isEmpty() ? List.of() : paymentRepository.findByShipmentIdsForUpdate(shipmentIds);
        scopedPayments.forEach(p -> entityManager.refresh(p, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));
        for (Payment p : scopedPayments) {
            if (p.getAmountPaid() != null) {
                totalPaid = totalPaid.add(p.getAmountPaid());
            }
        }

        BigDecimal deduction = request.getDeductionAmount() != null ? request.getDeductionAmount() : BigDecimal.ZERO;
        BigDecimal previousBalance = BigDecimal.ZERO;
        BigDecimal remainingBeforeDeduction = currentCharges.add(previousBalance).subtract(totalPaid).max(BigDecimal.ZERO);

        if (deduction.compareTo(remainingBeforeDeduction) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Deduction amount (₱%s) cannot exceed remaining statement balance (₱%s)",
                    deduction.toPlainString(),
                    remainingBeforeDeduction.toPlainString()
            ));
        }
        BigDecimal outstandingBalance = remainingBeforeDeduction.subtract(deduction).max(BigDecimal.ZERO);

        int nextVersionNumber = soaVersionRepository.findFirstBySoaNoOrderByVersionNumberDesc(soa.getSoaNo())
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);

        if (hasFinancialChange(soa, currentCharges, totalPaid, deduction, outstandingBalance)) {
            soa.setFinancialRevision(soa.getFinancialRevision() + 1);
        }
        soa.setCurrentCharges(currentCharges);
        soa.setDeductions(deduction);
        soa.setDeductionReason(request.getDeductionNote());
        soa.setCollectedBy(request.getCollectedBy());
        soa.setTotalPaid(totalPaid);
        soa.setOutstandingBalance(outstandingBalance);
        soaRepository.save(soa);

        if (collection != null) {
            collection.setTotalDue(currentCharges);
            collection.setTotalPaid(totalPaid);
            collection.setBalance(outstandingBalance);
            collection.setStatus(outstandingBalance.compareTo(BigDecimal.ZERO) == 0 ? "PAID" : "FOR_COLLECTION");
            weeklyCollectionRepository.save(collection);
        }

        ensureSnapshotStored(soa, nextVersionNumber, actingUserId, request.getRequestId(), fingerprint);

        sseService.broadcastSoaUpdated(soa.getSoaNo(), client.getClientId(), shipmentIds);

        return getStatementVersion(client.getClientId(), targetThursday, nextVersionNumber);
    }

    private void ensureSnapshotStored(Soa soa, int versionNumber, String actingUserId, String explicitRequestId, String fingerprint) {
        Optional<SoaVersion> existingVersion = soaVersionRepository.findBySoaNoAndVersionNumber(soa.getSoaNo(), versionNumber);
        if (existingVersion.isPresent()) {
            return;
        }

        AppUser actor = appUserRepository.findById(actingUserId)
                .or(() -> appUserRepository.findByUsername(actingUserId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Capture actor was not found"));

        String requestId = (explicitRequestId != null && !explicitRequestId.isBlank())
                ? explicitRequestId.trim()
                : UUID.randomUUID().toString();

        byte[] logoBytes = readTrustedLogo();
        String logoHash = computeSha256(logoBytes);
        soaLogoAssetRepository.insertIfAbsent(logoHash, "image/png", logoBytes);

        StatementPreviewResponse frozenSnapshot = buildLiveStatementPreview(soa.getClient().getClientId(), soa.getStatementDate());
        frozenSnapshot.setActiveVersion(versionNumber);
        frozenSnapshot.setIsLive(false);
        frozenSnapshot.setCapturedAt(Instant.now(clock).atZone(MANILA_ZONE).format(CAPTURE_TIME_FORMATTER));
        frozenSnapshot.setCapturedByName(actor.getFullName());
        frozenSnapshot.setLogoHash(logoHash);
        frozenSnapshot.setFinancialRevision(soa.getFinancialRevision());
        frozenSnapshot.setLiveOutstandingBalance(soa.getOutstandingBalance());
        frozenSnapshot.setHasSnapshot(true);
        frozenSnapshot.setIsSaved(true);

        String printableJson;
        try {
            printableJson = objectMapper.writeValueAsString(frozenSnapshot);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize SOA version printable document", e);
        }


        SoaVersion version = new SoaVersion(
                soa.getSoaNo(),
                versionNumber,
                requestId,
                fingerprint,
                Instant.now(clock),
                actor,
                actor.getFullName(),
                soa.getFinancialRevision(),
                logoHash,
                printableJson
        );

        try {
            entityManager.persist(version);
            entityManager.flush();
        } catch (org.hibernate.exception.ConstraintViolationException | jakarta.persistence.EntityExistsException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SNAPSHOT_REQUEST_CONFLICT: Request ID or version was already captured", exception);
        }
        soaVersionRepository.rememberRequest(requestId, fingerprint, soa.getSoaNo(), versionNumber);
        SaveStatementRequest capturedRequest = new SaveStatementRequest(soa.getClient().getClientId(), soa.getStatementDate(), null, null, null);
        capturedRequest.setRequestId(requestId);
        replayRequest(capturedRequest, fingerprint);
    }

    private boolean hasFinancialChange(Soa soa, BigDecimal charges, BigDecimal paid, BigDecimal deduction, BigDecimal balance) {
        return soa.getCurrentCharges().compareTo(charges) != 0 || soa.getTotalPaid().compareTo(paid) != 0
                || soa.getDeductions().compareTo(deduction) != 0 || soa.getOutstandingBalance().compareTo(balance) != 0;
    }

    private String getTrustedLogoHash() {
        return computeSha256(readTrustedLogo());
    }

    private byte[] readTrustedLogo() {
        try (InputStream input = new ClassPathResource("assets/tracking-logo.png").getInputStream()) {
            byte[] bytes = input.readAllBytes();
            if (javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes)) == null) {
                throw new IllegalStateException("Trusted SOA logo is not a readable image");
            }
            return bytes;
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot read trusted SOA logo", exception);
        }
    }

    private String computeSha256(String text) {
        return computeSha256(text.getBytes(StandardCharsets.UTF_8));
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(data);
            StringBuilder hexString = new StringBuilder(2 * encodedhash.length);
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SoaVersionSummaryDto> listVersions(String clientId, LocalDate targetDate) {
        LocalDate targetThursday = resolveTargetCycleDate(targetDate);
        Optional<Soa> existing = soaRepository.findByClient_ClientIdAndStatementDate(clientId, targetThursday);
        if (existing.isEmpty()) {
            return Collections.emptyList();
        }

        List<SoaVersion> versions = soaVersionRepository.findBySoaNoOrderByVersionNumberDesc(existing.get().getSoaNo());
        List<SoaVersionSummaryDto> dtos = new ArrayList<>();

        for (SoaVersion v : versions) {
            BigDecimal due = BigDecimal.ZERO;
            BigDecimal paid = BigDecimal.ZERO;
            BigDecimal deduction = BigDecimal.ZERO;
            String status = "FOR_COLLECTION";

            try {
                StatementPreviewResponse parsed = objectMapper.readValue(v.getPrintableData(), StatementPreviewResponse.class);
                due = parsed.getAmountDue() != null ? parsed.getAmountDue() : BigDecimal.ZERO;
                paid = parsed.getTotalPaid() != null ? parsed.getTotalPaid() : BigDecimal.ZERO;
                deduction = parsed.getDeductionAmount() != null ? parsed.getDeductionAmount() : BigDecimal.ZERO;
                status = parsed.getStatus() != null ? parsed.getStatus() : "FOR_COLLECTION";
            } catch (Exception ignored) {}

            String formattedTime = v.getCaptureTime() != null
                    ? v.getCaptureTime().atZone(MANILA_ZONE).format(CAPTURE_TIME_FORMATTER)
                    : "—";

            dtos.add(new SoaVersionSummaryDto(
                    v.getSoaNo(),
                    v.getVersionNumber(),
                    v.getCaptureTime(),
                    formattedTime,
                    v.getCapturedByName(),
                    due,
                    paid,
                    deduction,
                    status,
                    v.getFinancialRevision()
            ));
        }

        return dtos;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SoaVersionSummaryDto> listVersionsBySoaNo(String soaNo) {
        if (soaNo == null || soaNo.isBlank()) {
            return Collections.emptyList();
        }
        List<SoaVersion> versions = soaVersionRepository.findBySoaNoOrderByVersionNumberDesc(soaNo);
        List<SoaVersionSummaryDto> dtos = new ArrayList<>();
        for (SoaVersion v : versions) {
            BigDecimal due = BigDecimal.ZERO;
            BigDecimal paid = BigDecimal.ZERO;
            BigDecimal deduction = BigDecimal.ZERO;
            String status = "FOR_COLLECTION";
            try {
                StatementPreviewResponse parsed = objectMapper.readValue(v.getPrintableData(), StatementPreviewResponse.class);
                due = parsed.getAmountDue() != null ? parsed.getAmountDue() : BigDecimal.ZERO;
                paid = parsed.getTotalPaid() != null ? parsed.getTotalPaid() : BigDecimal.ZERO;
                deduction = parsed.getDeductionAmount() != null ? parsed.getDeductionAmount() : BigDecimal.ZERO;
                status = parsed.getStatus() != null ? parsed.getStatus() : "FOR_COLLECTION";
            } catch (Exception ignored) {}

            String formattedTime = v.getCaptureTime() != null
                    ? v.getCaptureTime().atZone(MANILA_ZONE).format(CAPTURE_TIME_FORMATTER)
                    : "—";

            dtos.add(new SoaVersionSummaryDto(
                    v.getSoaNo(),
                    v.getVersionNumber(),
                    v.getCaptureTime(),
                    formattedTime,
                    v.getCapturedByName(),
                    due,
                    paid,
                    deduction,
                    status,
                    v.getFinancialRevision()
            ));
        }
        return dtos;
    }

    @Override
    @Transactional(readOnly = true)
    public SoaLogoAsset getLogoAsset(String logoHash) {
        return soaLogoAssetRepository.findByAssetHash(logoHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Logo asset not found with hash: " + logoHash));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CollectorOptionDto> getAuthorizedCollectors() {
        return appUserRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .map(u -> new CollectorOptionDto(
                        u.getUserId(),
                        u.getFullName(),
                        u.getUsername(),
                        u.getRole() != null ? u.getRole().name() : "STAFF"
                ))
                .sorted(Comparator.comparing(CollectorOptionDto::getFullName))
                .collect(Collectors.toList());
    }

    private LocalDate calculateActiveThursday(LocalDate baseDate) {
        if (baseDate == null) {
            baseDate = LocalDate.now(clock.withZone(MANILA_ZONE));
        }
        if (collectionsService != null) {
            return collectionsService.calculateActiveCycleDate(baseDate);
        }
        int dayOfWeek = baseDate.getDayOfWeek().getValue();
        int daysUntilThursday = (4 - dayOfWeek + 7) % 7;
        if (daysUntilThursday == 0) {
            daysUntilThursday = 7;
        }
        return baseDate.plusDays(daysUntilThursday);
    }

    private LocalDate resolveTargetCycleDate(LocalDate targetDate) {
        if (targetDate == null) {
            return calculateActiveThursday(LocalDate.now(clock.withZone(MANILA_ZONE)));
        }
        LocalDate currentActiveCycle = calculateActiveThursday(LocalDate.now(clock.withZone(MANILA_ZONE)));
        if (targetDate.equals(currentActiveCycle)) {
            return targetDate;
        }
        if (collectionsService != null && collectionsService.getActiveCycleDates().contains(targetDate)) {
            return targetDate;
        }
        if (collectionsService != null && targetDate.getDayOfWeek() == collectionsService.getCollectionDayOfWeek()) {
            return targetDate;
        }
        return calculateActiveThursday(targetDate);
    }

    private String formatPreviewSoaNo(String clientId, LocalDate targetThursday, int weekNumber) {
        String clientSeq = clientId.replace("CL-", "").replace("-", "");
        return String.format("SOA-%d-%s-W%02d", targetThursday.getYear(), clientSeq, weekNumber);
    }

    private String formatCycleRange(LocalDate startThursday, LocalDate endWednesday) {
        if (startThursday.getMonth() == endWednesday.getMonth()) {
            return startThursday.format(DateTimeFormatter.ofPattern("MMM d")) + " – " +
                   endWednesday.format(DateTimeFormatter.ofPattern("d, yyyy"));
        }
        return startThursday.format(DateTimeFormatter.ofPattern("MMM d")) + " – " +
               endWednesday.format(DateTimeFormatter.ofPattern("MMM d, yyyy"));
    }
}
