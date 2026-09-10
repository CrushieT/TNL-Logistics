package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.WeeklyClientCollectionItem;
import com.tnl.logistics.dto.WeeklyCollectionsResponse;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.Payment;
import com.tnl.logistics.model.Shipment;
import com.tnl.logistics.model.Soa;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.SoaRepository;
import com.tnl.logistics.repository.WeeklyCollectionRepository;
import com.tnl.logistics.service.CollectionsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of Thursday weekly collections consolidation engine.
 */
@Service
public class CollectionsServiceImpl implements CollectionsService {

    private final ClientRepository clientRepository;
    private final ShipmentRepository shipmentRepository;
    private final PaymentRepository paymentRepository;
    private final SoaRepository soaRepository;
    private final com.tnl.logistics.service.SystemSettingService systemSettingService;

    public CollectionsServiceImpl(ClientRepository clientRepository,
                                  ShipmentRepository shipmentRepository,
                                  PaymentRepository paymentRepository,
                                  SoaRepository soaRepository,
                                  com.tnl.logistics.service.SystemSettingService systemSettingService) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
        this.systemSettingService = systemSettingService;
    }

    @Override
    @Transactional(readOnly = true)
    public WeeklyCollectionsResponse getWeeklyCollections(LocalDate targetDate) {
        LocalDate targetThursday = (targetDate != null) ? targetDate : calculateActiveCycleDate(LocalDate.now());

        LocalDate cycleStartLocalDate = calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atTime(23, 59, 59, 999999999);

        List<Client> clients = clientRepository.findAll();
        List<Shipment> rawShipments = shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(cycleStart, cycleEnd);

        // Exclude shipments already billed to an SOA from a different cycle
        Set<String> cycleSoaNos = soaRepository.findByStatementDate(targetThursday).stream()
                .map(Soa::getSoaNo)
                .collect(Collectors.toSet());

        List<Shipment> cycleShipments = rawShipments.stream()
                .filter(s -> {
                    if (s.getClient() == null) {
                        return false;
                    }
                    if (s.getStatementId() != null && !s.getStatementId().trim().isEmpty()) {
                        return cycleSoaNos.contains(s.getStatementId());
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Map<String, List<Shipment>> shipmentsByClient = cycleShipments.stream()
                .collect(Collectors.groupingBy(s -> s.getClient().getClientId()));

        List<WeeklyClientCollectionItem> items = new ArrayList<>();
        BigDecimal totalDue = BigDecimal.ZERO;
        BigDecimal totalCollected = BigDecimal.ZERO;
        BigDecimal outstandingBalance = BigDecimal.ZERO;

        for (Client client : clients) {
            String clientId = client.getClientId();
            List<Shipment> clientShipments = shipmentsByClient.getOrDefault(clientId, Collections.emptyList());

            int shipmentsCount = clientShipments.size();
            int unbilledCount = (int) clientShipments.stream()
                    .filter(s -> s.getStatementId() == null || s.getStatementId().trim().isEmpty())
                    .count();

            BigDecimal currentCharges = clientShipments.stream()
                    .map(Shipment::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal paid = BigDecimal.ZERO;
            for (Shipment s : clientShipments) {
                List<Payment> payments = paymentRepository.findByShipment_ShipmentId(s.getShipmentId());
                for (Payment p : payments) {
                    if (p.getAmountPaid() != null) {
                        paid = paid.add(p.getAmountPaid());
                    }
                }
            }

            Optional<Soa> soaOpt = soaRepository.findByClient_ClientIdAndStatementDate(clientId, targetThursday);
            String statementId = soaOpt.map(Soa::getSoaNo).orElse(null);
            BigDecimal previousBalance = BigDecimal.ZERO;
            BigDecimal deductions = soaOpt.map(Soa::getDeductions).filter(Objects::nonNull).orElse(BigDecimal.ZERO);
            BigDecimal netAmountDue = currentCharges.add(previousBalance).subtract(paid).subtract(deductions);
            if (netAmountDue.compareTo(BigDecimal.ZERO) < 0) {
                netAmountDue = BigDecimal.ZERO;
            }

            String status;
            if (soaOpt.isPresent()) {
                status = (netAmountDue.compareTo(BigDecimal.ZERO) == 0 && shipmentsCount > 0) ? "SETTLED" : "SOA_GENERATED";
            } else {
                status = (shipmentsCount > 0) ? "READY_FOR_SOA" : "NO_SHIPMENTS";
            }

            // Only include clients with shipments or outstanding balances in this cycle
            if (shipmentsCount > 0 || netAmountDue.compareTo(BigDecimal.ZERO) > 0 || soaOpt.isPresent()) {
                totalDue = totalDue.add(currentCharges).add(previousBalance);
                totalCollected = totalCollected.add(paid);
                outstandingBalance = outstandingBalance.add(netAmountDue);

                items.add(new WeeklyClientCollectionItem(
                        clientId,
                        client.getName(),
                        clientId,
                        client.getContactNumber(),
                        shipmentsCount,
                        unbilledCount,
                        currentCharges,
                        previousBalance,
                        paid,
                        deductions,
                        netAmountDue,
                        netAmountDue,
                        status,
                        statementId
                ));
            }
        }

        int activeClientsCount = (int) items.stream()
                .filter(i -> i.getUnbilledShipmentsCount() > 0 || i.getNetAmountDue().compareTo(BigDecimal.ZERO) > 0)
                .count();

        return new WeeklyCollectionsResponse(
                targetThursday,
                totalDue,
                totalCollected,
                outstandingBalance,
                activeClientsCount,
                items
        );
    }

    private LocalDate resolveCycleStartDate(LocalDate cycleEndDate, Collection<LocalDate> knownCycles) {
        if (cycleEndDate == null) {
            return null;
        }
        LocalDate defaultStart = cycleEndDate.minusDays(6);
        if (knownCycles != null) {
            Optional<LocalDate> prevCycleOpt = knownCycles.stream()
                    .filter(d -> d != null && d.isBefore(cycleEndDate))
                    .max(LocalDate::compareTo);
            if (prevCycleOpt.isPresent()) {
                LocalDate anchoredStart = prevCycleOpt.get().plusDays(1);
                if (anchoredStart.isAfter(defaultStart)) {
                    return anchoredStart;
                }
            }
        }
        return defaultStart;
    }

    @Override
    public LocalDate calculateCycleStartDate(LocalDate cycleEndDate) {
        if (cycleEndDate == null) {
            return null;
        }
        return resolveCycleStartDate(cycleEndDate, getActiveCycleDates());
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocalDate> getActiveCycleDates() {
        LocalDate currentCycleEnd = calculateActiveCycleDate(LocalDate.now());

        Set<LocalDate> activeCycles = new TreeSet<>(Comparator.reverseOrder());

        // 1. Always include the current ongoing cycle closing day
        activeCycles.add(currentCycleEnd);

        // 2. Add all immutable historical statement dates from generated SOAs
        List<LocalDate> soaDates = soaRepository.findDistinctStatementDates();
        activeCycles.addAll(soaDates);

        // Find the latest finalized historical cycle date if any exists
        LocalDate latestFinalizedCycleDate = null;
        for (LocalDate cycleDate : activeCycles) {
            if (!cycleDate.equals(currentCycleEnd)) {
                if (latestFinalizedCycleDate == null || cycleDate.isAfter(latestFinalizedCycleDate)) {
                    latestFinalizedCycleDate = cycleDate;
                }
            }
        }

        LocalDate currentCycleStart = resolveCycleStartDate(currentCycleEnd, activeCycles);

        // 3. Incorporate candidate historical cycles from raw shipments strictly prior to the active cycle window
        List<LocalDate> registrationDates = shipmentRepository.findDistinctRegistrationDates();
        for (LocalDate regDate : registrationDates) {
            if (regDate == null) {
                continue;
            }
            // Shipments registered after the latest finalized cycle roll into the current active cycle
            if (latestFinalizedCycleDate != null && regDate.isAfter(latestFinalizedCycleDate)) {
                continue;
            }
            // Shipments on or after current active cycle start roll into the current active cycle
            if (!regDate.isBefore(currentCycleStart)) {
                continue;
            }

            // Check if covered by any existing cycle window [winStart, cycleDate]
            boolean coveredByExistingCycle = false;
            for (LocalDate cycleDate : activeCycles) {
                LocalDate winStart = cycleDate.minusDays(6);
                if (!regDate.isBefore(winStart) && !regDate.isAfter(cycleDate)) {
                    coveredByExistingCycle = true;
                    break;
                }
            }
            if (!coveredByExistingCycle) {
                // Historical shipments prior to finalized cycles anchor to historical Thursday
                int currentDayVal = regDate.getDayOfWeek().getValue();
                int daysUntilThursday = (DayOfWeek.THURSDAY.getValue() - currentDayVal + 7) % 7;
                LocalDate candidateDate = regDate.plusDays(daysUntilThursday);

                if (!activeCycles.contains(candidateDate) && candidateDate.isBefore(currentCycleStart)) {
                    LocalDate candidateStart = candidateDate.minusDays(6);
                    LocalDateTime startDt = candidateStart.atStartOfDay();
                    LocalDateTime endDt = candidateDate.atTime(23, 59, 59, 999999999);
                    if (shipmentRepository.countUnbilledShipmentsBetween(startDt, endDt) > 0) {
                        activeCycles.add(candidateDate);
                    }
                }
            }
        }
        return new ArrayList<>(activeCycles);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocalDate> getActiveCycleThursdays() {
        return getActiveCycleDates();
    }

    @Override
    public DayOfWeek getCollectionDayOfWeek() {
        return systemSettingService != null ? systemSettingService.getCollectionDay() : DayOfWeek.THURSDAY;
    }

    @Override
    public LocalDate calculateActiveCycleDate(LocalDate baseDate) {
        DayOfWeek collectionDay = getCollectionDayOfWeek();
        int currentDayValue = baseDate.getDayOfWeek().getValue();
        int targetDayValue = collectionDay.getValue();
        int daysUntilTarget = (targetDayValue - currentDayValue + 7) % 7;
        return baseDate.plusDays(daysUntilTarget);
    }
}
