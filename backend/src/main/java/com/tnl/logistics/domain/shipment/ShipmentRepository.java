package com.tnl.logistics.domain.shipment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Repository interface for managing Shipment database operations.
 */
@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

	/**
	 * Retrieve all shipments associated with a specific client.
	 *
	 * @param clientId the ID of the client
	 * @return a list of shipments matching the client ID
	 */
	List<Shipment> findByClientId(Long clientId);

}
