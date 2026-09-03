package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.CollectorOptionDto;
import com.tnl.logistics.dto.SaveStatementRequest;
import com.tnl.logistics.dto.StatementPreviewResponse;
import com.tnl.logistics.dto.StatementShipmentItem;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.*;
import com.tnl.logistics.service.SoaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for Statement of Account previewing, line items, and persistence.
 */
@Service
public class SoaServiceImpl implements SoaService {

    private static final DateTimeFormatter MONTH_DAY_YEAR = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final ClientRepository clientRepository;
    private final ShipmentRepository shipmentRepository;
    private final PaymentRepository paymentRepository;
    private final SoaRepository soaRepository;
    private final WeeklyCollectionRepository weeklyCollectionRepository;
    private final SoaBatchRepository soaBatchRepository;
    private final AppUserRepository appUserRepository;

    public SoaServiceImpl(ClientRepository clientRepository,
                          ShipmentRepository shipmentRepository,
                          PaymentRepository paymentRepository,
                          SoaRepository soaRepository,
                          WeeklyCollectionRepository weeklyCollectionRepository,
                          SoaBatchRepository soaBatchRepository,
                          AppUserRepository appUserRepository) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.weeklyCollectionRepository = weeklyCollectionRepository;
        this.soaBatchRepository = soaBatchRepository;
        this.appUserRepository = appUserRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public StatementPreviewResponse getStatementPreview(String clientId, LocalDate targetDate) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Client not found with id: " + clientId));

        LocalDate targetThursday = (targetDate != null) ? targetDate : calculateActiveThursday(LocalDate.now());

        // 7-day Friday-to-Thursday cycle window
        LocalDateTime cycleStart = targetThursday.minusDays(6).atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atTime(23, 59, 59, 999999999);
        LocalDate cycleFriday = targetThursday.minusDays(6);

        int weekNumber = targetThursday.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        String cycleRangeLabel = formatCycleRange(cycleFriday, targetThursday);

        List<Shipment> shipments = shipmentRepository.findByClient_ClientIdAndDateRegisteredBetween(clientId, cycleStart, cycleEnd);

        List<StatementShipmentItem> items = new ArrayList<>();
        BigDecimal totalCharges = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;

        for (Shipment s : shipments) {
            String dateStr = s.getDateRegistered() != null ? s.getDateRegistered().format(MONTH_DAY_YEAR) : "—";
            String desc = (s.getDescription() != null && !s.getDescription().trim().isEmpty())
                    ? s.getDescription()
                    : s.getRecipientName();

            BigDecimal fee = s.getShippingFee() != null ? s.getShippingFee() : BigDecimal.ZERO;
            BigDecimal other = s.getOtherCharges() != null ? s.getOtherCharges() : BigDecimal.ZERO;
            BigDecimal due = s.getTotalAmount() != null ? s.getTotalAmount() : BigDecimal.ZERO;

            List<Payment> payments = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());
            BigDecimal paid = payments.stream()
                    .map(Payment::getAmountPaid)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal bal = due.subtract(paid);
            if (bal.compareTo(BigDecimal.ZERO) < 0) {
                bal = BigDecimal.ZERO;
            }

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

        Optional<Soa> existingSoa = soaRepository.findByClient_ClientIdAndStatementDate(clientId, targetThursday);

        String soaNo;
        BigDecimal deductionAmount;
        String deductionNote;
        String collectedBy;
        boolean isSaved;

        if (existingSoa.isPresent()) {
            Soa soa = existingSoa.get();
            soaNo = soa.getSoaNo();
            deductionAmount = soa.getDeductions() != null ? soa.getDeductions() : BigDecimal.ZERO;
            deductionNote = soa.getDeductionReason();
            collectedBy = soa.getCollectedBy();
            isSaved = true;
        } else {
            soaNo = formatPreviewSoaNo(clientId, targetThursday, weekNumber);
            deductionAmount = BigDecimal.ZERO;
            deductionNote = "";
            collectedBy = "";
            isSaved = false;
        }

        BigDecimal amountDue = totalCharges.subtract(totalPaid).subtract(deductionAmount);
        if (amountDue.compareTo(BigDecimal.ZERO) < 0) {
            amountDue = BigDecimal.ZERO;
        }

        StatementPreviewResponse response = new StatementPreviewResponse();
        response.setClientId(client.getClientId());
        response.setClientName(client.getName());
        response.setClientAddress(client.getAddress());
        response.setClientContact(client.getContactNumber());
        response.setClientEmail(client.getEmail());

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

