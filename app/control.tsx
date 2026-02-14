import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useBLE } from '../hooks/useBLE';
import { loadAllSettings } from '@/utils/settingsManager';

export default function ControlScreen() {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const {
    state,
    sendRelayCH1Command,
    sendRelayCH2Command,
    sendBuzzerCommand,
    sendButtonPulseCommand,
    sendLEDCommand
  } = useBLE();

  // State for all controls
  const [kontakOn, setKontakOn] = useState(false);
  const [switchStandar, setSwitchStandar] = useState(false);
  const [buzzer, setBuzzer] = useState(false);
  const [statusBypass, setStatusBypass] = useState(false);

  // Load initial settings
  useEffect(() => {
    loadInitialSettings();
  }, []);

  const loadInitialSettings = async () => {
    try {
      const settings = await loadAllSettings();
      setKontakOn(settings.kontakOn || false);
      setSwitchStandar(settings.switchStandar || false);
      setBuzzer(settings.buzzer || false);
      setStatusBypass(settings.statusBypass || false);
    } catch (error) {
      console.error('Error loading initial settings:', error);
    }
  };

  // Update local state when connection status changes
  useEffect(() => {
    if (state.connectionStatus !== 'connected') {
      setKontakOn(false);
      setSwitchStandar(false);
      setBuzzer(false);
      setStatusBypass(false);
    }
  }, [state.connectionStatus]);

  const handleKontakToggle = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the ESP32 device first.');
      return;
    }

    const newValue = !kontakOn;
    const success = await sendRelayCH1Command(newValue);
    if (success) {
      setKontakOn(newValue);
    } else {
      Alert.alert('Error', 'Failed to send command to device.');
    }
  };

  const handleSwitchStandarToggle = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the ESP32 device first.');
      return;
    }

    const newValue = !switchStandar;
    const success = await sendRelayCH2Command(newValue);
    if (success) {
      setSwitchStandar(newValue);
    } else {
      Alert.alert('Error', 'Failed to send command to device.');
    }
  };

  const handleBuzzerToggle = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the ESP32 device first.');
      return;
    }

    const newValue = !buzzer;
    const success = await sendBuzzerCommand(newValue);
    if (success) {
      setBuzzer(newValue);
    } else {
      Alert.alert('Error', 'Failed to send command to device.');
    }
  };

  const handleButtonPulsePress = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the ESP32 device first.');
      return;
    }

    const success = await sendButtonPulseCommand();
    if (!success) {
      Alert.alert('Error', 'Failed to send command to device.');
    }
  };

  const handleStatusBypassToggle = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the ESP32 device first.');
      return;
    }

    const newValue = !statusBypass;
    const success = await sendLEDCommand(newValue);
    if (success) {
      setStatusBypass(newValue);
    } else {
      Alert.alert('Error', 'Failed to send command to device.');
    }
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Device Control</Text>
        </View>

        {/* Connection Status Indicator */}
        <View style={styles.connectionStatusCard}>
          <View style={styles.connectionStatusRow}>
            <Ionicons
              name={state.connectionStatus === 'connected' ? 'bluetooth' :
                    state.connectionStatus === 'connecting' ? 'bluetooth-sharp' :
                    'bluetooth-outline'}
              size={20}
              color={state.connectionStatus === 'connected' ? '#4ade80' :
                     state.connectionStatus === 'connecting' ? '#fbbf24' :
                     '#f87171'}
            />
            <Text style={styles.connectionStatusText}>
              Status:
              <Text style={[
                styles.connectionStatusValue,
                state.connectionStatus === 'connected' ? styles.connected :
                state.connectionStatus === 'connecting' ? styles.connecting :
                styles.disconnected
              ]}>
                {' '}{state.connectionStatus.charAt(0).toUpperCase() + state.connectionStatus.slice(1)}
              </Text>
            </Text>
          </View>

          {state.connectedDeviceId && (
            <Text style={styles.deviceName}>
              {state.scannedDevices.find(d => d.id === state.connectedDeviceId)?.name || 'Connected Device'}
            </Text>
          )}
        </View>

        {/* Manual Control Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Control</Text>

          {/* Kontak On - Relay CH1 */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Kontak On (Relay CH1)</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={kontakOn}
                onValueChange={handleKontakToggle}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={state.connectionStatus !== 'connected'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Switch Standar - Relay CH2 */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Switch Standar (Relay CH2)</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={switchStandar}
                onValueChange={handleSwitchStandarToggle}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={state.connectionStatus !== 'connected'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Buzzer */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Buzzer</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={buzzer}
                onValueChange={handleBuzzerToggle}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={state.connectionStatus !== 'connected'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Button Pulse */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Button Pulse</Text>
            <TouchableOpacity
              style={styles.pulseButton}
              onPress={handleButtonPulsePress}
              disabled={state.connectionStatus !== 'connected'}
            >
              <Text style={styles.pulseButtonText}>SEND PULSE</Text>
            </TouchableOpacity>
          </View>

          {/* Status Bypass - LED */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Status Bypass (LED)</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>INACTIVE</Text>
              <Switch
                value={statusBypass}
                onValueChange={handleStatusBypassToggle}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={state.connectionStatus !== 'connected'}
              />
              <Text style={styles.toggleText}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Command Mapping Reference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Command Mapping</Text>
          <View style={styles.mappingContainer}>
            <Text style={styles.mappingText}>0x01 = Relay CH1 ON</Text>
            <Text style={styles.mappingText}>0x10 = Relay CH1 OFF</Text>
            <Text style={styles.mappingText}>0x02 = Relay CH2 ON</Text>
            <Text style={styles.mappingText}>0x20 = Relay CH2 OFF</Text>
            <Text style={styles.mappingText}>0xB1 = Buzzer ON</Text>
            <Text style={styles.mappingText}>0xB0 = Buzzer OFF</Text>
            <Text style={styles.mappingText}>0xC1 = Button Pulse</Text>
            <Text style={styles.mappingText}>0xE1 = LED ON</Text>
            <Text style={styles.mappingText}>0xE0 = LED OFF</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: 'light' | 'dark' | 'oled') => {
  const isDark = theme === 'dark' || theme === 'oled';
  const isOled = theme === 'oled';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? (isOled ? '#000000' : '#0f172a') : '#f1f5f9',
    },
    scrollContainer: {
      padding: 16,
      paddingBottom: 60,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#e2e8f0' : '#1e293b',
    },
    connectionStatusCard: {
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    connectionStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    connectionStatusText: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    connectionStatusValue: {
      fontWeight: 'bold',
    },
    connected: {
      color: '#4ade80',
    },
    connecting: {
      color: '#fbbf24',
    },
    disconnected: {
      color: '#f87171',
    },
    deviceName: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      paddingLeft: 28,
    },
    section: {
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    controlItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#e2e8f0',
    },
    controlLabel: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleText: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#64748b',
    },
    pulseButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    pulseButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    mappingContainer: {
      gap: 4,
    },
    mappingText: {
      fontSize: 14,
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontFamily: 'monospace',
    },
  });
};