import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider } from '@/context/ThemeContext';
import { WhitelistProvider } from '@/context/WhitelistContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider>
      <WhitelistProvider>
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ title: 'AutoKey' }} />
            <Stack.Screen name="control" options={{ title: 'Control' }} />
            <Stack.Screen name="history" options={{ title: 'History' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Settings' }} />
            <Stack.Screen name="whitelist" options={{ title: 'Whitelist' }} />
          </Stack>
          <StatusBar style="light" backgroundColor="#0f172a" translucent={false} />
        </NavigationThemeProvider>
      </WhitelistProvider>
    </ThemeProvider>
  );
}
