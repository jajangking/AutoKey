import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList,
  Animated,
  RefreshControl,
  useColorScheme,
  BackHandler,
  Platform,
  Clipboard,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBLE } from '@/hooks/useBLE';
import { Ionicons, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { Device } from 'react-native-ble-plx';
import ErrorDisplay from '@/components/ErrorDisplay';
import BluetoothDeviceItem from '@/components/BluetoothDeviceItem';
import { router, useFocusEffect } from 'expo-router';
import SettingsModal from '@/components/SettingsModal';

// BLE UUIDs
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CONTROL_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// Function to determine signal strength color
const getSignalColor = (rssi: number | undefined) => {
  if (rssi === undefined) return '#94a3b8'; // Gray if no RSSI
  if (rssi >= -50) return '#4ade80'; // Strong signal - green
  if (rssi >= -70) return '#fbbf24'; // Medium signal - yellow
  return '#f87171'; // Weak signal - red
};

// Component for LED indicator with modern design
const LEDIndicator = ({ active, label, icon, theme }: { active: boolean; label: string; icon: string; theme: 'light' | 'dark' | 'oled' }) => {
  const styles = getStyles(theme);
  
  return (
    <View style={styles.ledContainer}>
      <View style={[styles.led, active ? styles.ledActive : styles.ledInactive]}>
        <Ionicons 
          name={icon as any} 
          size={16} 
          color={active ? '#10b981' : (theme === 'light' ? '#64748b' : '#9ca3af')} 
        />
      </View>
      <Text style={styles.ledLabel}>{label}</Text>
    </View>
  );
};


// Component for the main screen with modern design
export default function Index() {
  const {
    state,
    startScan,
    stopScan,
    disconnectFromDevice,
    connectToDevice,
    saveSelectedDevice,
    loadSelectedDevice,
    clearSelectedDevice,
    addLog,
    toggleAutoConnect,
    resetScannedDevices,
    sendRelayCH1Command,
    sendRelayCH2Command,
    sendBuzzerCommand,
    sendLEDCommand,
    readESP32Whitelist,
    clearESP32Whitelist,
    whitelistEntries,
    whitelistCount,
    generateToken,
    bleManagerRef
  } = useBLE();
  
  const { theme, toggleTheme } = useTheme();
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleDeviceSelect = (device: Device) => {
    connectToDevice(device);
    // Save the selected device to storage
    saveSelectedDevice(device);
  };

  // Whitelist handlers
  const handleReadWhitelist = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Tidak Terhubung', 'Hubungkan ke ESP32 terlebih dahulu.', [{ text: 'OK' }]);
      return;
    }
    setWhitelistLoading(true);
    try {
      await readESP32Whitelist();
      addLog('Whitelist read completed');
    } catch (error) {
      addLog(`Read whitelist error: ${(error as Error).message}`);
      Alert.alert('Error', `Failed to read whitelist: ${(error as Error).message}`, [{ text: 'OK' }]);
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleClearWhitelist = () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Tidak Terhubung', 'Hubungkan ke ESP32 terlebih dahulu.', [{ text: 'OK' }]);
      return;
    }
    Alert.alert(
      'Hapus Whitelist',
      `Hapus ${whitelistCount} token dari ESP32?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setWhitelistLoading(true);
            await clearESP32Whitelist();
            setWhitelistLoading(false);
          }
        }
      ]
    );
  };

  // Generate new token for sharing
  const handleGenerateToken = () => {
    const newToken = generateToken();
    setGeneratedToken(newToken);
    setShowInviteModal(true);
  };

  // Copy token to clipboard
  const handleCopyToken = async () => {
    try {
      await Clipboard.setString(generatedToken);
      Alert.alert('Copied!', 'Token copied to clipboard', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy token', [{ text: 'OK' }]);
    }
  };

  // Add token manually
  const handleAddToken = async () => {
    if (state.connectionStatus !== 'connected') {
      Alert.alert('Tidak Terhubung', 'Hubungkan ke ESP32 terlebih dahulu.', [{ text: 'OK' }]);
      return;
    }

    const token = manualTokenInput.trim().toUpperCase();
    
    // Validate token format (32 char hex)
    if (!/^[0-9A-F]{32}$/.test(token)) {
      Alert.alert('Invalid Token', 'Token must be 32 hexadecimal characters', [{ text: 'OK' }]);
      return;
    }

    try {
      setWhitelistLoading(true);
      addLog(`Adding token to whitelist: ${token.substring(0, 8)}...`);
      
      // Use readESP32Whitelist which will trigger ESP32 to send entries
      // For adding, we need to send command directly
      const addTokenCommand = async () => {
        const tokenBytes = [0xFE];
        for (let i = 0; i < token.length; i++) {
          tokenBytes.push(token.charCodeAt(i));
        }
        
        const tokenBuffer = new Uint8Array(tokenBytes);
        const tokenData = btoa(String.fromCharCode(...tokenBuffer));
        
        // Get connected device from state
        const device = state.scannedDevices.find(d => d.id === state.connectedDeviceId);
        if (!device) {
          throw new Error('No connected device found');
        }
        
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          CONTROL_CHARACTERISTIC_UUID,
          tokenData
        );
      };
      
      await addTokenCommand();
      
      addLog(`Added token to whitelist: ${token.substring(0, 8)}...`);
      setManualTokenInput('');
      Alert.alert('Success!', 'Token added to whitelist', [{ text: 'OK' }]);
      
      // Refresh whitelist after short delay
      setTimeout(async () => {
        await readESP32Whitelist();
      }, 500);
    } catch (error) {
      Alert.alert('Error', `Failed to add token: ${(error as Error).message}`, [{ text: 'OK' }]);
    } finally {
      setWhitelistLoading(false);
    }
  };

  // State for auth status
  const [authStatus, setAuthStatus] = useState<'none' | 'pending' | 'authorized' | 'denied'>('none');
  
  // State for whitelist section
  const [showWhitelistSection, setShowWhitelistSection] = useState(false);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  
  // State for invite token generation
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [manualTokenInput, setManualTokenInput] = useState<string>('');

  // Handle auth status changes when connected
  useEffect(() => {
    if (state.connectionStatus === 'connected') {
      // Auth is automatically attempted after connection
      setAuthStatus('pending');
      addLog('Waiting for authentication response...');
      
      // Set timeout for auth response (2 seconds)
      const timeoutId = setTimeout(() => {
        // Assume authorized if still connected
        setAuthStatus('authorized');
        addLog('Auth status: Authorized (assumed)');
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    } else {
      setAuthStatus('none');
    }
  }, [state.connectionStatus]);

  // State for debug visibility toggle
  const [showDebug, setShowDebug] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showErrorDisplay, setShowErrorDisplay] = useState(false);

  // State for real-time signal debug timestamp
  const [realTimeSignalTimestamp, setRealTimeSignalTimestamp] = useState(new Date());

  // State for settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Update real-time signal timestamp every second when connected
  useEffect(() => {
    let intervalId: number | NodeJS.Timeout | null = null;

    if (state.connectionStatus === 'connected' && state.connectedDeviceId) {
      intervalId = setInterval(() => {
        setRealTimeSignalTimestamp(new Date());
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state.connectionStatus, state.connectedDeviceId]);

  // Animation for initial load
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Back button handler - show exit confirmation on Android
  // Only active when this screen is focused (not on whitelist pages)
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const backAction = () => {
          Alert.alert(
            'Keluar Aplikasi',
            'Apakah Anda yakin ingin keluar dari AutoKey?',
            [
              {
                text: 'Batal',
                style: 'cancel',
              },
              {
                text: 'Keluar',
                onPress: async () => {
                  // Disconnect from device before exiting (don't wait for completion)
                  if (state.connectionStatus === 'connected') {
                    try {
                      // Just stop scanning and disconnect without waiting
                      stopScan();
                      // Quick disconnect - don't wait for promise
                      disconnectFromDevice();
                    } catch (err) {
                      // Ignore errors during exit
                    }
                  }
                  // Wait a bit for disconnect to process, then exit
                  setTimeout(() => {
                    BackHandler.exitApp();
                  }, 100);
                },
              },
            ],
            { cancelable: true }
          );
          return true; // Prevent default back behavior
        };

        const backHandler = BackHandler.addEventListener(
          'hardwareBackPress',
          backAction
        );

        return () => backHandler.remove();
      }
    }, [state.connectionStatus])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh action
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Note: Scanning stops automatically when connecting to a device

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps='handled'
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="key-wireless"
              size={48}
              color="#3b82f6"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>AutoKey</Text>
            <Text style={styles.subtitle}>Keyless Motor System</Text>
          </View>

          {/* System Status Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hardware-chip-outline" size={24} color="#3b82f6" />
              <Text style={styles.sectionTitle}>System Status</Text>
            </View>
            
            <View style={styles.ledRow}>
              <LEDIndicator active={state.ledStatus.btConnected} label="BT Connected" icon="bluetooth" theme={theme} />
              <LEDIndicator active={state.ledStatus.ready} label="Ready" icon="checkmark-circle" theme={theme} />
              <LEDIndicator active={state.ledStatus.wifi} label="WiFi" icon="wifi" theme={theme} />
            </View>
            
            {/* System Check Button */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.systemCheckButton}
                onPress={() => {
                  // Perform system check by scanning for saved device
                  if (state.savedDevice) {
                    // Start scan to detect if saved device is active
                    // Only start scan if not already connected to the saved device
                    if (state.connectionStatus !== 'connected' ||
                        (state.connectionStatus === 'connected' && state.connectedDeviceId !== state.savedDevice.id)) {
                      startScan();
                    }
                    addLog('System check initiated: scanning for saved device');
                  } else {
                    Alert.alert('No Saved Device', 'Please save a device first before performing system check.');
                  }
                }}
              >
                <Ionicons name="sync-circle" size={20} color="#ffffff" />
                <Text style={styles.buttonText}> System Check</Text>
              </TouchableOpacity>
            </View>
            
            {/* Debug Logs for System Status */}
            {showDebug && (
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>Debug:</Text>
                <Text style={styles.debugText}>BT Connected: {state.ledStatus.btConnected ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Ready: {state.ledStatus.ready ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>WiFi: {state.ledStatus.wifi ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Saved Device Active: {(state.savedDevice && ((state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId) || (state.scannedDevices.some(d => d.id === state.savedDevice?.id)))) ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Saved Device ID: {state.savedDevice?.id || 'None'}</Text>
                <Text style={styles.debugText}>Connected Device ID: {state.connectedDeviceId || 'None'}</Text>
              </View>
            )}
          </View>

        {/* Connection Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bluetooth" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Connection Status</Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Ionicons
                name={state.connectionStatus === 'connected' ? 'bluetooth' :
                      state.connectionStatus === 'connecting' ? 'bluetooth-sharp' :
                      'bluetooth-outline'}
                size={20}
                color={state.connectionStatus === 'connected' ? '#4ade80' :
                       state.connectionStatus === 'connecting' ? '#fbbf24' :
                       '#f87171'}
              />
              <Text style={styles.statusText}>
                Status:
                <Text style={[
                  styles.statusValue,
                  state.connectionStatus === 'connected' ? styles.connected :
                  state.connectionStatus === 'connecting' ? styles.connecting :
                  styles.disconnected
                ]}>
                  {' '}{state.connectionStatus.charAt(0).toUpperCase() + state.connectionStatus.slice(1)}
                </Text>
              </Text>
            </View>

            {/* Auth Status Indicator */}
            {state.connectionStatus === 'connected' && (
              <View style={styles.statusRow}>
                <Ionicons
                  name={authStatus === 'authorized' ? 'shield-checkmark' :
                        authStatus === 'denied' ? 'shield-outline' :
                        'hourglass-outline'}
                  size={20}
                  color={authStatus === 'authorized' ? '#4ade80' :
                         authStatus === 'denied' ? '#ef4444' :
                         '#fbbf24'}
                />
                <Text style={styles.statusText}>
                  Auth:
                  <Text style={[
                    styles.statusValue,
                    authStatus === 'authorized' ? styles.connected :
                    authStatus === 'denied' ? styles.disconnected :
                    styles.connecting
                  ]}>
                    {' '}{authStatus === 'authorized' ? 'Authorized' :
                          authStatus === 'denied' ? 'Denied' :
                          'Pending...'}
                  </Text>
                </Text>
              </View>
            )}

            {state.connectedDeviceId && (
              <>
                {(() => {
                  // Find the connected device in the scanned devices array to get its details
                  let connectedDevice = state.scannedDevices.find(d => d.id === state.connectedDeviceId);

                  // If not found in scanned devices, try to get from saved device info
                  if (!connectedDevice && state.savedDevice && state.connectedDeviceId === state.savedDevice.id) {
                    connectedDevice = {
                      id: state.savedDevice.id,
                      name: state.savedDevice.name,
                      rssi: state.savedDevice.rssi,
                      mtu: state.savedDevice.mtu
                    } as any; // Type assertion to match Device interface
                  }

                  return connectedDevice ? (
                    <>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="devices" size={16} color="#94a3b8" />
                        <Text style={styles.deviceName}>
                          {connectedDevice.name || 'Unknown Device'}
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="identifier" size={16} color="#94a3b8" />
                        <Text style={styles.deviceAddress}>
                          {connectedDevice.id}
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="signal" size={16} color="#94a3b8" />
                        <Text style={styles.connectedDeviceRssi}>
                          {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ? `${connectedDevice.rssi} dBm` : 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="network" size={16} color="#94a3b8" />
                        <Text style={styles.deviceMtu}>
                          {connectedDevice.mtu ? `${connectedDevice.mtu}` : 'N/A'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="devices" size={16} color="#94a3b8" />
                        <Text style={styles.deviceName}>
                          Unknown Device
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="identifier" size={16} color="#94a3b8" />
                        <Text style={styles.deviceAddress}>
                          {state.connectedDeviceId}
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="signal-off" size={16} color="#94a3b8" />
                        <Text style={styles.connectedDeviceRssi}>
                          N/A
                        </Text>
                      </View>
                      <View style={styles.deviceDetailRow}>
                        <MaterialCommunityIcons name="network-off" size={16} color="#94a3b8" />
                        <Text style={styles.deviceMtu}>
                          N/A
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </>
            )}
          </View>
          
          {/* Real-time Signal Strength Display */}
          {state.connectionStatus === 'connected' && state.connectedDeviceId && (
            <View style={styles.signalStrengthContainer}>
              {(() => {
                // Find the connected device in the scanned devices array to get its details
                // Prioritize the connected device from state.savedDevice if available
                let connectedDevice = state.scannedDevices.find(d => d.id === state.connectedDeviceId);

                // If not found in scanned devices, try to get from saved device info
                if (!connectedDevice && state.savedDevice && state.connectedDeviceId === state.savedDevice.id) {
                  connectedDevice = {
                    id: state.savedDevice.id,
                    name: state.savedDevice.name,
                    rssi: state.savedDevice.rssi,
                    mtu: state.savedDevice.mtu
                  } as any; // Type assertion to match Device interface
                }

                return connectedDevice ? (
                  <>
                    <Text style={styles.signalStrengthTitle}>Signal Strength:</Text>
                    <View style={styles.signalStrengthBar}>
                      <View
                        style={[
                          styles.signalStrengthFill,
                          {
                            width: `${Math.min(100, Math.max(0, ((connectedDevice.rssi || -100) + 100)))}%`,
                            backgroundColor: getSignalColor(connectedDevice.rssi || -100)
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.signalStrengthValue}>
                      {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ? `${connectedDevice.rssi} dBm` : 'N/A'}
                    </Text>

                    {/* Real-time Signal Debug Information */}
                    {showDebug && (
                      <View style={styles.realTimeSignalDebug}>
                        <Text style={styles.realTimeSignalDebugTitle}>Real-time Signal Debug:</Text>
                        <Text style={styles.realTimeSignalDebugText}>Last Updated: {realTimeSignalTimestamp.toLocaleTimeString()}</Text>
                        <Text style={styles.realTimeSignalDebugText}>Current RSSI: {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ? `${connectedDevice.rssi} dBm` : 'N/A'}</Text>
                        <Text style={styles.realTimeSignalDebugText}>Signal Level: {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ?
                          (connectedDevice.rssi >= -50 ? 'Excellent' :
                           connectedDevice.rssi >= -60 ? 'Good' :
                           connectedDevice.rssi >= -70 ? 'Fair' :
                           'Poor') : 'N/A'}</Text>
                        <Text style={styles.realTimeSignalDebugText}>Distance Estimation: {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ?
                          (connectedDevice.rssi >= -50 ? 'Very Close' :
                           connectedDevice.rssi >= -60 ? 'Close' :
                           connectedDevice.rssi >= -70 ? 'Medium' :
                           'Far') : 'N/A'}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  // Show a placeholder when device is connected but RSSI info is not available
                  <>
                    <Text style={styles.signalStrengthTitle}>Signal Strength:</Text>
                    <View style={styles.signalStrengthBar}>
                      <View
                        style={[
                          styles.signalStrengthFill,
                          {
                            width: '0%',
                            backgroundColor: getSignalColor(undefined)
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.signalStrengthValue}>N/A</Text>
                  </>
                );
              })()}
            </View>
          )}
          
          {/* Debug Logs for Connection Status */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>Connection Status: {state.connectionStatus}</Text>
              <Text style={styles.debugText}>Connected Device ID: {state.connectedDeviceId || 'None'}</Text>
              {(() => {
                // Find the connected device in the scanned devices array to get its details
                let connectedDevice = state.scannedDevices.find(d => d.id === state.connectedDeviceId);

                // If not found in scanned devices, try to get from saved device info
                if (!connectedDevice && state.savedDevice && state.connectedDeviceId === state.savedDevice.id) {
                  connectedDevice = {
                    id: state.savedDevice.id,
                    name: state.savedDevice.name,
                    rssi: state.savedDevice.rssi,
                    mtu: state.savedDevice.mtu
                  } as any; // Type assertion to match Device interface
                }

                return (
                  <>
                    <Text style={styles.debugText}>Connected Device Name: {connectedDevice?.name || 'None'}</Text>
                    <Text style={styles.debugText}>Connected Device RSSI: {connectedDevice?.rssi !== undefined && connectedDevice?.rssi !== null ? `${connectedDevice.rssi} dBm` : 'N/A'}</Text>
                    <Text style={styles.debugText}>Signal Strength Level: {connectedDevice?.rssi !== undefined && connectedDevice?.rssi !== null ?
                      (connectedDevice.rssi >= -50 ? 'Excellent' :
                       connectedDevice.rssi >= -60 ? 'Good' :
                       connectedDevice.rssi >= -70 ? 'Fair' :
                       'Poor') : 'N/A'}</Text>
                    <Text style={styles.debugText}>Signal Quality: {connectedDevice?.rssi !== undefined && connectedDevice?.rssi !== null ?
                      (() => {
                        const rssi = connectedDevice.rssi;
                        if (rssi >= -50) return 'Strong (>= -50 dBm)';
                        if (rssi >= -60) return 'Good (-50 to -60 dBm)';
                        if (rssi >= -70) return 'Fair (-60 to -70 dBm)';
                        return 'Weak (< -70 dBm)';
                      })() : 'N/A'}</Text>
                  </>
                );
              })()}
            </View>
          )}
        </View>

        {/* Saved Device Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bookmark" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Saved Device</Text>
          </View>
          
          <View style={styles.savedDeviceContainer}>
            {(() => {
              const savedDevice = state.savedDevice;
              if (savedDevice) {
                return (
                  <View style={styles.savedDeviceInfo}>
                    <View style={styles.savedDeviceDetailRow}>
                      <MaterialCommunityIcons name="devices" size={16} color="#94a3b8" />
                      <Text style={styles.savedDeviceName}>{savedDevice.name || 'Unknown Device'}</Text>
                    </View>
                    <View style={styles.savedDeviceDetailRow}>
                      <MaterialCommunityIcons name="identifier" size={16} color="#94a3b8" />
                      <Text style={styles.savedDeviceId}>{savedDevice.id}</Text>
                    </View>
                    <View style={styles.savedDeviceDetailRow}>
                      <MaterialCommunityIcons name="signal" size={16} color="#94a3b8" />
                      <Text style={styles.savedDeviceRssi}>{savedDevice.rssi || 'N/A'} dBm</Text>
                    </View>
                    
                    <View style={styles.savedDeviceActions}>
                      <TouchableOpacity
                        style={styles.connectButton}
                        onPress={() => {
                          // Find the device in scanned devices
                          const device = state.scannedDevices.find(d => d.id === savedDevice.id);
                          if (device) {
                            connectToDevice(device);
                          } else {
                            // If device is not in scanned devices, start scanning to find it
                            addLog('Saved device not found in scan list, starting scan to locate device');
                            startScan();
                          }
                        }}
                      >
                        <Ionicons name="bluetooth" size={16} color="#ffffff" />
                        <Text style={styles.buttonText}> Connect</Text>
                      </TouchableOpacity>

                      {state.connectionStatus === 'connected' && state.savedDevice && state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId && (
                        <TouchableOpacity
                          style={styles.dangerButton}
                          onPress={disconnectFromDevice}
                        >
                          <Ionicons name="close-circle" size={16} color="#ffffff" />
                          <Text style={styles.buttonText}> Disconnect</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.warningButton}
                        onPress={clearSelectedDevice}
                      >
                        <Ionicons name="trash" size={16} color="#ffffff" />
                        <Text style={styles.buttonText}> Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              } else {
                return (
                  <View style={styles.noSavedDeviceContainer}>
                    <Ionicons name="bookmark-outline" size={48} color="#64748b" />
                    <Text style={styles.noSavedDeviceText}>No device saved yet</Text>
                    <Text style={styles.smallText}>Select a device from the list below to save it</Text>
                  </View>
                );
              }
            })()}
          </View>
          
          {/* Debug Logs for Saved Device */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>Saved Device Exists: {state.savedDevice ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Saved Device Name: {state.savedDevice?.name || 'None'}</Text>
              <Text style={styles.debugText}>Saved Device ID: {state.savedDevice?.id || 'None'}</Text>
              <Text style={styles.debugText}>Saved Device RSSI: {state.savedDevice?.rssi ? `${state.savedDevice.rssi} dBm` : 'None'}</Text>
              <Text style={styles.debugText}>Saved Device Matches Connected: {(state.savedDevice && state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId) ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Saved Device in Scan List: {(state.savedDevice && state.scannedDevices.some(d => d.id === state.savedDevice?.id)) ? 'Yes' : 'No'}</Text>
            </View>
          )}
        </View>

        {/* Connection Controls Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Connection Controls</Text>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                state.connectionStatus === 'connecting' && styles.disabledButton
              ]}
              onPress={startScan}
              disabled={state.connectionStatus === 'connecting'}
            >
              <Ionicons name="bluetooth" size={20} color="#ffffff" />
              <Text style={styles.buttonText}>
                {state.isScanning ? ' Scanning...' : ' Scan Bluetooth'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scan Controls */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={stopScan}
              disabled={!state.isScanning}
            >
              <Ionicons name="stop-circle" size={20} color="#ffffff" />
              <Text style={styles.buttonText}> Stop Scan</Text>
            </TouchableOpacity>

            {/* System Check Controls */}
            <TouchableOpacity
              style={styles.systemCheckButton}
              onPress={() => {
                // Trigger a system check by scanning for saved device
                if (state.savedDevice) {
                  // Start scan to detect if saved device is active
                  // Only start scan if not already connected to the saved device
                  if (state.connectionStatus !== 'connected' ||
                      (state.connectionStatus === 'connected' && state.connectedDeviceId !== state.savedDevice.id)) {
                    startScan();
                  }
                  addLog('System check initiated: scanning for saved device');
                } else {
                  Alert.alert('No Saved Device', 'Please save a device first before performing system check.');
                }
              }}
            >
              <Ionicons name="sync-circle" size={20} color="#ffffff" />
              <Text style={styles.buttonText}> System Check</Text>
            </TouchableOpacity>
          </View>

          {/* Auto-Connect Controls */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                state.autoConnectEnabled && styles.activeButton // Highlight when enabled
              ]}
              onPress={toggleAutoConnect}
            >
              <Ionicons 
                name={state.autoConnectEnabled ? "link" : "unlink"} 
                size={20} 
                color="#ffffff" 
              />
              <Text style={styles.buttonText}>
                Auto-Connect: {state.autoConnectEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Theme Toggle and Debug Visibility Toggle */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => toggleTheme()}
            >
              <Ionicons 
                name={theme === 'light' ? "moon" : theme === 'dark' ? "phone-portrait" : "contrast"} 
                size={20} 
                color="#ffffff" 
              />
              <Text style={styles.buttonText}>
                Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                showDebug && styles.activeButton // Highlight when enabled
              ]}
              onPress={() => setShowDebug(!showDebug)}
            >
              <Ionicons
                name={showDebug ? "eye" : "eye-off"}
                size={20}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>
                Show Debug: {showDebug ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowErrorDisplay(true)}
            >
              <Ionicons 
                name="alert-circle" 
                size={20} 
                color="#ffffff" 
              />
              <Text style={styles.buttonText}>
                Show Errors
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reset Bluetooth Devices List */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={async () => {
                // Reset the scanned devices list using the hook function
                resetScannedDevices();
                
                // Also stop any ongoing scans before starting a fresh scan
                if (state.isScanning) {
                  stopScan();
                  addLog('Stopped ongoing scan');
                }
                
                // Add log entry
                addLog('Bluetooth device list reset, ready for fresh scan');
                
                // Optionally start a new scan automatically after reset
                setTimeout(() => {
                  startScan();
                  addLog('Started fresh scan after reset');
                }, 1000);
              }}
            >
              <Ionicons name="reload" size={20} color="#ffffff" />
              <Text style={styles.buttonText}> Reset Bluetooth List</Text>
            </TouchableOpacity>
          </View>

          {/* Debug Logs for Connection Controls */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>Is Scanning: {state.isScanning ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Connection Status: {state.connectionStatus}</Text>
              <Text style={styles.debugText}>Bluetooth State: {state.bluetoothState || 'Unknown'}</Text>
              <Text style={styles.debugText}>Auto-Connect Enabled: {state.autoConnectEnabled ? 'Yes' : 'No'}</Text>
            </View>
          )}
        </View>

        {/* Available Bluetooth Devices Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bluetooth" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Available Bluetooth Devices</Text>
          </View>
          
          <View style={styles.devicesContainerScrollable}>
            {state.scannedDevices.length > 0 ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true} // Enable nested scrolling
                style={{ maxHeight: 300 }} // Set max height for the scroll view
              >
                {state.scannedDevices.map((device, index) => (
                  <BluetoothDeviceItem
                    key={device.id}
                    device={device}
                    onSelect={handleDeviceSelect}
                    onSaveDevice={saveSelectedDevice}
                    theme={theme}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyDevicesContainer}>
                <MaterialCommunityIcons 
                  name={state.isScanning ? "bluetooth" : "bluetooth-off"} 
                  size={48} 
                  color="#64748b" 
                />
                <Text style={styles.emptyDevicesText}>
                  {state.isScanning
                    ? 'Scanning for devices...'
                    : 'No devices found. Press "Scan Bluetooth" to search.'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Debug Logs for Available Bluetooth Devices */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>Number of Devices Found: {state.scannedDevices.length}</Text>
              <Text style={styles.debugText}>Is Scanning: {state.isScanning ? 'Yes' : 'No'}</Text>
            </View>
          )}
        </View>

        {/* Device Status - Removed contact control button */}
        {state.connectionStatus === 'connected' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Device Status</Text>
            </View>
            
            {/* Debug Logs for Device Status */}
            {showDebug && (
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>Debug:</Text>
                <Text style={styles.debugText}>Contact Status: {state.contactStatus ? 'ON' : 'OFF'}</Text>
                {(() => {
                  // Find the connected device in the scanned devices array to get its details
                  let connectedDevice = state.scannedDevices.find(d => d.id === state.connectedDeviceId);

                  // If not found in scanned devices, try to get from saved device info
                  if (!connectedDevice && state.savedDevice && state.connectedDeviceId === state.savedDevice.id) {
                    connectedDevice = {
                      id: state.savedDevice.id,
                      name: state.savedDevice.name,
                      rssi: state.savedDevice.rssi,
                      mtu: state.savedDevice.mtu
                    } as any; // Type assertion to match Device interface
                  }

                  return (
                    <Text style={styles.debugText}>Connected Device: {connectedDevice?.name || 'None'}</Text>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        {/* Activity Log Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Activity Log</Text>
          </View>

          <View style={styles.logContainer}>
            <ScrollView
              style={styles.logScrollView}
              contentContainerStyle={styles.logContent}
              showsVerticalScrollIndicator={false}
            >
              {state.logs.map((log, index) => (
                <Text key={index} style={styles.logEntry}>{log}</Text>
              ))}
            </ScrollView>
          </View>

          {/* Debug Logs for Activity Log */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>Total Log Entries: {state.logs.length}</Text>
              <Text style={styles.debugText}>Last Log Entry: {state.logs.length > 0 ? state.logs[0] : 'None'}</Text>
            </View>
          )}
        </View>

        {/* Settings Button */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Ionicons name="settings-outline" size={20} color="#ffffff" />
          <Text style={styles.buttonText}> Settings</Text>
        </TouchableOpacity>

        {/* Whitelist Section */}
        <TouchableOpacity
          style={styles.whitelistButton}
          onPress={() => setShowWhitelistSection(!showWhitelistSection)}
        >
          <Ionicons 
            name={showWhitelistSection ? 'chevron-up' : 'list-outline'} 
            size={20} 
            color="#ffffff" 
          />
          <Text style={styles.buttonText}>
            {showWhitelistSection ? 'Hide Whitelist' : 'Whitelist'}
          </Text>
          {whitelistCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{whitelistCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Expandable Whitelist Content */}
        {showWhitelistSection && (
          <View style={styles.whitelistContent}>
            <View style={styles.whitelistHeader}>
              <View style={styles.whitelistTitleRow}>
                <Ionicons name="shield-checkmark" size={24} color="#4ade80" />
                <Text style={styles.whitelistTitle}>ESP32 Whitelist</Text>
              </View>
              <View style={styles.whitelistActions}>
                <TouchableOpacity
                  style={[styles.wlButton, styles.wlSuccess, whitelistLoading && styles.wlButtonDisabled]}
                  onPress={handleGenerateToken}
                  disabled={state.connectionStatus !== 'connected'}
                >
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.wlButtonText}>Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wlButton, styles.wlPrimary, whitelistLoading && styles.wlButtonDisabled]}
                  onPress={handleReadWhitelist}
                  disabled={whitelistLoading || state.connectionStatus !== 'connected'}
                >
                  <Ionicons 
                    name={whitelistLoading ? 'hourglass-outline' : 'refresh-outline'} 
                    size={18} 
                    color="#fff" 
                  />
                  <Text style={styles.wlButtonText}>
                    {whitelistLoading ? 'Loading...' : 'Read'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wlButton, styles.wlDanger, whitelistLoading && styles.wlButtonDisabled]}
                  onPress={handleClearWhitelist}
                  disabled={whitelistLoading || state.connectionStatus !== 'connected'}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.wlButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Bar */}
            <View style={styles.wlStatusBar}>
              <View style={styles.wlStatusItem}>
                <Ionicons name="layers-outline" size={16} color="#3b82f6" />
                <Text style={styles.wlStatusText}>
                  {whitelistCount} {whitelistCount === 1 ? 'Token' : 'Tokens'}
                </Text>
              </View>
              <View style={styles.wlStatusItem}>
                <Ionicons 
                  name={state.connectionStatus === 'connected' ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={state.connectionStatus === 'connected' ? '#4ade80' : '#ef4444'} 
                />
                <Text style={styles.wlStatusText}>
                  {state.connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>

            {whitelistEntries.length === 0 ? (
              <View style={styles.wlEmpty}>
                <View style={styles.wlEmptyIcon}>
                  <Ionicons name="shield-outline" size={48} color="#64748b" />
                </View>
                <Text style={styles.wlEmptyTitle}>
                  {whitelistCount === 0 ? 'Whitelist Kosong' : 'Belum Ada Data'}
                </Text>
                <Text style={styles.wlEmptyText}>
                  {whitelistCount === 0
                    ? 'ESP32 dalam mode OWNER\nDevice pertama yang connect otomatis jadi owner'
                    : 'Tekan "Read" untuk memuat token dari ESP32'}
                </Text>
                {whitelistCount === 0 && (
                  <TouchableOpacity
                    style={styles.wlEmptyAction}
                    onPress={handleGenerateToken}
                    disabled={state.connectionStatus !== 'connected'}
                  >
                    <Ionicons name="person-add" size={16} color="#3b82f6" />
                    <Text style={styles.wlEmptyActionText}>Invite Device</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.wlList}>
                <View style={styles.wlListHeader}>
                  <Text style={styles.wlListTitle}>Registered Tokens</Text>
                  <Text style={styles.wlListCount}>{whitelistEntries.length} items</Text>
                </View>
                {whitelistEntries.map((token, index) => (
                  <View key={index} style={styles.wlToken}>
                    <View style={styles.wlIndex}>
                      <Text style={styles.wlIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.wlTokenContent}>
                      <Text style={styles.wlTokenLabel}>Token #{index + 1}</Text>
                      <Text style={styles.wlTokenText} selectable>{token}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.wlTokenAction}
                      onPress={() => {
                        Clipboard.setString(token);
                        Alert.alert('Copied!', 'Token copied to clipboard', [{ text: 'OK' }]);
                      }}
                    >
                      <Ionicons name="copy-outline" size={18} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Invite Token Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite New Device</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={28} color="#e2e8f0" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Share this token with the new device. They need to enter it manually to join the whitelist.
            </Text>

            <View style={styles.tokenDisplay}>
              <Text style={styles.tokenText} selectable>{generatedToken}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimary]}
                onPress={handleCopyToken}
              >
                <Ionicons name="copy-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Copy Token</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.manualAddSection}>
              <Text style={styles.manualAddTitle}>Or Add Token Manually</Text>
              <TextInput
                style={styles.tokenInput}
                placeholder="Enter 32-char hex token"
                placeholderTextColor="#64748b"
                value={manualTokenInput}
                onChangeText={setManualTokenInput}
                maxLength={32}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSuccess]}
                onPress={handleAddToken}
                disabled={whitelistLoading}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>
                  {whitelistLoading ? 'Adding...' : 'Add to Whitelist'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
    <ErrorDisplay
      visible={showErrorDisplay}
      onClose={() => setShowErrorDisplay(false)}
    />
    <SettingsModal
      visible={showSettingsModal}
      onClose={() => setShowSettingsModal(false)}
      bleState={state}
      isAuthorized={authStatus === 'authorized'}
      sendRelayCH1Command={sendRelayCH1Command}
      sendRelayCH2Command={sendRelayCH2Command}
      sendBuzzerCommand={sendBuzzerCommand}
      sendLEDCommand={sendLEDCommand}
    />
    </SafeAreaView>
  );
}

const getStyles = (theme: 'light' | 'dark' | 'oled') => {
  const isDark = theme === 'dark' || theme === 'oled';
  const isOled = theme === 'oled';
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isOled ? '#000000' : 
                      isDark ? '#121212' : 
                      '#f8fafc', // Light background for modern look
    },
    scrollContainer: {
      paddingBottom: 20,
      paddingHorizontal: 16,
    },
    header: {
      paddingVertical: 24,
      alignItems: 'center',
      backgroundColor: isOled ? '#000000' :
                      isDark ? '#1e1e1e' :
                      '#ffffff',
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      marginBottom: 16,
    },
    headerIcon: {
      marginBottom: 12,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: isDark ? '#e2e8f0' : '#1e293b',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? '#94a3b8' : '#64748b',
      fontWeight: '400',
    },
    card: {
      backgroundColor: isOled ? '#000000' : 
                      isDark ? '#1e1e1e' : 
                      '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#e2e8f0' : '#1e293b',
      marginBottom: 10,
    },
    statusContainer: {
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    statusValue: {
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
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontWeight: '600',
      flex: 1,
    },
    deviceAddress: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginTop: 4,
    },
    deviceRssi: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginTop: 4,
    },
    deviceMtu: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginTop: 4,
    },
    deviceDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 2,
    },
    ledRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 16,
    },
    ledContainer: {
      alignItems: 'center',
      flex: 1,
    },
    led: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginBottom: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#374151' : '#e2e8f0',
    },
    ledActive: {
      backgroundColor: isDark ? '#166534' : '#dcfce7',
      borderWidth: 2,
      borderColor: isDark ? '#4ade80' : '#4ade80',
    },
    ledInactive: {
      backgroundColor: isDark ? '#4b5563' : '#e2e8f0',
      borderWidth: 2,
      borderColor: isDark ? '#6b7280' : '#cbd5e1',
    },
    ledLabel: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#64748b',
      textAlign: 'center',
      marginTop: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    primaryButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#3b82f6', // Blue
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    dangerButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#ef4444', // Red
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: isDark ? '#4b5563' : '#64748b', // Gray
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    warningButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#f59e0b', // Amber
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    systemCheckButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#8b5cf6', // Purple
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    activeButton: {
      backgroundColor: '#10b981', // Green when active
    },
    controlButton: {
      flex: 1,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactOnButton: {
      backgroundColor: '#dc2626', // Red for ON
    },
    contactOffButton: {
      backgroundColor: '#22c55e', // Green for OFF
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
    },
    devicesContainer: {
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      borderRadius: 12,
      padding: 12,
      maxHeight: 200,
    },
    devicesContainerScrollable: {
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      borderRadius: 12,
      padding: 12,
      maxHeight: 350,  // Increased maximum height to show more devices
      minHeight: 120,  // Increased minimum height to ensure visibility
      flex: 1,         // Allow flexible sizing
      overflow: 'hidden', // Ensure content doesn't overflow
    },
    deviceItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e2e8f0',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    deviceInfo: {
      flex: 1,
    },
    deviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    deviceIcon: {
      marginRight: 8,
    },
    deviceSignal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    signalStrengthContainer: {
      marginTop: 12,
      alignItems: 'center',
    },
    signalStrengthTitle: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#475569',
      marginBottom: 6,
      fontWeight: '500',
    },
    signalStrengthBar: {
      width: '100%',
      height: 8,
      backgroundColor: isDark ? '#374151' : '#e2e8f0',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 6,
    },
    signalStrengthFill: {
      height: '100%',
      borderRadius: 4,
    },
    signalStrengthValue: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#64748b',
      fontWeight: '500',
    },
    signalBar: {
      width: 4,
      height: 16,
      marginHorizontal: 1,
      borderRadius: 1,
    },
    signalBarEmpty: {
      backgroundColor: isDark ? '#4b5563' : '#cbd5e1',
    },
    connectedDeviceRssi: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#64748b',
      minWidth: 50,
      textAlign: 'right',
    },
    signalStrength: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    deviceActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginLeft: 10,
    },
    selectButton: {
      backgroundColor: '#3b82f6', // Blue
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    emptyDevicesContainer: {
      padding: 24,
      alignItems: 'center',
    },
    emptyDevicesText: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#64748b',
      textAlign: 'center',
      marginTop: 12,
    },
    logContainer: {
      flex: 1,
      backgroundColor: isDark ? '#1f2937' : '#f8fafc',
      borderRadius: 12,
      padding: 12,
      minHeight: 150,
      maxHeight: 200, // Limit height to prevent taking too much space
    },
    logScrollView: {
      flex: 1,
    },
    logContent: {
      paddingVertical: 10,
    },
    logEntry: {
      fontSize: 12,
      color: isDark ? '#d1d5db' : '#475569',
      marginBottom: 6,
      fontFamily: 'monospace',
      lineHeight: 16,
    },
    debugSection: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e2e8f0',
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      borderRadius: 8,
      padding: 12,
    },
    debugTitle: {
      fontSize: 12,
      color: isDark ? '#fbbf24' : '#ca8a04', // Yellow color for debug titles
      fontWeight: 'bold',
      marginBottom: 6,
    },
    debugText: {
      fontSize: 11,
      color: isDark ? '#9ca3af' : '#64748b', // Light gray for debug text
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    savedDeviceContainer: {
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      borderRadius: 12,
      padding: 16,
    },
    savedDeviceInfo: {
      alignItems: 'flex-start',
    },
    savedDeviceName: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontWeight: '600',
      marginBottom: 4,
    },
    savedDeviceId: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 4,
    },
    savedDeviceRssi: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 16,
    },
    savedDeviceDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 2,
    },
    savedDeviceActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    noSavedDeviceContainer: {
      alignItems: 'center',
      padding: 20,
    },
    noSavedDeviceText: {
      fontSize: 16,
      color: isDark ? '#9ca3af' : '#64748b',
      textAlign: 'center',
      marginBottom: 8,
    },
    smallText: {
      fontSize: 12,
      color: isDark ? '#6b7280' : '#94a3b8',
      textAlign: 'center',
    },
    connectButton: {
      backgroundColor: '#10b981', // Green
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      flex: 1,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    realTimeSignalDebug: {
      marginTop: 12,
      padding: 12,
      backgroundColor: isDark ? '#2d2d2d' : '#f1f5f9',
      borderRadius: 8,
      width: '100%',
    },
    realTimeSignalDebugTitle: {
      fontSize: 12,
      color: isDark ? '#fbbf24' : '#ca8a04', // Yellow color for debug titles
      fontWeight: 'bold',
      marginBottom: 6,
    },
    realTimeSignalDebugText: {
      fontSize: 11,
      color: isDark ? '#9ca3af' : '#64748b', // Light gray for debug text
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    settingsButton: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#6366f1', // Indigo
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      marginHorizontal: 16,
    },
    whitelistButton: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#10b981', // Emerald green
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      marginHorizontal: 16,
      position: 'relative',
    },
    badge: {
      backgroundColor: '#ef4444',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 4,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    whitelistContent: {
      backgroundColor: '#1e293b',
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 16,
      padding: 0,
      borderWidth: 1,
      borderColor: '#334155',
      overflow: 'hidden',
    },
    whitelistHeader: {
      padding: 16,
      backgroundColor: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderBottomWidth: 1,
      borderBottomColor: '#334155',
    },
    whitelistTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    whitelistTitle: {
      color: '#e2e8f0',
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
    },
    whitelistActions: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    wlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      minWidth: 85,
    },
    wlButtonDisabled: {
      opacity: 0.6,
    },
    wlPrimary: {
      backgroundColor: '#3b82f6',
    },
    wlDanger: {
      backgroundColor: '#ef4444',
    },
    wlButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    wlStatusBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 12,
      backgroundColor: '#0f172a',
      borderBottomWidth: 1,
      borderBottomColor: '#334155',
    },
    wlStatusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    wlStatusText: {
      color: '#94a3b8',
      fontSize: 13,
      fontWeight: '500',
    },
    wlEmpty: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
      gap: 12,
    },
    wlEmptyTitle: {
      color: '#e2e8f0',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    wlEmptyText: {
      color: '#64748b',
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
    wlEmptyAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#1e3a8a20',
      borderRadius: 20,
    },
    wlEmptyActionText: {
      color: '#3b82f6',
      fontSize: 13,
      fontWeight: '600',
    },
    wlList: {
      padding: 16,
    },
    wlListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#334155',
    },
    wlListTitle: {
      color: '#e2e8f0',
      fontSize: 14,
      fontWeight: '600',
    },
    wlListCount: {
      color: '#64748b',
      fontSize: 12,
      fontWeight: '500',
    },
    wlToken: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0f172a',
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#334155',
      gap: 12,
    },
    wlIndex: {
      backgroundColor: '#3b82f6',
      borderRadius: 10,
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    wlIndexText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    wlTokenContent: {
      flex: 1,
    },
    wlTokenLabel: {
      color: '#64748b',
      fontSize: 10,
      marginBottom: 2,
    },
    wlTokenText: {
      color: '#4ade80',
      fontSize: 13,
      fontFamily: 'monospace',
      letterSpacing: 0.5,
    },
    wlTokenAction: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: '#1e293b',
    },
    wlSuccess: {
      backgroundColor: '#10b981',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: '#1e293b',
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: '#334155',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      color: '#e2e8f0',
      fontSize: 20,
      fontWeight: 'bold',
      flex: 1,
    },
    modalDescription: {
      color: '#94a3b8',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    tokenDisplay: {
      backgroundColor: '#0f172a',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#334155',
      marginBottom: 16,
    },
    tokenText: {
      color: '#4ade80',
      fontSize: 14,
      fontFamily: 'monospace',
      letterSpacing: 0.5,
    },
    modalActions: {
      marginBottom: 24,
    },
    modalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
      marginBottom: 12,
    },
    modalPrimary: {
      backgroundColor: '#3b82f6',
    },
    modalSuccess: {
      backgroundColor: '#10b981',
    },
    modalButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    manualAddSection: {
      borderTopWidth: 1,
      borderTopColor: '#334155',
      paddingTop: 20,
    },
    manualAddTitle: {
      color: '#e2e8f0',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    tokenInput: {
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      fontFamily: 'monospace',
      borderWidth: 1,
      borderColor: '#334155',
      marginBottom: 12,
    },
    resetButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#f59e0b', // Amber
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    statusGrid: {
      flexDirection: 'column',
      gap: 12,
    },
    statusItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statusLabel: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    statusIndicator: {
      width: 60,
      padding: 6,
      borderRadius: 8,
      alignItems: 'center',
    },
    statusActive: {
      backgroundColor: '#dcfce7', // Light green background
      borderWidth: 1,
      borderColor: '#4ade80', // Green border
    },
    statusInactive: {
      backgroundColor: '#fee2e2', // Light red background
      borderWidth: 1,
      borderColor: '#f87171', // Red border
    },
    statusUnknown: {
      backgroundColor: '#fef3c7', // Light amber background
      borderWidth: 1,
      borderColor: '#fbbf24', // Amber border
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
};