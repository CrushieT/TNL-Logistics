import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';

const theme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: '#1d4ed8', // Admin branding blue
		secondary: '#4b5563',
	},
};

/**
 * Root Layout for the Expo web client.
 * Registers styling contexts (React Native Paper) and the routing context.
 */
export default function RootLayout() {
	return (
		<PaperProvider theme={theme}>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="index" />
			</Stack>
		</PaperProvider>
	);
}
