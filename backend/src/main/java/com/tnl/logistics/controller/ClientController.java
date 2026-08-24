package com.tnl.logistics.controller;

import com.tnl.logistics.model.Client;
import com.tnl.logistics.repository.ClientRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller exposing client listing for billing and shipment registration.
 */
@RestController
@RequestMapping("/api/v1/clients")
public class ClientController {

    private final ClientRepository clientRepository;

    public ClientController(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public ResponseEntity<List<Client>> getAllClients() {
        return ResponseEntity.ok(clientRepository.findAll());
    }
}
