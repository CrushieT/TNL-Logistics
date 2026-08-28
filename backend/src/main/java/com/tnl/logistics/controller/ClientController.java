package com.tnl.logistics.controller;

import com.tnl.logistics.dto.ClientCreateRequest;
import com.tnl.logistics.dto.ClientDetailResponse;
import com.tnl.logistics.dto.ClientSummaryResponse;
import com.tnl.logistics.service.ClientService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing client listing, registration, profile inspection, and smart deletion endpoints.
 */
@RestController
@RequestMapping("/api/v1/clients")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<?> getClients(
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "all", defaultValue = "false") boolean all) {
        if (all || page == null) {
            return ResponseEntity.ok(clientService.getAllClients(active));
        }
        int pageNum = Math.max(0, page);
        int pageSize = size != null ? Math.max(1, size) : 20;
        PageRequest pageRequest = PageRequest.of(pageNum, pageSize, Sort.by("clientId").ascending());
        return ResponseEntity.ok(clientService.getClients(search, active, pageRequest));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<ClientDetailResponse> getClientById(@PathVariable("id") String id) {
        return ResponseEntity.ok(clientService.getClientById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<ClientSummaryResponse> createClient(@Valid @RequestBody ClientCreateRequest request) {
        return ResponseEntity.ok(clientService.createClient(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<ClientSummaryResponse> updateClient(
            @PathVariable("id") String id,
            @Valid @RequestBody ClientCreateRequest request) {
        return ResponseEntity.ok(clientService.updateClient(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<Void> deleteClient(@PathVariable("id") String id) {
        clientService.deleteClient(id);
        return ResponseEntity.noContent().build();
    }
}