        response.setItems(items);
        return response;
    }

    @Override
    @Transactional
    public StatementPreviewResponse saveStatement(SaveStatementRequest request, String actingUsername) {
        if (request.getClientId() == null || request.getClientId().trim().isEmpty()) {
            throw new IllegalArgumentException("Client ID is required");
        }
        if (request.getTargetDate() == null) {
            throw new IllegalArgumentException("Target date is required");
        }

        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new IllegalArgumentException("Client not found: " + request.getClientId()));

        LocalDate targetThursday = calculateActiveThursday(request.getTargetDate());
        LocalDateTime cycleStart = targetThursday.minusDays(6).atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atTime(23, 59, 59, 999999999);

        // 1. Ensure WeeklyCollection record exists
        String collectionId = "COL-" + client.getClientId() + "-" + targetThursday;
        WeeklyCollection collection = weeklyCollectionRepository.findByClient_ClientIdAndCollectionDate(client.getClientId(), targetThursday)
                .orElseGet(() -> {
                    WeeklyCollection newCol = new WeeklyCollection(
                            collectionId,
                            client,
                            targetThursday.minusDays(6),
                            targetThursday,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            "FOR_COLLECTION"
                    );
                    return weeklyCollectionRepository.save(newCol);
                });

        // 2. Ensure SoaBatch record exists
        String batchId = "BATCH-" + targetThursday + "-MANUAL";
        SoaBatch batch = soaBatchRepository.findById(batchId)
                .orElseGet(() -> {
                    AppUser creator = appUserRepository.findByUsername(actingUsername)
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

        // 3. Compute charges and payments for cycle shipments
        List<Shipment> shipments = shipmentRepository.findByClient_ClientIdAndDateRegisteredBetween(client.getClientId(), cycleStart, cycleEnd);
        BigDecimal currentCharges = shipments.stream()
                .map(Shipment::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = BigDecimal.ZERO;
        for (Shipment s : shipments) {
            List<Payment> payments = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());
            for (Payment p : payments) {
                if (p.getAmountPaid() != null) {
                    totalPaid = totalPaid.add(p.getAmountPaid());
                }
            }
        }

        BigDecimal deduction = request.getDeductionAmount() != null ? request.getDeductionAmount() : BigDecimal.ZERO;
        BigDecimal previousBalance = BigDecimal.ZERO;
        BigDecimal outstandingBalance = currentCharges.add(previousBalance).subtract(totalPaid).subtract(deduction);
        if (outstandingBalance.compareTo(BigDecimal.ZERO) < 0) {
            outstandingBalance = BigDecimal.ZERO;
        }

        int weekNumber = targetThursday.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        String soaNo = formatPreviewSoaNo(client.getClientId(), targetThursday, weekNumber);

        // 4. Create or update Soa entity
        Optional<Soa> existingOpt = soaRepository.findByClient_ClientIdAndStatementDate(client.getClientId(), targetThursday);
        Soa soa;
        if (existingOpt.isPresent()) {
            soa = existingOpt.get();
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

        // 5. Link statement_id on cycle shipments
        for (Shipment s : shipments) {
            if (s.getStatementId() == null || s.getStatementId().trim().isEmpty()) {
                s.setStatementId(soa.getSoaNo());
                shipmentRepository.save(s);
            }
        }

        // 6. Update WeeklyCollection totals
        collection.setTotalDue(currentCharges);
        collection.setTotalPaid(totalPaid);
        collection.setBalance(outstandingBalance);
        collection.setStatus(outstandingBalance.compareTo(BigDecimal.ZERO) == 0 ? "PAID" : "FOR_COLLECTION");
        weeklyCollectionRepository.save(collection);

        return getStatementPreview(client.getClientId(), targetThursday);
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
        int dayOfWeek = baseDate.getDayOfWeek().getValue(); // 1 = Mon, 4 = Thu, 7 = Sun
        int daysUntilThursday = (4 - dayOfWeek + 7) % 7;
        return baseDate.plusDays(daysUntilThursday);
    }

    private String formatPreviewSoaNo(String clientId, LocalDate targetThursday, int weekNumber) {
        String clientSeq = clientId.replace("CL-", "").replace("-", "");
        return String.format("SOA-%d-%s-W%02d", targetThursday.getYear(), clientSeq, weekNumber);
    }

    private String formatCycleRange(LocalDate startFriday, LocalDate endThursday) {
        if (startFriday.getMonth() == endThursday.getMonth()) {
            return startFriday.format(DateTimeFormatter.ofPattern("MMM d")) + " – " +
                   endThursday.format(DateTimeFormatter.ofPattern("d, yyyy"));
        }
        return startFriday.format(DateTimeFormatter.ofPattern("MMM d")) + " – " +
               endThursday.format(DateTimeFormatter.ofPattern("MMM d, yyyy"));
    }
}
