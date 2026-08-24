package com.tnl.logistics.controller;

import com.tnl.logistics.dto.ClientCreateRequest;
import com.tnl.logistics.model.Client;
import com.tnl.logistics.repository.ClientRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller exposing client listing and registration endpoints.
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

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")
    public synchronized ResponseEntity<Client> createClient(@Valid @RequestBody ClientCreateRequest request) {
        long maxSeq = 0;
        List<Client> allClients = clientRepository.findAll();
        for (Client c : allClients) {
            String id = c.getClientId();
            if (id != null && id.startsWith("CL-")) {
                try {
                    long seq = Long.parseLong(id.substring(3));
                    if (seq > maxSeq) {
                        maxSeq = seq;
                    }
                } catch (NumberFormatException ignored) {}
            }
        }
        String newClientId = String.format("CL-%03d", maxSeq + 1);

        Client client = new Client(
                newClientId,
                request.getName().trim(),
                request.getAddress().trim(),
                request.getContactNumber().trim(),
                request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail().trim() : null
        );

        Client saved = clientRepository.save(client);
        return ResponseEntity.ok(saved);
    }
}
