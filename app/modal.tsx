import { Link, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View, Text, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useWhitelist } from '@/context/WhitelistContext';

export default function ModalScreen() {
  const router = useRouter();
  const { whitelist } = useWhitelist();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Settings</ThemedText>
      </ThemedView>

      <ThemedView style={styles.content}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/whitelist')}
        >
          <View style={styles.menuIconContainer}>
            <IconSymbol name="list.bullet.rectangle" size={24} color="#3b82f6" />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Whitelist</Text>
            <Text style={styles.menuDescription}>
              Kelola perangkat BLE dan WiFi yang diizinkan
            </Text>
          </View>
          <View style={styles.menuBadge}>
            <Text style={styles.badgeText}>
              {whitelist.ble.length + whitelist.wifi.length}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#64748b" />
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.footer}>
        <Link href="/" dismissTo>
          <ThemedText type="link">Dismiss</ThemedText>
        </Link>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 13,
    opacity: 0.7,
  },
  menuBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
