import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

/**
 * Login Screen.
 * Demonstrates basic credential gathering and authenticating flow,
 * navigating into the main application group upon mock verification.
 */
export default function LoginScreen() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);

	const handleLogin = () => {
		setLoading(true);
		// Mock login delay. In production, request auth tokens from backend.
		setTimeout(() => {
			setLoading(false);
			router.replace('/home');
		}, 1000);
	};

	return (
		<View style={styles.container}>
			<View style={styles.logoContainer}>
				<Text style={styles.logoText}>TNL Logistics</Text>
				<Text style={styles.subtext}>Field Agent Portal</Text>
			</View>

			<View style={styles.formContainer}>
				<TextInput
					label="Email"
					value={email}
					onChangeText={setEmail}
					mode="outlined"
					autoCapitalize="none"
					keyboardType="email-address"
					style={styles.input}
				/>

				<TextInput
					label="Password"
					value={password}
					onChangeText={setPassword}
					secureTextEntry
					mode="outlined"
					style={styles.input}
				/>

				<Button
					mode="contained"
					onPress={handleLogin}
					loading={loading}
					disabled={loading}
					style={styles.button}
					contentStyle={styles.buttonContent}
				>
					Sign In
				</Button>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#ffffff',
		justifyContent: 'center',
		padding: 24,
	},
	logoContainer: {
		alignItems: 'center',
		marginBottom: 40,
	},
	logoText: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#1d4ed8',
	},
	subtext: {
		fontSize: 16,
		color: '#6b7280',
		marginTop: 4,
	},
	formContainer: {
		width: '100%',
	},
	input: {
		marginBottom: 16,
	},
	button: {
		marginTop: 8,
		borderRadius: 6,
	},
	buttonContent: {
		paddingVertical: 6,
	},
});
