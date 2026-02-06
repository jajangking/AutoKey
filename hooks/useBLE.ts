import { useState, useEffect, useCallback, useRef } from 'react';
import { BleManager, Device, BleError } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define constants for ESP32 services and characteristics
const ESP32_DEVICE_NAME = 'ESP32_KEYLESS';
// Using standard UUIDs for demonstration - these would need to match your ESP32 implementation
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CONTROL_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // For sending commands
const STATUS_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9'; // For receiving status

// Initialize BLE manager inside the hook to ensure it's created in the right context

interface BLEState {
  isScanning: boolean;
  connectedDevice: Device | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  logs: string[];
  contactStatus: boolean; // true for ON, false for OFF
  ledStatus: {
    btConnected: boolean;
    ready: boolean;
    wifi: boolean;
  };
  manager: BleManager | null;
  scannedDevices: Device[];
  bluetoothState: string; // 'PoweredOn', 'PoweredOff', etc.
  savedDevice: {
    id: string;
    name?: string;
    rssi?: number;
    mtu?: number;
  } | null;
  autoConnectEnabled: boolean;
}

export const useBLE = () => {
  const bleManagerRef = useRef<BleManager | null>(null);
  const [managerInitialized, setManagerInitialized] = useState(false);

  // Initialize BleManager only on the client side after native modules are available
  useEffect(() => {
    // Only initialize on the client side (mobile device)
    if (typeof window !== 'undefined') {
      // Wait a bit to ensure native modules are loaded
      const timer = setTimeout(() => {
        try {
          if (!bleManagerRef.current) {
            bleManagerRef.current = new BleManager();
            setManagerInitialized(true);

            // Update state with the manager
            setState(prev => ({ ...prev, manager: bleManagerRef.current }));

            console.log('BLE Manager initialized successfully');
          }
        } catch (error) {
          console.error('Failed to initialize BleManager:', error);
          addLog(`BLE Manager initialization failed: ${(error as Error).message}`);
        }
      }, 500); // Small delay to ensure native modules are loaded

      // Cleanup function
      return () => {
        clearTimeout(timer);
        if (bleManagerRef.current) {
          try {
            bleManagerRef.current.destroy();
          } catch (error) {
            console.error('Error destroying BleManager:', error);
            addLog(`Error destroying BleManager: ${(error as Error).message}`);
          }
          bleManagerRef.current = null;
        }
      };
    }
  }, [addLog]);

  const [state, setState] = useState<BLEState>({
    isScanning: false,
    connectedDevice: null,
    connectionStatus: 'disconnected',
    logs: [],
    contactStatus: false,
    ledStatus: {
      btConnected: false,
      ready: false,
      wifi: false
    },
    manager: null,
    scannedDevices: [],
    bluetoothState: 'Unknown', // Default state
    savedDevice: null,
    autoConnectEnabled: false // Track auto-connect status
  });

  // Keep references to subscriptions to properly clean them up
  const statusSubscriptionRef = useRef<any | null>(null);

  // Add log entry
  const addLog = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()}: ${message}`].slice(-20) // Keep last 20 logs
    }));
  }, []);

  // Request Bluetooth permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      // Check Android version and request appropriate permissions
      if (Platform.Version >= 31) { // Android 12+ (API 31+)
        // Request all required permissions at once
        const permissions = [
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ];

        const grantedResults = await PermissionsAndroid.requestMultiple(permissions);

        // Check if all permissions were granted
        const allGranted = Object.values(grantedResults).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          addLog('Some Bluetooth permissions were denied');
          
          // Show which permissions were denied
          Object.entries(grantedResults).forEach(([permission, result]) => {
            if (result !== PermissionsAndroid.RESULTS.GRANTED) {
              addLog(`Permission denied: ${permission}`);
            }
          });
          
          return false;
        }
      } else { // Android 11 and below
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires Location permission on Android',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (locationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          addLog('Location permission denied');
          return false;
        }
      }
    }

    return true;
  }, [addLog]);

  // Scan for all Bluetooth devices
  const startScan = useCallback(async () => {
    if (state.isScanning) {
      addLog('Already scanning...');
      return;
    }

    if (!managerInitialized || !bleManagerRef.current) {
      addLog('BLE Manager not initialized');
      setState(prev => ({ ...prev, isScanning: false }));
      return;
    }

    // Check if Bluetooth is powered on
    try {
      const bluetoothState = await bleManagerRef.current.state();
      // Update the state with the current Bluetooth state
      setState(prev => ({ ...prev, bluetoothState }));

      if (bluetoothState !== 'PoweredOn') {
        addLog(`Bluetooth is not powered on. Current state: ${bluetoothState}`);

        // On Android, we can prompt the user to enable Bluetooth
        if (Platform.OS === 'android') {
          try {
            await bleManagerRef.current.enableBluetooth();
            addLog('Attempting to enable Bluetooth...');

            // Wait a moment for Bluetooth to enable before scanning
            setTimeout(() => {
              // Retry the scan after a delay
              setTimeout(startScan, 2000);
            }, 1000);
          } catch (err) {
            addLog('Failed to enable Bluetooth automatically. Please enable it manually.');
            return;
          }
        }
        return;
      } else {
        addLog('Bluetooth is powered on. Starting scan...');
      }
    } catch (error) {
      addLog(`Error checking Bluetooth state: ${(error as Error).message}`);
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      addLog('Permissions not granted');
      return;
    }

    // Reset scanned devices list and start scanning
    setState(prev => ({ ...prev, isScanning: true, scannedDevices: [] }));
    addLog('Starting scan for all Bluetooth devices...');

    try {
      bleManagerRef.current.startDeviceScan(
        null,
        {
          allowDuplicates: false,
        },
        (error: BleError | null, device: Device | null) => {
          // Handle error case
          if (error) {
            // Check if the error is related to Bluetooth being off
            if (error.message?.toLowerCase().includes('powered off') ||
                error.message?.toLowerCase().includes('bluetoothle is powered off')) {
              addLog(`Bluetooth is powered off: ${error.message}`);
              setState(prev => ({ ...prev, isScanning: false }));
              if (bleManagerRef.current) {
                try {
                  bleManagerRef.current.stopDeviceScan();
                } catch (stopError) {
                  addLog(`Error stopping scan: ${(stopError as Error).message}`);
                }
              }
              return;
            }
            // Check if the error is related to permissions
            else if (error.message?.toLowerCase().includes('permission') ||
                     error.message?.toLowerCase().includes('authorization')) {
              addLog(`Permission error: ${error.message}. Please check app permissions.`);
            } else {
              addLog(`Scan error: ${error.message || 'Unknown error'}`);
            }

            setState(prev => ({ ...prev, isScanning: false }));
            if (bleManagerRef.current) {
              try {
                bleManagerRef.current.stopDeviceScan();
              } catch (stopError) {
                addLog(`Error stopping scan: ${(stopError as Error).message}`);
              }
            }
            return;
          }

          // Handle device found case
          if (device) {
            addLog(`Found device: ${device.name || 'Unknown'} (${device.id})`);

            // Add the device to the scanned devices list in state
            setState(prev => {
              // Check if device is already in the list
              const existingDeviceIndex = prev.scannedDevices.findIndex(d => d.id === device.id);

              if (existingDeviceIndex !== -1) {
                // Update existing device with new information
                const updatedDevices = [...prev.scannedDevices];
                updatedDevices[existingDeviceIndex] = device;

                // Check if the found device is the saved device, then update ready indicator
                if (prev.savedDevice && device.id === prev.savedDevice.id) {
                  addLog(`Found saved device ${device.name || device.id}, ready indicator ON`);
                  return {
                    ...prev,
                    scannedDevices: updatedDevices,
                    ledStatus: { ...prev.ledStatus, ready: true }
                  };
                }

                return { ...prev, scannedDevices: updatedDevices };
              } else {
                // Add new device to the list
                const newScannedDevices = [...prev.scannedDevices, device];

                // Check if the found device is the saved device, then handle accordingly
                if (prev.savedDevice && device.id === prev.savedDevice.id) {
                  addLog(`Found saved device ${device.name || device.id}`);

                  // Update state to indicate the device was found
                  const newState = {
                    ...prev,
                    scannedDevices: newScannedDevices,
                    isScanning: prev.autoConnectEnabled ? prev.isScanning : false, // Only stop scan if auto-connect is disabled
                    ledStatus: { ...prev.ledStatus, ready: true }
                  };

                  // If auto-connect is enabled, we'll handle the connection in a useEffect
                  if (prev.autoConnectEnabled) {
                    addLog(`Auto-connect is enabled, will attempt to connect to saved device`);
                  } else {
                    addLog(`Auto-connect is disabled, stopping scan and setting ready indicator ON`);

                    // Stop scanning since we found the saved device
                    if (bleManagerRef.current) {
                      try {
                        bleManagerRef.current.stopDeviceScan();
                        addLog('Stopped scanning after finding saved device');
                      } catch (stopError) {
                        addLog(`Error stopping scan: ${(stopError as Error).message}`);
                      }
                    }

                    // Update isScanning state to false
                    newState.isScanning = false;
                  }

                  return newState;
                }

                return { ...prev, scannedDevices: newScannedDevices };
              }
            });
          }
        }
      );
    } catch (err) {
      addLog(`Failed to start scan: ${(err as Error).message}`);
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [state.isScanning, requestPermissions, addLog, managerInitialized]);

  // Connect to a specific device
  const connectToDevice = useCallback(async (device: Device) => {
    if (state.connectionStatus !== 'disconnected') {
      addLog('Already connected to a device');
      return;
    }

    if (!managerInitialized || !bleManagerRef.current) {
      addLog('BLE Manager not initialized');
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      return;
    }

    // Stop scanning if it's in progress
    if (state.isScanning) {
      bleManagerRef.current.stopDeviceScan();
      setState(prev => ({ ...prev, isScanning: false }));
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    addLog(`Connecting to ${device.name || device.id}...`);

    try {
      // Connect to the device with timeout to prevent hanging
      const connectionTimeout = new Promise<Device>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 second timeout
      });

      const connectPromise = bleManagerRef.current!.connectToDevice(device.id, { timeout: 10000 });

      const connectedDevice = await Promise.race([connectPromise, connectionTimeout]) as Device;

      // Discover services and characteristics
      try {
        await connectedDevice.discoverAllServicesAndCharacteristics();

        // Update state with the connected device
        setState(prev => ({
          ...prev,
          connectedDevice,
          connectionStatus: 'connected',
          ledStatus: { ...prev.ledStatus, btConnected: true }
        }));

        addLog(`Connected to ${connectedDevice.name || connectedDevice.id}`);

        // Subscribe to status notifications
        subscribeToStatusNotifications(connectedDevice);
      } catch (discoverErr) {
        addLog(`Failed to discover services: ${(discoverErr as Error).message}`);

        // Still consider it connected if the connection succeeded, even if service discovery failed
        setState(prev => ({
          ...prev,
          connectedDevice,
          connectionStatus: 'connected',
          ledStatus: { ...prev.ledStatus, btConnected: true }
        }));

        addLog(`Connected to ${connectedDevice.name || connectedDevice.id} (with limited functionality)`);
      }
    } catch (err) {
      addLog(`Connection failed: ${(err as Error).message}`);
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        connectedDevice: null, // Ensure connectedDevice is null on failure
        ledStatus: { ...prev.ledStatus, btConnected: false }
      }));
    }
  }, [state.connectionStatus, state.isScanning, addLog, managerInitialized]);

  // Subscribe to status notifications
  const subscribeToStatusNotifications = useCallback(async (device: Device) => {
    if (!bleManagerRef.current) {
      addLog('BLE Manager not initialized for subscribing to notifications');
      return;
    }

    try {
      // First, unsubscribe from any existing subscription
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }

      // Subscribe to status characteristic notifications
      const subscription = device.monitorCharacteristicForService(
        SERVICE_UUID,
        STATUS_CHARACTERISTIC_UUID,
        (error: BleError | null, characteristic: any | null) => {
          if (error) {
            addLog(`Notification error: ${error.message}`);
            return;
          }

          if (characteristic?.value) {
            // Process the received status data
            // Convert base64 value to bytes
            const buffer = Uint8Array.from(atob(characteristic.value), c => c.charCodeAt(0));

            if (buffer.length >= 1) {
              const statusByte = buffer[0];

              setState(prev => ({
                ...prev,
                contactStatus: (statusByte & 1) !== 0,
                ledStatus: {
                  btConnected: prev.ledStatus.btConnected,
                  ready: (statusByte & 2) !== 0,
                  wifi: (statusByte & 4) !== 0
                }
              }));

              addLog(`Received status: Contact=${!!(statusByte & 1)}, Ready=${!!(statusByte & 2)}, WiFi=${!!(statusByte & 4)}`);
            }
          }
        }
      );

      // Store reference to subscription for cleanup
      statusSubscriptionRef.current = subscription;
      addLog('Subscribed to status notifications');
    } catch (err) {
      addLog(`Failed to subscribe to notifications: ${(err as Error).message}`);
    }
  }, [addLog]);

  // Send command to ESP32
  const sendCommand = useCallback(async (command: 'ON' | 'OFF'): Promise<boolean> => {
    if (state.connectionStatus !== 'connected' || !state.connectedDevice) {
      addLog('Not connected to device');
      return false;
    }

    try {
      const device = state.connectedDevice;

      // Prepare command data (for example, 1 for ON, 0 for OFF)
      const commandValue = command === 'ON' ? 1 : 0;
      const commandBuffer = new Uint8Array([commandValue]);
      // Convert to base64 for sending
      const commandData = btoa(String.fromCharCode(...commandBuffer));

      // Write to control characteristic
      await device.writeCharacteristicWithResponse(
        SERVICE_UUID,
        CONTROL_CHARACTERISTIC_UUID,
        commandData
      );

      addLog(`Sent command: ${command}`);

      // Update local state to reflect the command sent
      setState(prev => ({
        ...prev,
        contactStatus: command === 'ON'
      }));

      return true;
    } catch (err) {
      addLog(`Failed to send command: ${(err as Error).message}`);
      return false;
    }
  }, [state.connectionStatus, state.connectedDevice, addLog]);

  // Toggle contact state
  const toggleContact = useCallback(async () => {
    if (state.connectionStatus !== 'connected') {
      addLog('Cannot toggle contact - not connected');
      return;
    }

    const newStatus = !state.contactStatus;
    const command = newStatus ? 'ON' : 'OFF';

    const success = await sendCommand(command);
    if (success) {
      addLog(`Contact ${command} command sent successfully`);
    }
  }, [state.connectionStatus, state.contactStatus, sendCommand, addLog]);

  // Disconnect from device
  const disconnectFromDevice = useCallback(async () => {
    if (!state.connectedDevice) {
      addLog('No device connected');
      return;
    }

    if (!managerInitialized || !bleManagerRef.current) {
      addLog('BLE Manager not initialized');
      return;
    }

    try {
      // Remove notification subscription
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }

      await bleManagerRef.current.cancelDeviceConnection(state.connectedDevice.id);

      // Update state to reflect disconnection
      setState(prev => ({
        ...prev,
        connectedDevice: null,
        connectionStatus: 'disconnected',
        ledStatus: { btConnected: false, ready: false, wifi: false },
        contactStatus: false
      }));
      addLog(`Disconnected from ${state.connectedDevice.name || state.connectedDevice.id}`);
    } catch (err) {
      addLog(`Disconnect error: ${(err as Error).message}`);
    }
  }, [state.connectedDevice, addLog, managerInitialized]);

  // Handle device disconnection
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    const subscription = bleManagerRef.current.onDeviceDisconnected(
      (error: BleError | null, device: Device) => {
        console.log('Device disconnected event triggered:', device.id, 'Expected:', state.connectedDevice?.id);
        if (device.id === state.connectedDevice?.id) {
          addLog(`Device disconnected: ${device.name || device.id}`);
          // Update saved devices to reflect disconnection
          setState(prev => ({
            ...prev,
            connectedDevice: null,
            connectionStatus: 'disconnected',
            ledStatus: { btConnected: false, ready: false, wifi: false },
            contactStatus: false
          }));

          // Automatically start scanning again after a delay
          setTimeout(() => {
            startScan();
          }, 2000);
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [state.connectedDevice?.id, startScan, addLog, managerInitialized]);

  // Monitor connection state changes more proactively
  useEffect(() => {
    if (state.connectionStatus === 'connected' && state.connectedDevice) {
      const monitorInterval = setInterval(async () => {
        try {
          if (bleManagerRef.current && state.connectedDevice) {
            // Use BleManager to check if device is connected
            const isActuallyConnected = await bleManagerRef.current.isDeviceConnected(state.connectedDevice.id);
            if (!isActuallyConnected) {
              console.log('Device reported as connected but actually disconnected');
              addLog(`Device ${state.connectedDevice.name || state.connectedDevice.id} is no longer connected`);

              // Update state to reflect disconnection
              setState(prev => ({
                ...prev,
                connectedDevice: null,
                connectionStatus: 'disconnected',
                ledStatus: { btConnected: false, ready: false, wifi: false },
                contactStatus: false
              }));
            }
          }
        } catch (error) {
          console.error('Error checking connection status:', error);
          // If we can't check the connection status, assume it's disconnected
          addLog(`Error checking connection status, assuming disconnected`);
          setState(prev => ({
            ...prev,
            connectedDevice: null,
            connectionStatus: 'disconnected',
            ledStatus: { btConnected: false, ready: false, wifi: false },
            contactStatus: false
          }));
        }
      }, 2000); // Check every 2 seconds

      // Cleanup function
      return () => {
        clearInterval(monitorInterval);
      };
    }
  }, [state.connectionStatus, state.connectedDevice]);

  // Periodically check if connected device is still available and update RSSI
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (state.connectedDevice && state.connectionStatus === 'connected') {
      // Start monitoring when device is connected
      intervalId = setInterval(async () => {
        try {
          if (bleManagerRef.current && state.connectedDevice) {
            const isConnected = await state.connectedDevice.isConnected();
            if (!isConnected) {
              addLog(`Connected device ${state.connectedDevice.name || state.connectedDevice.id} is no longer connected`);
              // Update state to reflect disconnection
              setState(prev => ({
                ...prev,
                connectedDevice: null,
                connectionStatus: 'disconnected',
                ledStatus: { btConnected: false, ready: false, wifi: false },
                contactStatus: false
              }));
            } else {
              // Update RSSI if device is still connected
              try {
                const rssiResult = await state.connectedDevice.readRSSI();
                // Extract the RSSI value from the result (it might be an object with value property)
                const rssiValue = typeof rssiResult === 'object' && rssiResult.hasOwnProperty('rssi')
                  ? rssiResult.rssi
                  : rssiResult;

                // Always update the device object with new RSSI value to trigger UI refresh
                // This ensures the UI updates even if RSSI value hasn't changed significantly
                const updatedDevice = {
                  ...state.connectedDevice,
                  rssi: rssiValue
                };
                setState(prev => ({
                  ...prev,
                  connectedDevice: updatedDevice
                }));

                // Only log if the value has changed significantly
                const rssiDiff = Math.abs(rssiValue - (state.connectedDevice.rssi || 0));
                if (rssiDiff > 1) {
                  addLog(`Updated RSSI for ${updatedDevice.name || updatedDevice.id}: ${rssiValue} dBm`);
                }
              } catch (rssiError) {
                // RSSI reading might fail, which is normal in some cases
                // Don't log this as an error since it's expected behavior sometimes
                // Still trigger a state update to refresh UI
                setState(prev => ({ ...prev }));
              }
            }
          }
        } catch (error) {
          addLog(`Error checking device connection: ${(error as Error).message}`);
        }
      }, 1000); // Check every 1 second for more responsive updates
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state.connectedDevice, state.connectionStatus]);

  // Check if saved device is active and update ready indicator
  useEffect(() => {
    if (state.savedDevice && state.connectedDevice && state.savedDevice.id === state.connectedDevice.id) {
      // If saved device is the same as connected device, set ready indicator to true
      setState(prev => ({
        ...prev,
        ledStatus: { ...prev.ledStatus, ready: true }
      }));
      addLog(`Saved device ${state.savedDevice.name || state.savedDevice.id} is active, ready indicator ON`);
    } else {
      // If saved device is not connected, set ready indicator to false
      setState(prev => ({
        ...prev,
        ledStatus: { ...prev.ledStatus, ready: false }
      }));
      if (state.savedDevice) {
        addLog(`Saved device ${state.savedDevice.name || state.savedDevice.id} is not connected, ready indicator OFF`);
      } else {
        addLog('No saved device, ready indicator OFF');
      }
    }
  }, [state.savedDevice, state.connectedDevice]);

  // Handle auto-connect when saved device is found during scanning
  useEffect(() => {
    if (state.autoConnectEnabled &&
        state.savedDevice &&
        state.scannedDevices.length > 0 &&
        !state.connectedDevice) { // Only attempt auto-connect if not already connected

      const savedDeviceFound = state.scannedDevices.find(device => device.id === state.savedDevice!.id);
      if (savedDeviceFound) {
        addLog(`Auto-connect enabled and saved device found, attempting connection...`);
        connectToDevice(savedDeviceFound);
      }
    }
  }, [state.autoConnectEnabled, state.savedDevice, state.scannedDevices, state.connectedDevice, connectToDevice]);

  // Monitor Bluetooth state changes
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    const subscription = bleManagerRef.current.onStateChange((bluetoothState) => {
      console.log('Bluetooth state changed to:', bluetoothState);
      // Update the state with the current Bluetooth state
      setState(prev => ({ ...prev, bluetoothState }));

      if (bluetoothState === 'PoweredOn') {
        // Only log that Bluetooth is powered on - don't start scanning automatically
        addLog('Bluetooth is powered on. Ready to scan when user initiates.');
      } else if (bluetoothState !== 'PoweredOn' && state.connectionStatus === 'connected') {
        // If Bluetooth is turned off while connected, update the state
        setState(prev => ({
          ...prev,
          connectionStatus: 'disconnected',
          connectedDevice: null,
          ledStatus: { ...prev.ledStatus, btConnected: false }
        }));
        addLog(`Bluetooth turned off. Connection status: ${bluetoothState}`);
      }
    }, true);

    return () => {
      subscription.remove();
    };
  }, [state.connectionStatus, state.connectedDevice, state.isScanning, startScan, addLog, managerInitialized]);

  // Load saved device on mount but don't start scanning automatically
  useEffect(() => {
    // Load saved device from storage
    const loadSavedDevice = async () => {
      try {
        const storedDevice = await AsyncStorage.getItem('selected_device');
        if (storedDevice) {
          const deviceInfo = JSON.parse(storedDevice);
          setState(prev => ({ ...prev, savedDevice: deviceInfo }));
          addLog(`Loaded saved device ${deviceInfo.name || deviceInfo.id} on startup`);
        }
      } catch (error) {
        addLog(`Failed to load saved device on startup: ${(error as Error).message}`);
      }
    };

    loadSavedDevice();

    // Cleanup on unmount
    return () => {
      if (bleManagerRef.current) {
        bleManagerRef.current.stopDeviceScan();
      }
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
      }
    };
  }, [managerInitialized, addLog]);

  // Function to save selected device to storage and state
  const saveSelectedDevice = useCallback(async (device: Device) => {
    try {
      const deviceInfo = {
        id: device.id,
        name: device.name || '',
        rssi: device.rssi,
        mtu: device.mtu
      };
      await AsyncStorage.setItem('selected_device', JSON.stringify(deviceInfo));
      addLog(`Saved device ${device.name || device.id} to storage`);

      // Update the state with the saved device
      setState(prev => ({ ...prev, savedDevice: deviceInfo }));
    } catch (error) {
      addLog(`Failed to save device to storage: ${(error as Error).message}`);
    }
  }, [addLog]);

  // Function to load selected device from storage
  const loadSelectedDevice = useCallback(async () => {
    try {
      const storedDevice = await AsyncStorage.getItem('selected_device');
      if (storedDevice) {
        const deviceInfo = JSON.parse(storedDevice);
        addLog(`Loaded device ${deviceInfo.name || deviceInfo.id} from storage`);

        // Update the state with the loaded device
        setState(prev => ({ ...prev, savedDevice: deviceInfo }));
        return deviceInfo;
      }
      // If no device found, clear the saved device in state
      setState(prev => ({ ...prev, savedDevice: null }));
      return null;
    } catch (error) {
      addLog(`Failed to load device from storage: ${(error as Error).message}`);
      return null;
    }
  }, [addLog]);

  // Function to clear selected device from storage and reset connections
  const clearSelectedDevice = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('selected_device');
      addLog('Cleared selected device from storage');

      // If currently connected to the saved device, disconnect first
      if (state.connectedDevice && state.savedDevice && state.connectedDevice.id === state.savedDevice.id) {
        await disconnectFromDevice();
        addLog('Disconnected from device as saved device was cleared');
      }

      // Update the state to clear the saved device and reset indicators
      setState(prev => ({
        ...prev,
        savedDevice: null,
        ledStatus: {
          ...prev.ledStatus,
          ready: false // Reset ready indicator
        }
      }));

      addLog('Saved device cleared and connection reset');
    } catch (error) {
      addLog(`Failed to clear device from storage: ${(error as Error).message}`);
    }
  }, [state.connectedDevice, state.savedDevice, disconnectFromDevice, addLog]);

  // Function to stop scanning
  const stopScan = useCallback(() => {
    if (bleManagerRef.current && state.isScanning) {
      try {
        bleManagerRef.current.stopDeviceScan();
        setState(prev => ({ ...prev, isScanning: false }));
        addLog('Scanning stopped by user');
      } catch (error) {
        addLog(`Failed to stop scanning: ${(error as Error).message}`);
      }
    } else {
      addLog('No active scan to stop');
    }
  }, [state.isScanning, addLog]);

  // Function to enable/disable auto-connect
  const toggleAutoConnect = useCallback(() => {
    setState(prev => {
      const newAutoConnectStatus = !prev.autoConnectEnabled;
      addLog(`Auto-connect ${newAutoConnectStatus ? 'enabled' : 'disabled'}`);
      return { ...prev, autoConnectEnabled: newAutoConnectStatus };
    });
  }, [addLog]);

  // Function to attempt auto-connect when saved device is detected
  const attemptAutoConnect = useCallback((device: Device) => {
    if (state.autoConnectEnabled && state.savedDevice && device.id === state.savedDevice.id) {
      addLog(`Auto-connecting to saved device: ${device.name || device.id}`);
      connectToDevice(device);
    }
  }, [state.autoConnectEnabled, state.savedDevice, connectToDevice, addLog]);

  return {
    state,
    startScan,
    stopScan,
    connectToDevice,
    disconnectFromDevice,
    toggleContact,
    sendCommand,
    addLog,
    bleManagerRef,
    saveSelectedDevice,
    loadSelectedDevice,
    clearSelectedDevice,
    toggleAutoConnect,
    attemptAutoConnect
  };
};