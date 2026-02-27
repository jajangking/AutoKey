import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWhitelist } from '../../context/WhitelistContext';
import { Ionicons } from '@expo/vector-icons';

export default function WhitelistManagementScreen() {
  const { whitelist } = useWhitelist();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manajemen Whitelist</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={() => router.push('/whitelist/ble')}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Whitelist BLE</Text>
            <Text style={styles.countBadge}>{whitelist.ble.length}</Text>
          </View>
          <Text style={styles.optionDescription}>
            Kelola alamat MAC perangkat BLE yang diizinkan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionCard}
          onPress={() => router.push('/whitelist/wifi')}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.optionTitle}>Whitelist WiFi</Text>
            <Text style={styles.countBadge}>{whitelist.wifi.length}</Text>
          </View>
          <Text style={styles.optionDescription}>
            Kelola nama SSID WiFi yang diizinkan
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e2e8f0',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  optionCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  countBadge: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionDescription: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});