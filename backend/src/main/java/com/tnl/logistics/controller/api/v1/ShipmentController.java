package com.tnl.logistics.controller.api.v1;

import com.tnl.logistics.domain.shipment.Shipment;
import com.tnl.logistics.domain.shipment.ShipmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * REST controller for Shipment API endpoints under /api/v1/shipments.
 * Enables registration, retrieval, and status updates for shipments.
 */
@RestController
@RequestMapping("/api/v1/shipments")
@RequiredArgsConstructor
@Tag(name = "Shipment API", description = "Endpoints for registering, searching, and updating shipments")
public class ShipmentController {

	private final ShipmentService shipmentService;

	/**
	 * Register a new shipment.
	 *
	 * @param shipment the shipment entity input details
	 * @return HTTP 201 Created containing the saved shipment details
	 */
	@PostMapping
	@Operation(summary = "Create/Register a new shipment")
	public ResponseEntity<Shipment> createShipment(@RequestBody Shipment shipment) {
		Shipment created = shipmentService.createShipment(shipment);
		return ResponseEntity.status(HttpStatus.CREATED).body(created);
	}

	/**
	 * Retrieve details of a shipment by its ID.
	 *
	 * @param id the unique shipment ID
	 * @return HTTP 200 OK with the shipment, or HTTP 404 Not Found
	 */
	@GetMapping("/{id}")
	@Operation(summary = "Get shipment details by ID")
	public ResponseEntity<Shipment> getShipmentById(@PathVariable Long id) {
		return shipmentService.getShipmentById(id)
				.map(ResponseEntity::ok)
				.orElse(ResponseEntity.notFound().build());
	}

	/**
	 * Retrieve all shipments, optionally filtered by a specific client.
	 *
	 * @param clientId optional client identifier filter
	 * @return HTTP 200 OK with the list of shipments
	 */
	@GetMapping
	@Operation(summary = "Retrieve all shipments, optionally filtering by client ID")
	public ResponseEntity<List<Shipment>> getAllShipments(@RequestParam(required = false) Long clientId) {
		if (clientId != null) {
			return ResponseEntity.ok(shipmentService.getShipmentsByClientId(clientId));
		}
		return ResponseEntity.ok(shipmentService.getAllShipments());
	}

	/**
	 * Update the status of an existing shipment (e.g. from PENDING to IN_TRANSIT).
	 *
	 * @param id     the unique shipment ID
	 * @param status the new status value
	 * @return HTTP 200 OK with the updated shipment, or HTTP 404 if not found
	 */
	@PatchMapping("/{id}/status")
	@Operation(summary = "Update shipment status (e.g., to IN_TRANSIT, DELIVERED)")
	public ResponseEntity<Shipment> updateShipmentStatus(
			@PathVariable Long id,
			@RequestParam Shipment.ShipmentStatus status) {
		try {
			Shipment updated = shipmentService.updateShipmentStatus(id, status);
			return ResponseEntity.ok(updated);
		} catch (IllegalArgumentException e) {
			return ResponseEntity.notFound().build();
		}
	}

}
