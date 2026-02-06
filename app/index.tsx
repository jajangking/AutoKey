import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBLE } from '../hooks/useBLE';

// Component for LED indicator
const LEDIndicator = ({ active, label }: { active: boolean; label: string }) => (
  <View style={styles.ledContainer}>
    <View style={[styles.led, active ? styles.ledActive : styles.ledInactive]} />
    <Text style={styles.ledLabel}>{label}</Text>
  </View>
);

// Function to determine signal strength color
const getSignalColor = (rssi) => {
  if (rssi === undefined) return '#94a3b8'; // Gray if no RSSI
  if (rssi >= -50) return '#4ade80'; // Strong signal - green
  if (rssi >= -70) return '#fbbf24'; // Medium signal - yellow
  return '#f87171'; // Weak signal - red
};

// Component for displaying a Bluetooth device
const BluetoothDeviceItem = ({ device, onSelect, onSaveDevice }) => {

  return (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {device.name || 'Unknown Device'}
        </Text>
        <Text style={styles.deviceId}>
          ID: {device.id}
        </Text>
      </View>
      <View style={styles.deviceSignal}>
        {device.rssi !== undefined && (
          <Text style={styles.deviceRssi}>
            {device.rssi} dBm
          </Text>
        )}
        <View style={[
          styles.signalIndicator,
          {
            backgroundColor: getSignalColor(device.rssi)
          }
        ]} />
      </View>
      <View style={styles.deviceActions}>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => onSaveDevice(device)}
        >
          <Text style={styles.buttonText}>Select</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Component for the main screen
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
    toggleAutoConnect
  } = useBLE();

  const handleDeviceSelect = (device) => {
    connectToDevice(device);
    // Save the selected device to storage
    saveSelectedDevice(device);
  };

  // State for debug visibility toggle
  const [showDebug, setShowDebug] = useState(false);

  // State for real-time signal debug timestamp
  const [realTimeSignalTimestamp, setRealTimeSignalTimestamp] = useState(new Date());

  // Update real-time signal timestamp every second when connected
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

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

  // Note: Scanning stops automatically when connecting to a device

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps='handled'
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AutoKey</Text>
          <Text style={styles.subtitle}>Keyless Motor System</Text>
        </View>

        {/* System Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>
          <View style={styles.ledRow}>
            <LEDIndicator active={state.ledStatus.btConnected} label="BT Connected" />
            <LEDIndicator active={state.ledStatus.ready} label="Ready" />
            <LEDIndicator active={state.ledStatus.wifi} label="WiFi" />
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
              <Text style={styles.buttonText}>System Check</Text>
            </TouchableOpacity>
          </View>
          {/* Debug Logs for System Status */}
          {showDebug && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>Debug:</Text>
              <Text style={styles.debugText}>BT Connected: {state.ledStatus.btConnected ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Ready: {state.ledStatus.ready ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>WiFi: {state.ledStatus.wifi ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Saved Device Active: {(state.savedDevice && ((state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId) || (state.scannedDevices.some(d => d.id === state.savedDevice.id)))) ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Saved Device ID: {state.savedDevice?.id || 'None'}</Text>
              <Text style={styles.debugText}>Connected Device ID: {state.connectedDeviceId || 'None'}</Text>
            </View>
          )}
        </View>

        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusContainer}>
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
                      <Text style={styles.deviceName}>
                        Device: {connectedDevice.name || 'Unknown Device'}
                      </Text>
                      <Text style={styles.deviceAddress}>
                        ID: {connectedDevice.id}
                      </Text>
                      <Text style={styles.deviceRssi}>
                        RSSI: {connectedDevice.rssi !== undefined && connectedDevice.rssi !== null ? `${connectedDevice.rssi} dBm` : 'N/A'}
                      </Text>
                      <Text style={styles.deviceMtu}>
                        MTU: {connectedDevice.mtu ? `${connectedDevice.mtu}` : 'N/A'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.deviceName}>
                        Device: Unknown Device
                      </Text>
                      <Text style={styles.deviceAddress}>
                        ID: {state.connectedDeviceId}
                      </Text>
                      <Text style={styles.deviceRssi}>
                        RSSI: N/A
                      </Text>
                      <Text style={styles.deviceMtu}>
                        MTU: N/A
                      </Text>
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

        {/* Saved Device Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Device</Text>
          <View style={styles.savedDeviceContainer}>
            {(() => {
              const savedDevice = state.savedDevice;
              if (savedDevice) {
                return (
                  <View style={styles.savedDeviceInfo}>
                    <Text style={styles.savedDeviceName}>Name: {savedDevice.name || 'Unknown Device'}</Text>
                    <Text style={styles.savedDeviceId}>ID: {savedDevice.id}</Text>
                    <Text style={styles.savedDeviceRssi}>RSSI: {savedDevice.rssi || 'N/A'} dBm</Text>
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
                        <Text style={styles.buttonText}>Connect to Saved Device</Text>
                      </TouchableOpacity>

                      {state.connectionStatus === 'connected' && state.savedDevice && state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId && (
                        <TouchableOpacity
                          style={styles.dangerButton}
                          onPress={disconnectFromDevice}
                        >
                          <Text style={styles.buttonText}>Disconnect</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.warningButton}
                        onPress={clearSelectedDevice}
                      >
                        <Text style={styles.buttonText}>Clear Saved Device</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              } else {
                return (
                  <View style={styles.noSavedDeviceContainer}>
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
              <Text style={styles.debugText}>Saved Device in Scan List: {(state.savedDevice && state.scannedDevices.some(d => d.id === state.savedDevice.id)) ? 'Yes' : 'No'}</Text>
            </View>
          )}
        </View>

        {/* Connection Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Controls</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                state.connectionStatus === 'connecting' && styles.disabledButton
              ]}
              onPress={startScan}
              disabled={state.connectionStatus === 'connecting'}
            >
              <Text style={styles.buttonText}>
                {state.isScanning ? 'Scanning...' : 'Scan Bluetooth'}
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
              <Text style={styles.buttonText}>Stop Scan</Text>
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
              <Text style={styles.buttonText}>System Check</Text>
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
              <Text style={styles.buttonText}>
                Auto-Connect: {state.autoConnectEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Debug Visibility Toggle */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                showDebug && styles.activeButton // Highlight when enabled
              ]}
              onPress={() => setShowDebug(!showDebug)}
            >
              <Text style={styles.buttonText}>
                Show Debug: {showDebug ? 'ON' : 'OFF'}
              </Text>
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

        {/* Available Bluetooth Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Bluetooth Devices</Text>
          <View style={styles.devicesContainerScrollable}>
            {state.scannedDevices.length > 0 ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true} // Enable nested scrolling
                style={{ maxHeight: 250 }} // Set max height for the scroll view
              >
                {state.scannedDevices.map((device, index) => (
                  <BluetoothDeviceItem
                    key={device.id}
                    device={device}
                    onSelect={handleDeviceSelect}
                    onSaveDevice={saveSelectedDevice}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyDevicesContainer}>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Status</Text>
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

        {/* Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          <View style={styles.logContainer}>
            <ScrollView
              style={styles.logScrollView}
              contentContainerStyle={styles.logContent}
              showsVerticalScrollIndicator={false}
              inverted={true} // Show newest logs at top
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 10,
  },
  statusContainer: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 5,
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
    color: '#e2e8f0',
    textAlign: 'left',
    fontWeight: '600',
  },
  deviceAddress: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'left',
    marginTop: 3,
  },
  deviceRssi: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'left',
    marginTop: 3,
  },
  deviceMtu: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'left',
    marginTop: 3,
  },
  ledRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ledContainer: {
    alignItems: 'center',
  },
  led: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 5,
  },
  ledActive: {
    backgroundColor: '#4ade80',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  ledInactive: {
    backgroundColor: '#475569',
    borderWidth: 1,
    borderColor: '#334155',
  },
  ledLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#3b82f6', // Blue
    marginRight: 10,
  },
  dangerButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#ef4444', // Red
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#64748b', // Gray
    marginRight: 10,
  },
  warningButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f59e0b', // Amber
  },
  systemCheckButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#8b5cf6', // Purple
    marginTop: 10,
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
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    maxHeight: 200,
  },
  devicesContainerScrollable: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    maxHeight: 300,  // Increased maximum height to show more devices
    minHeight: 100,  // Increased minimum height to ensure visibility
    flex: 1,         // Allow flexible sizing
    overflow: 'hidden', // Ensure content doesn't overflow
  },
  deviceItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceSignal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceRssi: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
  },
  signalIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
    paddingVertical: 6,
    borderRadius: 5,
  },
  emptyDevicesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyDevicesText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
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
    color: '#cbd5e1',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  debugSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  debugTitle: {
    fontSize: 12,
    color: '#fbbf24', // Yellow color for debug titles
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 11,
    color: '#94a3b8', // Light gray for debug text
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  savedDeviceContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 15,
  },
  savedDeviceInfo: {
    alignItems: 'flex-start',
  },
  savedDeviceName: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 5,
  },
  savedDeviceId: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 5,
  },
  savedDeviceRssi: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 15,
  },
  savedDeviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  noSavedDeviceContainer: {
    alignItems: 'center',
    padding: 10,
  },
  noSavedDeviceText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 5,
  },
  smallText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: '#10b981', // Green
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
    alignItems: 'center',
  },
  signalStrengthContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  signalStrengthTitle: {
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 5,
    fontWeight: '600',
  },
  signalStrengthBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 5,
  },
  signalStrengthFill: {
    height: '100%',
    borderRadius: 5,
  },
  signalStrengthValue: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  realTimeSignalDebug: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 5,
    width: '100%',
  },
  realTimeSignalDebugTitle: {
    fontSize: 12,
    color: '#fbbf24', // Yellow color for debug titles
    fontWeight: 'bold',
    marginBottom: 5,
  },
  realTimeSignalDebugText: {
    fontSize: 11,
    color: '#94a3b8', // Light gray for debug text
    fontFamily: 'monospace',
    marginBottom: 3,
  },
});