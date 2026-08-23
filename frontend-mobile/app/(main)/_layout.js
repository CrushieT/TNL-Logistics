import { Stack } from 'expo-router';

/**
 * Main Layout for protected screens.
 * Contains Stack navigator for home, scanning, and other internal screens.
 */
export default function MainLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="home" />
			<Stack.Screen name="scan" />
		</Stack>
	);
}
