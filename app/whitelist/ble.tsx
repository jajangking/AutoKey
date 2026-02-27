import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useBLE } from '../../hooks/useBLE';
import { Ionicons } from '@expo/vector-icons';

export default function BleWhitelistScreen() {
  const {
    getESP32WhitelistCount,
    readESP32Whitelist,
    clearESP32Whitelist,
    disconnectFromDevice,
    state,
    addLog,
    whitelistEntries,
    whitelistCount
  } = useBLE();

  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  // Disconnect BEFORE navigating away to prevent native crash
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Cleanup: disconnect before unmount to prevent BLE library crash
        if (state.connectionStatus === 'connected') {
          addLog('Disconnecting before navigate (prevent crash)');
          try {
            disconnectFromDevice();
          } catch (err) {
            // Ignore errors during cleanup
          }
        }
      };
    }, [state.connectionStatus])
  );

  const handleGetWhitelistCount = async () => {
    addLog('handleGetWhitelistCount called');
    addLog(`Connection status: ${state.connectionStatus}`);

    if (state.connectionStatus !== 'connected') {
      addLog('ERROR: Not connected to ESP32');
      Alert.alert(
        'Tidak Terhubung',
        'Hubungkan ke ESP32 terlebih dahulu untuk melihat whitelist.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if authorized (auth should complete within ~1 second of connect)
    // For now, proceed anyway but log warning
    addLog('Note: Sending count request (0xF3)');

    setIsLoading(true);
    try {
      addLog('Sending 0xF3 command to get whitelist count...');
      await getESP32WhitelistCount();
      
      addLog('Whitelist count request sent - waiting for response');
    } catch (error) {
      const errorMsg = (error as Error).message;
      addLog(`ERROR: ${errorMsg}`);
      Alert.alert('Error', `Gagal mendapatkan whitelist count: ${errorMsg}`, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadWhitelist = async () => {
    addLog('handleReadWhitelist called');
    addLog(`Connection status: ${state.connectionStatus}`);

    if (state.connectionStatus !== 'connected') {
      addLog('ERROR: Not connected to ESP32');
      Alert.alert(
        'Tidak Terhubung',
        'Hubungkan ke ESP32 terlebih dahulu.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      addLog('Sending 0xF4 command to read whitelist...');
      await readESP32Whitelist();
      addLog('Whitelist read request sent - check console for entries');
      Alert.alert(
        'Reading...',
        'Membaca whitelist dari ESP32. Cek log untuk hasil.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const errorMsg = (error as Error).message;
      addLog(`ERROR: ${errorMsg}`);
      Alert.alert('Error', `Gagal membaca whitelist: ${errorMsg}`, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  };

  const handleClearWhitelist = async () => {
    addLog('handleClearWhitelist called');
    addLog(`Connection status: ${state.connectionStatus}`);

    if (state.connectionStatus !== 'connected') {
      addLog('ERROR: Not connected to ESP32');
      Alert.alert('Tidak Terhubung', 'Hubungkan ke ESP32 terlebih dahulu.', [{ text: 'OK' }]);
      return;
    }

    Alert.alert(
      'Hapus Whitelist ESP32',
      `Hapus semua ${whitelistCount} token dari whitelist ESP32? ESP32 akan kembali ke mode OWNER.`,
      [
        { text: 'Batal', style: 'cancel', onPress: () => addLog('Clear whitelist cancelled') },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            addLog('User confirmed clear whitelist');
            setIsLoading(true);

            try {
              addLog('Sending 0xF2 command to clear whitelist...');
              const success = await clearESP32Whitelist();

              if (success) {
                addLog('SUCCESS: ESP32 whitelist cleared');
                setLastUpdated(new Date());
                Alert.alert(
                  'Berhasil', 
                  'Whitelist ESP32 telah dihapus.\nESP32 sekarang dalam mode OWNER.', 
                  [{ text: 'OK' }]
                );
                addLog('ESP32 whitelist cleared - now in OWNER mode');
              } else {
                addLog('ERROR: Failed to clear ESP32 whitelist');
                Alert.alert('Gagal', 'Gagal menghapus whitelist ESP32.', [{ text: 'OK' }]);
              }
            } catch (error) {
              const errorMsg = (error as Error).message;
              addLog(`ERROR: Exception during clear - ${errorMsg}`);
              Alert.alert('Error', `Terjadi kesalahan: ${errorMsg}`, [{ text: 'OK' }]);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Whitelist ESP32</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* ESP32 Status Section */}
        <View style={styles.statusSection}>
        <View style={styles.connectionStatus}>
          <Ionicons
            name={state.connectionStatus === 'connected' ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={state.connectionStatus === 'connected' ? '#4ade80' : '#f87171'}
          />
          <Text style={styles.connectionStatusText}>
            {state.connectionStatus === 'connected' ? 'Terhubung ke ESP32' : 'Tidak Terhubung'}
          </Text>
        </View>

        <View style={styles.countDisplay}>
          <Ionicons name="list" size={24} color="#3b82f6" />
          <Text style={styles.countLabel}>Whitelist Count:</Text>
          <Text style={styles.countValue}>{whitelistCount}</Text>
        </View>

        {lastUpdated && (
          <View style={styles.lastUpdated}>
            <Ionicons name="time-outline" size={16} color="#94a3b8" />
            <Text style={styles.lastUpdatedText}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#fbbf24" />
          <Text style={styles.infoText}>
            {whitelistCount === 0 
              ? 'Mode: OWNER (device pertama yang connect jadi owner)'
              : `Mode: WHITELIST (${whitelistCount} token terdaftar)`}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleReadWhitelist}
          disabled={isLoading || state.connectionStatus !== 'connected'}
        >
          <Ionicons
            name={isLoading ? 'hourglass' : 'refresh'}
            size={20}
            color="#fff"
          />
          <Text style={styles.buttonText}>
            {isLoading ? 'Loading...' : 'Read Whitelist'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton, isLoading && styles.buttonDisabled]}
          onPress={handleClearWhitelist}
          disabled={isLoading || state.connectionStatus !== 'connected'}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.buttonText}>Clear Whitelist</Text>
        </TouchableOpacity>
      </View>

      {/* Whitelist Entries List */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Ionicons name="shield-checkmark" size={20} color="#4ade80" />
          <Text style={styles.listTitle}>Registered Tokens</Text>
        </View>

        {whitelistEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>
              {whitelistCount === 0
                ? 'Whitelist kosong - mode OWNER aktif'
                : 'Tekan "Read Whitelist" untuk memuat token'}
            </Text>
          </View>
        ) : (
          <View style={styles.tokenList}>
            {whitelistEntries.map((token, index) => (
              <View key={`token-${index}`} style={styles.tokenItem}>
                <View style={styles.tokenIndex}>
                  <Text style={styles.indexText}>#{index + 1}</Text>
                </View>
                <View style={styles.tokenContent}>
                  <Text style={styles.tokenLabel}>Token:</Text>
                  <Text style={styles.tokenValue} selectable>{token}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>Cara Kerja:</Text>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark" size={16} color="#4ade80" />
          <Text style={styles.instructionText}>
            Device pertama yang connect saat whitelist kosong otomatis jadi OWNER
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark" size={16} color="#4ade80" />
          <Text style={styles.instructionText}>
            Token auth disimpan di AsyncStorage device
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark" size={16} color="#4ade80" />
          <Text style={styles.instructionText}>
            Clear whitelist = ESP32 kembali ke mode OWNER
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="warning" size={16} color="#fbbf24" />
          <Text style={styles.instructionWarning}>
            Device tanpa token di whitelist akan ditolak (DENIED)
          </Text>
        </View>
      </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statusSection: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  connectionStatusText: {
    color: '#e2e8f0',
    fontSize: 14,
    marginLeft: 8,
  },
  countDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  countLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  countValue: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: 'bold',
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  lastUpdatedText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a03',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoText: {
    color: '#fbbf24',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  buttonSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    backgroundColor: '#64748b',
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listSection: {
    flex: 1,
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  listTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  tokenList: {
    padding: 10,
  },
  tokenItem: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenIndex: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    justifyContent: 'center',
  },
  indexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tokenContent: {
    flex: 1,
  },
  tokenLabel: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
  },
  tokenValue: {
    color: '#4ade80',
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  instructionsSection: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  instructionsTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  instructionWarning: {
    color: '#fbbf24',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
