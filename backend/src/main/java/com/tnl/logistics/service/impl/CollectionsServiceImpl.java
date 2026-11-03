package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.WeeklyClientCollectionItem;
import com.tnl.logistics.dto.WeeklyCollectionsResponse;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.model.Soa;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.repository.ClientCollectionTotals;
import com.tnl.logistics.repository.SoaRepository;
import com.tnl.logistics.service.CollectionsService;
import com.tnl.logistics.dto.CollectionTotals;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of Thursday weekly collections consolidation engine.
 */
@Service
public class CollectionsServiceImpl implements CollectionsService {

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");

    private final ShipmentRepository shipmentRepository;
    private final SoaRepository soaRepository;
    private final com.tnl.logistics.service.SystemSettingService systemSettingService;
    private final Clock clock;

    public CollectionsServiceImpl(ShipmentRepository shipmentRepository,
                                  SoaRepository soaRepository,
                                  com.tnl.logistics.service.SystemSettingService systemSettingService,
                                  @Autowired(required = false) Clock clock) {
        this.shipmentRepository = shipmentRepository;
        this.soaRepository = soaRepository;
        this.systemSettingService = systemSettingService;
        this.clock = (clock != null) ? clock : Clock.system(MANILA_ZONE);
    }

    @Override
    @Transactional(readOnly = true)
    public WeeklyCollectionsResponse getWeeklyCollections(LocalDate targetDate) {
        try {
            return (WeeklyCollectionsResponse) computeWeeklyCollections(targetDate, true);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "COLLECTIONS_UNAVAILABLE: Weekly collections calculation is temporarily unavailable",
                    ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public CollectionTotals getCollectionTotals(LocalDate targetDate) {
        return getCollectionTotals(targetDate, null);
    }

    @Override
    @Transactional(readOnly = true)
    public CollectionTotals getCollectionTotals(LocalDate targetDate, LocalDate cycleStartDate) {
        try {
            return (CollectionTotals) computeWeeklyCollections(targetDate, cycleStartDate, false);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "COLLECTIONS_UNAVAILABLE: Weekly collections calculation is temporarily unavailable",
                    ex);
        }
    }

    private Object computeWeeklyCollections(LocalDate targetDate, boolean includeItems) {
        return computeWeeklyCollections(targetDate, null, includeItems);
    }

    private Object computeWeeklyCollections(LocalDate targetDate, LocalDate explicitCycleStartDate, boolean includeItems) {
        LocalDate today = LocalDate.now(clock.withZone(MANILA_ZONE));
        LocalDate targetThursday = (targetDate != null) ? targetDate : calculateActiveCycleDate(today);

        LocalDate cycleStartLocalDate = (explicitCycleStartDate != null)
                ? explicitCycleStartDate
                : calculateCycleStartDate(targetThursday);
        LocalDateTime cycleStart = cycleStartLocalDate.atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atStartOfDay();

        List<ClientCollectionTotals> clientTotals = shipmentRepository.aggregateCollectionsByClient(
                cycleStart, cycleEnd, targetThursday);
        List<Soa> cycleSoas = soaRepository.findByStatementDate(targetThursday);
        Map<String, Soa> soaByClientId = cycleSoas.stream()
                .filter(soa -> soa.getClient() != null)
                .collect(Collectors.toMap(soa -> soa.getClient().getClientId(), soa -> soa, (first, second) -> first));
        Map<String, ClientCollectionTotals> totalsByClientId = clientTotals.stream()
                .collect(Collectors.toMap(ClientCollectionTotals::getClientId, totals -> totals));
        Set<String> candidateClientIds = clientTotals.stream()
                .map(ClientCollectionTotals::getClientId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (Soa soa : cycleSoas) {
            if (soa.getClient() != null) {
                candidateClientIds.add(soa.getClient().getClientId());
            }
        }

        List<WeeklyClientCollectionItem> items = includeItems ? new ArrayList<>() : null;
        BigDecimal totalDue = BigDecimal.ZERO;
        BigDecimal totalCollected = BigDecimal.ZERO;
        BigDecimal outstandingBalance = BigDecimal.ZERO;
        int activeClientsCount = 0;

        for (String clientId : candidateClientIds) {
            ClientCollectionTotals totals = totalsByClientId.get(clientId);
            int shipmentsCount = totals != null ? totals.getShipmentsCount() : 0;
            int unbilledCount = totals != null ? totals.getUnbilledCount() : 0;
            BigDecimal currentCharges = totals != null ? totals.getCurrentCharges() : BigDecimal.ZERO;
            BigDecimal paid = totals != null ? totals.getPaid() : BigDecimal.ZERO;

            Optional<Soa> soaOpt = Optional.ofNullable(soaByClientId.get(clientId));
            BigDecimal previousBalance = BigDecimal.ZERO;
            BigDecimal deductions = soaOpt.map(Soa::getDeductions).filter(Objects::nonNull).orElse(BigDecimal.ZERO);
            BigDecimal netAmountDue = currentCharges.add(previousBalance).subtract(paid).subtract(deductions);
            if (netAmountDue.compareTo(BigDecimal.ZERO) < 0) {
                netAmountDue = BigDecimal.ZERO;
            }

            boolean isEligible = shipmentsCount > 0 || netAmountDue.compareTo(BigDecimal.ZERO) > 0 || soaOpt.isPresent();

            if (isEligible) {
                totalDue = totalDue.add(currentCharges).add(previousBalance);
                totalCollected = totalCollected.add(paid);
                outstandingBalance = outstandingBalance.add(netAmountDue);

                if (unbilledCount > 0 || netAmountDue.compareTo(BigDecimal.ZERO) > 0) {
                    activeClientsCount++;
                }

                if (includeItems) {
                    Client soaClient = soaByClientId.containsKey(clientId) ? soaByClientId.get(clientId).getClient() : null;
                    String clientName = totals != null ? totals.getClientName() : (soaClient != null ? soaClient.getName() : clientId);
                    String contactNumber = totals != null ? totals.getContactNumber() : (soaClient != null ? soaClient.getContactNumber() : "");
                    String statementId = soaOpt.map(Soa::getSoaNo).orElse(null);
                    String status;
                    if (soaOpt.isPresent()) {
                        status = (netAmountDue.compareTo(BigDecimal.ZERO) == 0 && shipmentsCount > 0) ? "SETTLED" : "SOA_GENERATED";
                    } else {
                        status = (shipmentsCount > 0) ? "READY_FOR_SOA" : "NO_SHIPMENTS";
                    }

                    items.add(new WeeklyClientCollectionItem(
                            clientId,
                            clientName,
                            clientId,
                            contactNumber,
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
        }

        if (includeItems) {
            return new WeeklyCollectionsResponse(
                    targetThursday,
                    totalDue,
                    totalCollected,
                    outstandingBalance,
                    activeClientsCount,
                    items
            );
        } else {
            return new CollectionTotals(
                    totalDue,
                    totalCollected,
                    outstandingBalance,
                    activeClientsCount
            );
        }
    }

    private LocalDate resolveCycleStartDate(LocalDate cycleEndDate, Collection<LocalDate> knownCycles) {
        if (cycleEndDate == null) {
            return null;
        }
        LocalDate defaultStart = cycleEndDate.minusDays(7);
        if (knownCycles != null) {
            Optional<LocalDate> prevCycleOpt = knownCycles.stream()
                    .filter(d -> d != null && d.isBefore(cycleEndDate))
                    .max(LocalDate::compareTo);
            if (prevCycleOpt.isPresent()) {
                LocalDate anchoredStart = prevCycleOpt.get();
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
        try {
            LocalDate today = LocalDate.now(clock.withZone(MANILA_ZONE));
            LocalDate currentCycleEnd = calculateActiveCycleDate(today);

            Set<LocalDate> activeCycles = new TreeSet<>(Comparator.reverseOrder());

            // 1. Always include the current ongoing cycle closing day
            activeCycles.add(currentCycleEnd);

            // If today is collection day, also include today's closed cycle so staff can view/settle it
            if (today.getDayOfWeek() == getCollectionDayOfWeek()) {
                activeCycles.add(today);
            }

            // 2. Add all immutable historical statement dates from generated SOAs
            List<LocalDate> soaDates = soaRepository.findDistinctStatementDates();
            if (soaDates != null) {
                for (LocalDate d : soaDates) {
                    if (d != null) {
                        activeCycles.add(d);
                    }
                }
            }

            // 3. Add distinct unbilled registration dates mapped to configured collection day
            List<LocalDate> unbilledDates = shipmentRepository.findDistinctUnbilledRegistrationDates();
            if (unbilledDates != null) {
                for (LocalDate regDate : unbilledDates) {
                    if (regDate != null) {
                        activeCycles.add(calculateActiveCycleDate(regDate));
                    }
                }
            }

            return new ArrayList<>(activeCycles);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (DataAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "CYCLES_UNAVAILABLE: Collection cycle dates are temporarily unavailable",
                    ex);
        }
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
        if (baseDate == null) {
            baseDate = LocalDate.now(clock.withZone(MANILA_ZONE));
        }
        DayOfWeek collectionDay = getCollectionDayOfWeek();
        int currentDayValue = baseDate.getDayOfWeek().getValue();
        int targetDayValue = collectionDay.getValue();
        int daysUntilTarget = (targetDayValue - currentDayValue + 7) % 7;
        if (daysUntilTarget == 0) {
            daysUntilTarget = 7;
        }
        return baseDate.plusDays(daysUntilTarget);
    }
}
