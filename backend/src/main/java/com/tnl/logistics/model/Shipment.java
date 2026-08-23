package com.tnl.logistics.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Shipment Entity representing a parcel dispatch request.
 * Maps to the 'shipments' database table.
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "shipments")
public class Shipment {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "client_id", nullable = false)
	private Long clientId;

	@Column(nullable = false)
	private String origin;

	@Column(nullable = false)
	private String destination;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private ShipmentStatus status;

	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;

	@PrePersist
	protected void onCreate() {
		createdAt = LocalDateTime.now();
		status = ShipmentStatus.PENDING;
	}

	@PreUpdate
	protected void onUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public enum ShipmentStatus {
		PENDING,
		IN_TRANSIT,
		DELIVERED,
		CANCELLED
	}

}
