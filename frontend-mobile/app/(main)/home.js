import React from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Button, Card, Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';

/**
 * Home Screen for Field Agents.
 * Houses core operational shortcuts: barcode scanning and printer pairing.
 */
export default function HomeScreen() {
	const router = useRouter();

	const handleScanPress = () => {
		router.push('/scan');
	};

	const handlePrintLabel = () => {
		Alert.alert(
			'Label Printing',
			'EscPos bluetooth integration placeholder.\n\nTODO: Connect to ESC/POS print-head and transmit shipment payload.',
			[{ text: 'OK' }]
		);
	};

	const handleLogout = () => {
		router.replace('/login');
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
			<View style={styles.header}>
				<View>
					<Text style={styles.greeting}>Welcome, Agent</Text>
					<Text style={styles.subGreeting}>Station A - New York</Text>
				</View>
				<Button mode="text" onPress={handleLogout} textColor="#ef4444">
					Sign Out
				</Button>
			</View>

			{/* Stats Grid */}
			<View style={styles.statsContainer}>
				<Surface style={styles.statCard} elevation={1}>
					<Text style={styles.statNumber}>12</Text>
					<Text style={styles.statLabel}>To Scan</Text>
				</Surface>
				<Surface style={styles.statCard} elevation={1}>
					<Text style={styles.statNumber}>8</Text>
					<Text style={styles.statLabel}>In Van</Text>
				</Surface>
				<Surface style={styles.statCard} elevation={1}>
					<Text style={styles.statNumber}>45</Text>
					<Text style={styles.statLabel}>Delivered</Text>
				</Surface>
			</View>

			{/* Operation Cards */}
			<Card style={styles.card} onPress={handleScanPress}>
				<Card.Title 
					title="Scan QR Code" 
					subtitle="Scan parcel unit tags to dispatch or update tracking events"
				/>
				<Card.Content>
					<Text style={styles.cardText}>
						Activate camera to read shipment QR/barcodes and sync with the central server.
					</Text>
				</Card.Content>
				<Card.Actions>
					<Button icon="camera" mode="contained" onPress={handleScanPress}>
						Open Scanner
					</Button>
				</Card.Actions>
			</Card>

			<Card style={styles.card} onPress={handlePrintLabel}>
				<Card.Title 
					title="Label Printing" 
					subtitle="Bluetooth Thermal Label Printer (ESC/POS)"
				/>
				<Card.Content>
					<Text style={styles.cardText}>
						Pair local mobile unit to thermal belt-printers to issue custom labels on-site.
					</Text>
				</Card.Content>
				<Card.Actions>
					<Button icon="printer" mode="outlined" onPress={handlePrintLabel}>
						Print Test Label
					</Button>
				</Card.Actions>
			</Card>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f3f4f6',
	},
	contentContainer: {
		padding: 16,
		paddingTop: 48,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 24,
	},
	greeting: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#111827',
	},
	subGreeting: {
		fontSize: 14,
		color: '#6b7280',
	},
	statsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 24,
	},
	statCard: {
		flex: 1,
		padding: 16,
		marginHorizontal: 4,
		backgroundColor: '#ffffff',
		borderRadius: 8,
		alignItems: 'center',
	},
	statNumber: {
		fontSize: 22,
		fontWeight: 'bold',
		color: '#1d4ed8',
	},
	statLabel: {
		fontSize: 12,
		color: '#4b5563',
		marginTop: 4,
	},
	card: {
		marginBottom: 16,
		backgroundColor: '#ffffff',
	},
	cardText: {
		fontSize: 14,
		color: '#4b5563',
		lineHeight: 20,
	},
});
