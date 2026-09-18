import React, { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Button, Text, IconButton } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { apiClient } from '../../api/client';

/**
 * QR Scanner Screen.
 * Uses expo-camera to read parcel QR codes, and posts status updates
 * back to the core Spring Boot REST API.
 */
export default function ScanScreen() {
	const router = useRouter();
	const [permission, requestPermission] = useCameraPermissions();
	const [scanned, setScanned] = useState(false);
	const [loading, setLoading] = useState(false);

	if (!permission) {
		// Camera permissions are loading
		return <View style={styles.container} />;
	}

	if (!permission.granted) {
		return (
			<View style={styles.centeredContainer}>
				<Text style={styles.permissionText}>
					Camera permission is required to scan parcel QR tags.
				</Text>
				<Button mode="contained" onPress={requestPermission} style={styles.button}>
					Grant Permission
				</Button>
				<Button mode="text" onPress={() => router.back()} style={styles.backButton}>
					Cancel
				</Button>
			</View>
		);
	}

	const handleBarcodeScanned = async ({ type, data }) => {
		setScanned(true);
		setLoading(true);

		try {
			// Expected QR code data format: JSON or simple ID string (e.g. "shipment_123")
			// Simulating API sync:
			Alert.alert(
				'Tag Scanned',
				`Type: ${type}\nData: ${data}\n\nSyncing status with backend...`,
				[
					{
						text: 'Update IN_TRANSIT',
						onPress: () => updateStatus(data, 'IN_TRANSIT')
					},
					{
						text: 'Update DELIVERED',
						onPress: () => updateStatus(data, 'DELIVERED')
					},
					{
						text: 'Cancel',
						onPress: () => {
							setScanned(false);
							setLoading(false);
						},
						style: 'cancel'
					}
				]
			);
		} catch (err) {
			Alert.alert('Scan Error', 'Unable to parse QR metadata.');
			setScanned(false);
			setLoading(false);
		}
	};

	const updateStatus = async (shipmentId, status) => {
		try {
			// Extract numerical ID from scanned string or use directly
			const cleanId = shipmentId.replace(/[^0-9]/g, '');
			if (!cleanId) {
				throw new Error('Invalid shipment barcode ID');
			}

			// Call the backend PATCH status endpoint
			const response = await apiClient.patch(`/api/v1/shipments/${cleanId}/status?status=${status}`);
			
			Alert.alert('Sync Successful', `Shipment #${cleanId} marked as ${status}.`);
		} catch (err) {
			Alert.alert(
				'Sync Failed',
				err.response?.data?.message || 'Could not sync update to server. Saved to offline queue.'
			);
		} finally {
			setScanned(false);
			setLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			<CameraView
				style={StyleSheet.absoluteFillObject}
				onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
				barcodeScannerSettings={{
					barcodeTypes: ['qr'],
				}}
			/>

			{/* Scanning HUD Overlay */}
			<View style={styles.overlay}>
				<View style={styles.headerRow}>
					<IconButton
						icon="arrow-left"
						iconColor="#ffffff"
						size={28}
						style={styles.backIconButton}
						onPress={() => router.back()}
					/>
					<Text style={styles.title}>Scan Parcel QR</Text>
					<View style={{ width: 48 }} /> {/* Spacing spacer */}
				</View>

				<View style={styles.targetFrameContainer}>
					<View style={styles.targetFrame} />
				</View>

				<View style={styles.footerRow}>
					<Text style={styles.instructionText}>
						{loading ? 'Processing scan...' : 'Align QR code within the frame to scan'}
					</Text>
					{scanned && !loading && (
						<Button mode="contained" onPress={() => setScanned(false)} style={styles.scanAgainButton}>
							Tap to Scan Again
						</Button>
					)}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000000',
	},
	centeredContainer: {
		flex: 1,
		backgroundColor: '#ffffff',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	permissionText: {
		fontSize: 16,
		color: '#4b5563',
		textAlign: 'center',
		marginBottom: 24,
	},
	button: {
		borderRadius: 6,
		width: '80%',
		marginBottom: 12,
	},
	backButton: {
		width: '80%',
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
		justifyContent: 'space-between',
		paddingVertical: 48,
		paddingHorizontal: 24,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	backIconButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#ffffff',
		textAlign: 'center',
	},
	targetFrameContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	targetFrame: {
		width: 250,
		height: 250,
		borderWidth: 3,
		borderColor: '#1d4ed8',
		borderRadius: 16,
		backgroundColor: 'transparent',
	},
	footerRow: {
		alignItems: 'center',
	},
	instructionText: {
		color: '#ffffff',
		fontSize: 14,
		textAlign: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		overflow: 'hidden',
	},
	scanAgainButton: {
		marginTop: 16,
		backgroundColor: '#1d4ed8',
		borderRadius: 6,
	},
});
