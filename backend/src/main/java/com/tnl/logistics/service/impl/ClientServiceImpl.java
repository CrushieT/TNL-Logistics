package com.tnl.logistics.service.impl;

import com.tnl.logistics.dto.ClientCreateRequest;
import com.tnl.logistics.dto.ClientDetailResponse;
import com.tnl.logistics.dto.ClientSummaryResponse;
import com.tnl.logistics.dto.ShipmentSummaryResponse;
import com.tnl.logistics.model.*;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.ShipmentRepository;
import com.tnl.logistics.service.ClientService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for Client billing party management with zero N+1 aggregation and smart deletion.
 */
@Service
@Transactional
public class ClientServiceImpl implements ClientService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final ClientRepository clientRepository;
    private final ShipmentRepository shipmentRepository;
    private final PaymentRepository paymentRepository;
    private final ParcelUnitRepository parcelUnitRepository;

    public ClientServiceImpl(ClientRepository clientRepository,
                             ShipmentRepository shipmentRepository,
                             PaymentRepository paymentRepository,
                             ParcelUnitRepository parcelUnitRepository) {
        this.clientRepository = clientRepository;
        this.shipmentRepository = shipmentRepository;
        this.paymentRepository = paymentRepository;
        this.parcelUnitRepository = parcelUnitRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ClientSummaryResponse> getClients(String search, Boolean active, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        Page<Client> clientsPage = clientRepository.searchClients(cleanSearch, active, pageable);

        List<Client> clientList = clientsPage.getContent();
        if (clientList.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, clientsPage.getTotalElements());
        }

        List<ClientSummaryResponse> summaries = buildClientSummaries(clientList);
        return new PageImpl<>(summaries, pageable, clientsPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClientSummaryResponse> getAllClients(Boolean active) {
        List<Client> clients;
        if (Boolean.TRUE.equals(active)) {
            clients = clientRepository.findByActiveTrueOrderByClientIdAsc();
        } else if (Boolean.FALSE.equals(active)) {
            clients = clientRepository.searchClients(null, false, Pageable.unpaged()).getContent();
        } else {
            clients = clientRepository.findAllByOrderByClientIdAsc();
        }

        if (clients.isEmpty()) {
            return Collections.emptyList();
        }

        return buildClientSummaries(clients);
    }

    @Override
    @Transactional(readOnly = true)
    public ClientDetailResponse getClientById(String clientId) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + clientId));

        List<Shipment> shipments = shipmentRepository.findByClient_ClientIdOrderByDateRegisteredDesc(clientId);

        long totalShipments = shipments.size();
        long totalParcels = 0L;
        BigDecimal totalCharges = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        long completedDeliveries = 0L;

        List<ShipmentSummaryResponse> shipmentSummaries = new ArrayList<>();

        if (shipments.isEmpty()) {
            return new ClientDetailResponse(
                    client.getClientId(),
                    client.getName(),
                    client.getAddress(),
                    client.getContactNumber(),
                    client.getEmail(),
                    client.getDefaultRateType(),
                    client.getActive(),
                    client.getDateRegistered() != null ? client.getDateRegistered() : client.getCreatedAt(),
                    0L,
                    0L,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    0L,
                    Collections.emptyList()
            );
        }

        List<String> shipmentIds = shipments.stream()
                .map(Shipment::getShipmentId)
                .collect(Collectors.toList());

        List<ParcelUnit> allParcels = parcelUnitRepository.findByShipment_ShipmentIdInOrderBySeqAsc(shipmentIds);
        List<Payment> allPayments = paymentRepository.findByShipment_ShipmentIdIn(shipmentIds);

        Map<String, List<ParcelUnit>> parcelsByShipmentId = allParcels.stream()
                .collect(Collectors.groupingBy(p -> p.getShipment().getShipmentId()));
        Map<String, List<Payment>> paymentsByShipmentId = allPayments.stream()
                .collect(Collectors.groupingBy(p -> p.getShipment().getShipmentId()));

        for (Shipment s : shipments) {
            totalParcels += (s.getQuantity() != null ? s.getQuantity() : 0);
            if (s.getTotalAmount() != null) {
                totalCharges = totalCharges.add(s.getTotalAmount());
            }

            List<ParcelUnit> parcels = parcelsByShipmentId.getOrDefault(s.getShipmentId(), Collections.emptyList());
            List<Payment> payments = paymentsByShipmentId.getOrDefault(s.getShipmentId(), Collections.emptyList());

            BigDecimal sPaid = payments.stream()
                    .map(Payment::getAmountPaid)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalPaid = totalPaid.add(sPaid);

            BigDecimal sBalance = s.getTotalAmount().subtract(sPaid);
            if (sBalance.compareTo(BigDecimal.ZERO) < 0) sBalance = BigDecimal.ZERO;

            String paymentStr = sPaid.compareTo(s.getTotalAmount()) >= 0 ? "Paid"
                    : (sPaid.compareTo(BigDecimal.ZERO) > 0 ? "Partial" : "Unpaid");

            RollupStatus rollup = computeRollupStatus(parcels);
            if ("Arrived at TNL".equalsIgnoreCase(rollup.overallStatus) || "Loaded to Hauler".equalsIgnoreCase(rollup.overallStatus)) {
                completedDeliveries++;
            }

            String dateLabel = s.getDateRegistered() != null
                    ? s.getDateRegistered().format(DATE_FORMATTER)
                    : "—";

            shipmentSummaries.add(new ShipmentSummaryResponse(
                    s.getShipmentId(),
                    client.getClientId(),
                    client.getName(),
                    s.getRecipientName(),
                    s.getRecipientContact(),
                    s.getQuantity(),
                    rollup.overallStatus,
                    rollup.statusRollup,
                    paymentStr,
                    s.getTotalAmount(),
                    sPaid,
                    sBalance,
                    s.getRoute() != null ? s.getRoute() : "Manila → TNL Baguio",
                    s.getDateRegistered(),
                    dateLabel
            ));
        }

        BigDecimal outstandingBalance = totalCharges.subtract(totalPaid).max(BigDecimal.ZERO);

        return new ClientDetailResponse(
                client.getClientId(),
                client.getName(),
                client.getAddress(),
                client.getContactNumber(),
                client.getEmail(),
                client.getDefaultRateType(),
                client.getActive(),
                client.getDateRegistered() != null ? client.getDateRegistered() : client.getCreatedAt(),
                totalShipments,
                totalParcels,
                totalCharges,
                totalPaid,
                outstandingBalance,
                completedDeliveries,
                shipmentSummaries
        );
    }

    @Override
    public synchronized ClientSummaryResponse createClient(ClientCreateRequest request) {
        String prefix = "CL-";
        String maxId = clientRepository.findMaxClientIdWithPrefix(prefix + "%").orElse(null);
        int nextSeq = 1;
        if (maxId != null && maxId.startsWith(prefix)) {
            try {
                nextSeq = Integer.parseInt(maxId.substring(prefix.length())) + 1;
            } catch (NumberFormatException ignored) {}
        }
        String clientId = String.format("CL-%03d", nextSeq);

        ChargeModel rateType = ChargeModel.FLAT;
        if (request.getDefaultRateType() != null && !request.getDefaultRateType().isBlank()) {
            try {
                rateType = ChargeModel.valueOf(request.getDefaultRateType().toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }

        Boolean active = request.getActive() != null ? request.getActive() : true;

        Client client = new Client(
                clientId,
                request.getName().trim(),
                request.getAddress().trim(),
                request.getContactNumber().trim(),
                request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim() : null,
                rateType,
                active
        );

        Client saved = clientRepository.save(client);

        return new ClientSummaryResponse(
                saved.getClientId(),
                saved.getName(),
                saved.getAddress(),
                saved.getContactNumber(),
                saved.getEmail(),
                saved.getDefaultRateType(),
                saved.getActive(),
                saved.getDateRegistered() != null ? saved.getDateRegistered() : saved.getCreatedAt(),
                0L,
                0L,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO
        );
    }

    @Override
    public ClientSummaryResponse updateClient(String clientId, ClientCreateRequest request) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + clientId));

        client.setName(request.getName().trim());
        client.setAddress(request.getAddress().trim());
        client.setContactNumber(request.getContactNumber().trim());
        client.setEmail(request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim() : null);

        if (request.getDefaultRateType() != null && !request.getDefaultRateType().isBlank()) {
            try {
                client.setDefaultRateType(ChargeModel.valueOf(request.getDefaultRateType().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        if (request.getActive() != null) {
            client.setActive(request.getActive());
        }

        Client saved = clientRepository.save(client);
        List<ClientSummaryResponse> summaries = buildClientSummaries(Collections.singletonList(saved));
        return summaries.get(0);
    }

    @Override
    public void deleteClient(String clientId) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalArgumentException("Client not found with ID: " + clientId));

        long shipmentCount = shipmentRepository.countByClient_ClientId(clientId);
        if (shipmentCount == 0) {
            // Smart Delete: Permanent Hard Delete for unused clients
            clientRepository.delete(client);
        } else {
            // Smart Delete: Soft Deactivation to preserve accounting integrity & past invoices
            client.setActive(false);
            clientRepository.save(client);
        }
    }

    private List<ClientSummaryResponse> buildClientSummaries(List<Client> clientList) {
        List<String> clientIds = clientList.stream().map(Client::getClientId).collect(Collectors.toList());

        // Batch Query 1: Grouped count, total quantity, total amount per client
        List<Object[]> shipmentStats = shipmentRepository.countAndSumShipmentsByClientIds(clientIds);
        Map<String, Long> countMap = new HashMap<>();
        Map<String, Long> parcelMap = new HashMap<>();
        Map<String, BigDecimal> totalAmountMap = new HashMap<>();

        for (Object[] row : shipmentStats) {
            String cid = (String) row[0];
            Long count = (Long) row[1];
            Long parcels = ((Number) row[2]).longValue();
            BigDecimal amount = (BigDecimal) row[3];

            countMap.put(cid, count);
            parcelMap.put(cid, parcels);
            totalAmountMap.put(cid, amount);
        }

        // Batch Query 2: Grouped sum of payments per client
        List<Object[]> paymentStats = shipmentRepository.sumPaymentsByClientIds(clientIds);
        Map<String, BigDecimal> paidMap = new HashMap<>();

        for (Object[] row : paymentStats) {
            String cid = (String) row[0];
            BigDecimal paid = (BigDecimal) row[1];
            paidMap.put(cid, paid);
        }

        // Assemble O(1) mapped response summaries
        return clientList.stream().map(c -> {
            String cid = c.getClientId();
            long count = countMap.getOrDefault(cid, 0L);
            long parcels = parcelMap.getOrDefault(cid, 0L);
            BigDecimal charges = totalAmountMap.getOrDefault(cid, BigDecimal.ZERO);
            BigDecimal paid = paidMap.getOrDefault(cid, BigDecimal.ZERO);
            BigDecimal balance = charges.subtract(paid).max(BigDecimal.ZERO);

            return new ClientSummaryResponse(
                    c.getClientId(),
                    c.getName(),
                    c.getAddress(),
                    c.getContactNumber(),
                    c.getEmail(),
                    c.getDefaultRateType(),
                    c.getActive(),
                    c.getDateRegistered() != null ? c.getDateRegistered() : c.getCreatedAt(),
                    count,
                    parcels,
                    charges,
                    paid,
                    balance
            );
        }).collect(Collectors.toList());
    }

    private static class RollupStatus {
        String overallStatus;
        String statusRollup;
        RollupStatus(String overallStatus, String statusRollup) {
            this.overallStatus = overallStatus;
            this.statusRollup = statusRollup;
        }
    }

    private RollupStatus computeRollupStatus(List<ParcelUnit> parcels) {
        if (parcels.isEmpty()) {
            return new RollupStatus("Registered", "0 / 0 Registered");
        }

        int total = parcels.size();
        Map<ParcelStatus, Long> counts = parcels.stream()
                .collect(Collectors.groupingBy(ParcelUnit::getCurrentStatus, Collectors.counting()));

        if (counts.containsKey(ParcelStatus.LOADED_TO_HAULER)) {
            long c = counts.get(ParcelStatus.LOADED_TO_HAULER);
            return new RollupStatus("Loaded to Hauler", c + " / " + total + " Loaded to Hauler");
        }
        if (counts.containsKey(ParcelStatus.ARRIVED_AT_TNL)) {
            long c = counts.get(ParcelStatus.ARRIVED_AT_TNL);
            return new RollupStatus("Arrived at TNL", c + " / " + total + " Arrived at TNL");
        }
        if (counts.containsKey(ParcelStatus.LOADED_ON_TRUCK)) {
            long c = counts.get(ParcelStatus.LOADED_ON_TRUCK);
            return new RollupStatus("Loaded on Truck", c + " / " + total + " Loaded on Truck");
        }
        if (counts.containsKey(ParcelStatus.QR_GENERATED)) {
            long c = counts.get(ParcelStatus.QR_GENERATED);
            return new RollupStatus("QR Generated", c + " / " + total + " QR Generated");
        }

        long c = counts.getOrDefault(ParcelStatus.REGISTERED, (long) total);
        return new RollupStatus("Registered", c + " / " + total + " Registered");
    }
}
