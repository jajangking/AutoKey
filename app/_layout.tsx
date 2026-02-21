import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider } from '@/context/ThemeContext';
import { WhitelistProvider } from '@/context/WhitelistContext';

export const unstable_settings = {
  initialRouteName: '(tabs)',
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider>
      <WhitelistProvider>
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Settings' }} />
            <Stack.Screen name="whitelist/index" options={{ title: 'Whitelist' }} />
            <Stack.Screen name="whitelist/ble" options={{ title: 'BLE Whitelist' }} />
            <Stack.Screen name="whitelist/wifi" options={{ title: 'WiFi Whitelist' }} />
          </Stack>
          <StatusBar style="light" backgroundColor="#0f172a" translucent={false} />
        </NavigationThemeProvider>
      </WhitelistProvider>
    </ThemeProvider>
  );
}
