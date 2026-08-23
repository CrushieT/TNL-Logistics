import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';

const theme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: '#1d4ed8', // Custom blue matching tailwind config on web
		secondary: '#4b5563',
	},
};

/**
 * Root Layout of the Expo Router application.
 * Providers for styling (React Native Paper) and router stacks are registered here.
 */
export default function RootLayout() {
	return (
		<PaperProvider theme={theme}>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(auth)/login" />
				<Stack.Screen name="(main)" />
			</Stack>
		</PaperProvider>
	);
}
