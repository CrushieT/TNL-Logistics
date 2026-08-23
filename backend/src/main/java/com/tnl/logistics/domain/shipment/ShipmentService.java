package com.tnl.logistics.domain.shipment;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

/**
 * Service layer class implementing transaction management and business logic for Shipments.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShipmentService {

	private final ShipmentRepository shipmentRepository;

	/**
	 * Create and save a new shipment in the database.
	 *
	 * @param shipment the shipment entity details
	 * @return the saved shipment entity
	 */
	@Transactional
	public Shipment createShipment(Shipment shipment) {
		// Set default PENDING status if not set
		if (shipment.getStatus() == null) {
			shipment.setStatus(Shipment.ShipmentStatus.PENDING);
		}
		return shipmentRepository.save(shipment);
	}

	/**
	 * Retrieve a shipment by its ID.
	 *
	 * @param id the shipment ID
	 * @return an Optional containing the found shipment, or empty
	 */
	public Optional<Shipment> getShipmentById(Long id) {
		return shipmentRepository.findById(id);
	}

	/**
	 * Retrieve all shipments in the system.
	 *
	 * @return list of all shipments
	 */
	public List<Shipment> getAllShipments() {
		return shipmentRepository.findAll();
	}

	/**
	 * Retrieve all shipments for a specific client.
	 *
	 * @param clientId the client's ID
	 * @return list of shipments for the client
	 */
	public List<Shipment> getShipmentsByClientId(Long clientId) {
		return shipmentRepository.findByClientId(clientId);
	}

	/**
	 * Update the status of a specific shipment.
	 *
	 * @param id     the shipment ID
	 * @param status the new shipment status
	 * @return the updated shipment entity
	 */
	@Transactional
	public Shipment updateShipmentStatus(Long id, Shipment.ShipmentStatus status) {
		Shipment shipment = shipmentRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Shipment not found with id: " + id));
		shipment.setStatus(status);
		// TODO: Log tracking event for status update
		return shipmentRepository.save(shipment);
	}

}
