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
import com.tnl.logistics.service.CollectionsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    public CollectionsServiceImpl(ClientRepository clientRepository,
                                  ShipmentRepository shipmentRepository,
                                  PaymentRepository paymentRepository,
                                  SoaRepository soaRepository) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.soaRepository = soaRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public WeeklyCollectionsResponse getWeeklyCollections(LocalDate targetDate) {
        LocalDate targetThursday = (targetDate != null) ? targetDate : calculateActiveThursday(LocalDate.now());

        // 7-day Friday-to-Thursday cycle window
        LocalDateTime cycleStart = targetThursday.minusDays(6).atStartOfDay();
        LocalDateTime cycleEnd = targetThursday.atTime(23, 59, 59, 999999999);

        List<Client> clients = clientRepository.findAll();
        List<Shipment> cycleShipments = shipmentRepository.findByDateRegisteredBetweenOrderByDateRegisteredDesc(cycleStart, cycleEnd);

        Map<String, List<Shipment>> shipmentsByClient = cycleShipments.stream()
                .filter(s -> s.getClient() != null)
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

    @Override
    @Transactional(readOnly = true)
    public List<LocalDate> getActiveCycleThursdays() {
        List<LocalDate> registrationDates = shipmentRepository.findDistinctRegistrationDates();
        Set<LocalDate> activeThursdays = new TreeSet<>(Comparator.reverseOrder());
        for (LocalDate date : registrationDates) {
            if (date != null) {
                activeThursdays.add(calculateActiveThursday(date));
            }
        }
        return new ArrayList<>(activeThursdays);
    }

    private LocalDate calculateActiveThursday(LocalDate baseDate) {
        int dayOfWeek = baseDate.getDayOfWeek().getValue(); // 1 = Mon, 4 = Thu, 7 = Sun
        int daysUntilThursday = (4 - dayOfWeek + 7) % 7;
        return baseDate.plusDays(daysUntilThursday);
    }
}
