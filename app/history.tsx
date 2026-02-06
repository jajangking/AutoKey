import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLog } from '../context/LogContext';

export default function HistoryScreen() {
  const { logs, clearLogs } = useLog();
  const router = useRouter();

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'ble_connect': return 'BLE Terhubung';
      case 'ble_disconnect': return 'BLE Terputus';
      case 'wifi_connect': return 'WiFi Terhubung';
      case 'wifi_disconnect': return 'WiFi Terputus';
      case 'kontak_on': return 'Kontak ON';
      case 'kontak_off': return 'Kontak OFF';
      case 'remote_on': return 'Remote ON';
      case 'remote_off': return 'Remote OFF';
      default: return type;
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'ble_connect':
      case 'wifi_connect':
      case 'kontak_on':
      case 'remote_on':
        return '#10b981'; // Green for positive actions
      case 'ble_disconnect':
      case 'wifi_disconnect':
      case 'kontak_off':
      case 'remote_off':
        return '#ef4444'; // Red for negative actions
      default:
        return '#94a3b8'; // Gray for others
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={[styles.logType, { color: getLogTypeColor(item.type) }]}>
          {getLogTypeLabel(item.type)}
        </Text>
        <Text style={styles.logTime}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {item.deviceInfo && (
        <Text style={styles.logDeviceInfo}>Perangkat: {item.deviceInfo}</Text>
      )}
      {item.status && (
        <Text style={styles.logStatus}>Status: {item.status}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Riwayat Aktivitas</Text>
        <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Hapus</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada riwayat aktivitas</Text>
        }
      />
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
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  list: {
    flex: 1,
    padding: 20,
  },
  logItem: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  logType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logTime: {
    fontSize: 14,
    color: '#94a3b8',
  },
  logDeviceInfo: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 3,
  },
  logStatus: {
    fontSize: 14,
    color: '#fbbf24',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});