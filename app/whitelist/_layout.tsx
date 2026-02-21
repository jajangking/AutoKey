import { Stack } from 'expo-router';

export default function WhitelistLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ble" />
      <Stack.Screen name="wifi" />
    </Stack>
  );
}
