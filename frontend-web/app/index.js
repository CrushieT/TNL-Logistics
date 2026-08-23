import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Surface, DataTable } from 'react-native-paper';
import { apiClient } from '../api/client';
import ShipmentForm from '../components/ShipmentForm';

/**
 * Dashboard Screen for Web Admin.
 * Displays registry form alongside live shipment datatable.
 */
export default function DashboardScreen() {
	const [shipments, setShipments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	const fetchShipments = async () => {
		try {
			setError(false);
			const response = await apiClient.get('/api/v1/shipments');
			setShipments(response.data);
		} catch (err) {
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchShipments();
		// Poll every 5 seconds for updates
		const interval = setInterval(fetchShipments, 5000);
		return () => clearInterval(interval);
	}, []);

	const handleShipmentCreated = () => {
		fetchShipments();
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
			<View style={styles.header}>
				<Text style={styles.title}>TNL Logistics Admin Web</Text>
				<Text style={styles.subtitle}>
					Manage shipments, billings, and track operations in real-time (React Native Web).
				</Text>
			</View>

			<View style={styles.mainLayout}>
				{/* Register Form Section */}
				<View style={styles.formSection}>
					<ShipmentForm onShipmentCreated={handleShipmentCreated} />
				</View>

				{/* Active Shipments Table Section */}
				<Surface style={styles.tableSection} elevation={1}>
					<Text style={styles.sectionTitle}>Active Shipments</Text>
					
					{loading && (
						<View style={styles.loaderContainer}>
							<ActivityIndicator size="large" color="#1d4ed8" />
							<Text style={styles.loaderText}>Loading shipments...</Text>
						</View>
					)}

					{error && (
						<Text style={styles.errorText}>
							Failed to fetch shipments. Ensure the backend API is running.
						</Text>
					)}

					{!loading && !error && shipments.length === 0 && (
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>No shipments found.</Text>
							<Text style={styles.emptySubText}>Use the registration form to create one.</Text>
						</View>
					)}

					{!loading && !error && shipments.length > 0 && (
						<DataTable>
							<DataTable.Header>
								<DataTable.Title style={styles.colId}>ID</DataTable.Title>
								<DataTable.Title style={styles.colClient}>Client ID</DataTable.Title>
								<DataTable.Title style={styles.colAddress}>Origin</DataTable.Title>
								<DataTable.Title style={styles.colAddress}>Destination</DataTable.Title>
								<DataTable.Title style={styles.colStatus}>Status</DataTable.Title>
							</DataTable.Header>

							{shipments.map((shipment) => (
								<DataTable.Row key={shipment.id}>
									<DataTable.Cell style={styles.colId}>#{shipment.id}</DataTable.Cell>
									<DataTable.Cell style={styles.colClient}>{shipment.clientId}</DataTable.Cell>
									<DataTable.Cell style={styles.colAddress}>{shipment.origin}</DataTable.Cell>
									<DataTable.Cell style={styles.colAddress}>{shipment.destination}</DataTable.Cell>
									<DataTable.Cell style={styles.colStatus}>
										<Text style={[
											styles.statusBadge,
											shipment.status === 'DELIVERED' ? styles.statusDelivered :
											shipment.status === 'IN_TRANSIT' ? styles.statusTransit :
											shipment.status === 'CANCELLED' ? styles.statusCancelled :
											styles.statusPending
										]}>
											{shipment.status}
										</Text>
									</DataTable.Cell>
								</DataTable.Row>
							))}
						</DataTable>
					)}
				</Surface>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f9fafb',
	},
	contentContainer: {
		padding: 32,
		maxWidth: 1200,
		width: '100%',
		alignSelf: 'center',
	},
	header: {
		marginBottom: 32,
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#111827',
	},
	subtitle: {
		fontSize: 14,
		color: '#6b7280',
		marginTop: 4,
	},
	mainLayout: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginHorizontal: -12,
	},
	formSection: {
		width: '100%',
		maxWidth: 400,
		paddingHorizontal: 12,
		marginBottom: 24,
	},
	tableSection: {
		flex: 1,
		minWidth: 500,
		padding: 24,
		backgroundColor: '#ffffff',
		borderRadius: 8,
		marginHorizontal: 12,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: '#e5e7eb',
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 16,
		color: '#1f2937',
	},
	loaderContainer: {
		alignItems: 'center',
		paddingVertical: 48,
	},
	loaderText: {
		marginTop: 12,
		color: '#6b7280',
		fontSize: 14,
	},
	errorText: {
		color: '#dc2626',
		backgroundColor: '#fef2f2',
		padding: 12,
		borderRadius: 6,
		fontSize: 14,
		marginVertical: 12,
	},
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 48,
		borderWidth: 2,
		borderStyle: 'dashed',
		borderColor: '#d1d5db',
		borderRadius: 8,
	},
	emptyText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#9ca3af',
	},
	emptySubText: {
		fontSize: 12,
		color: '#9ca3af',
		marginTop: 4,
	},
	colId: { flex: 0.5 },
	colClient: { flex: 0.8 },
	colAddress: { flex: 2 },
	colStatus: { flex: 1.2 },
	statusBadge: {
		fontSize: 11,
		fontWeight: 'bold',
		paddingVertical: 2,
		paddingHorizontal: 8,
		borderRadius: 12,
		overflow: 'hidden',
		textAlign: 'center',
	},
	statusDelivered: { backgroundColor: '#d1fae5', color: '#065f46' },
	statusTransit: { backgroundColor: '#dbeafe', color: '#1e40af' },
	statusCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
	statusPending: { backgroundColor: '#fef3c7', color: '#92400e' },
});
