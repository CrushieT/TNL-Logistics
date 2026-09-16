package com.tnl.logistics.service;

import com.tnl.logistics.dto.ClientCreateRequest;
import com.tnl.logistics.dto.ClientDetailResponse;
import com.tnl.logistics.dto.ClientSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ClientService {

    Page<ClientSummaryResponse> getClients(String search, Boolean active, Pageable pageable);

    List<ClientSummaryResponse> getAllClients(Boolean active);

    ClientDetailResponse getClientById(String clientId);

    ClientSummaryResponse createClient(ClientCreateRequest request);

    ClientSummaryResponse updateClient(String clientId, ClientCreateRequest request);

    void deleteClient(String clientId);
}
