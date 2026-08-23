import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { apiClient } from '../api/client';

/**
 * ShipmentForm Component for React Native.
 * Renders output fields to register a shipment and transmits data to backend.
 */
export default function ShipmentForm({ onShipmentCreated }) {
	const [clientId, setClientId] = useState('');
	const [origin, setOrigin] = useState('');
	const [destination, setDestination] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async () => {
		setLoading(true);
		setError(null);
		setSuccess(false);

		if (!clientId || !origin || !destination) {
			setError('All fields are required.');
			setLoading(false);
			return;
		}

		try {
			const payload = {
				clientId: parseInt(clientId, 10),
				origin,
				destination
			};

			const response = await apiClient.post('/api/v1/shipments', payload);
			setSuccess(true);
			setClientId('');
			setOrigin('');
			setDestination('');

			if (onShipmentCreated) {
				onShipmentCreated(response.data);
			}
		} catch (err) {
			setError(err.response?.data?.message || 'Failed to register shipment.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Register New Shipment</Text>

			{success && <Text style={styles.successText}>Shipment registered successfully!</Text>}
			{error && <Text style={styles.errorText}>{error}</Text>}

			<TextInput
				label="Client ID"
				value={clientId}
				onChangeText={setClientId}
				keyboardType="numeric"
				mode="outlined"
				style={styles.input}
			/>

			<TextInput
				label="Origin Address"
				value={origin}
				onChangeText={setOrigin}
				mode="outlined"
				style={styles.input}
			/>

			<TextInput
				label="Destination Address"
				value={destination}
				onChangeText={setDestination}
				mode="outlined"
				style={styles.input}
			/>

			<Button
				mode="contained"
				onPress={handleSubmit}
				loading={loading}
				disabled={loading}
				style={styles.button}
			>
				Register Shipment
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: '#ffffff',
		borderRadius: 8,
		padding: 24,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		width: '100%',
	},
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 16,
		color: '#1f2937',
	},
	input: {
		marginBottom: 12,
	},
	button: {
		marginTop: 8,
		borderRadius: 6,
	},
	successText: {
		color: '#16a34a',
		backgroundColor: '#f0fdf4',
		padding: 10,
		borderRadius: 6,
		marginBottom: 16,
		fontSize: 14,
	},
	errorText: {
		color: '#dc2626',
		backgroundColor: '#fef2f2',
		padding: 10,
		borderRadius: 6,
		marginBottom: 16,
		fontSize: 14,
	},
});
