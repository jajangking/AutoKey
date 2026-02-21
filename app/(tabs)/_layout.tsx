import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme === 'oled' ? Colors.oled.tint :
                             theme === 'dark' ? Colors.dark.tint :
                             Colors.light.tint,
        tabBarButton: HapticTab,
        tabBarStyle: { display: 'none' },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="control"
        options={{
          title: 'Control',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gamecontroller" color={color} />,
        }}
      />
    </Tabs>
  );
}
