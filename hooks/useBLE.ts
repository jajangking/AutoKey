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
  connectedDeviceId: string | null; // Store only the ID in state
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
  rssiUpdateCounter: number;
}

export const useBLE = () => {
  const bleManagerRef = useRef<BleManager | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null); // Store actual Device instance in useRef
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

  const [state, setState] = useState<Omit<BLEState, 'connectedDevice'> & { connectedDeviceId: string | null }>({
    isScanning: false,
    connectedDeviceId: null, // Store only the ID in state
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
    autoConnectEnabled: false, // Track auto-connect status
    rssiUpdateCounter: 0
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
    // Guard: Prevent connecting if already connected or connecting
    if (state.connectionStatus !== 'disconnected') {
      addLog('Already connected or connecting to a device');
      
      // If we're trying to connect to a different device, cancel the current connection first
      if (state.connectedDeviceId && state.connectedDeviceId !== device.id) {
        try {
          if (bleManagerRef.current) {
            await bleManagerRef.current.cancelDeviceConnection(state.connectedDeviceId);
          }
        } catch (cancelError) {
          addLog(`Error canceling previous connection: ${(cancelError as Error).message}`);
        }
      }
      return;
    }

    if (!managerInitialized || !bleManagerRef.current) {
      addLog('BLE Manager not initialized');
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      return;
    }

    // Stop scanning if it's in progress
    if (state.isScanning) {
      try {
        bleManagerRef.current.stopDeviceScan();
      } catch (scanStopError) {
        addLog(`Error stopping scan: ${(scanStopError as Error).message}`);
      }
      setState(prev => ({ ...prev, isScanning: false }));
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    addLog(`Connecting to ${device.name || device.id}...`);

    try {
      // Guard: Check if device is already connected before attempting connection
      try {
        const isAlreadyConnected = await bleManagerRef.current.isDeviceConnected(device.id);
        if (isAlreadyConnected) {
          addLog(`Device ${device.id} is already connected`);
          // Cancel the connection attempt if it's somehow already connected
          await bleManagerRef.current.cancelDeviceConnection(device.id);
        }
      } catch (checkError) {
        // Ignore errors during connection check, just proceed with connection
        addLog(`Connection check failed (this is OK): ${(checkError as Error).message}`);
      }

      // Connect to the device using the device instance (not just the ID)
      // Using shorter timeout to prevent hanging
      const connectedDevice = await device.connect({ timeout: 8000, autoConnect: false });

      // Verify the device is actually connected before proceeding
      const isConnected = await connectedDevice.isConnected();
      if (!isConnected) {
        throw new Error('Device is not connected after connection attempt');
      }

      // Discover services and characteristics
      try {
        await connectedDevice.discoverAllServicesAndCharacteristics();

        // Store the actual device instance in the ref (not in state)
        connectedDeviceRef.current = connectedDevice;

        // Update state with only the device ID (not the full device object)
        // Also ensure the connected device is in the scannedDevices array
        setState(prev => ({
          ...prev,
          connectedDeviceId: connectedDevice.id,
          connectionStatus: 'connected',
          ledStatus: { ...prev.ledStatus, btConnected: true },
          scannedDevices: prev.scannedDevices.some(d => d.id === connectedDevice.id)
            ? prev.scannedDevices.map(d => 
                d.id === connectedDevice.id ? {...connectedDevice, rssi: d.rssi} : d
              ) // Update existing device with fresh data but preserve RSSI if available
            : [...prev.scannedDevices, connectedDevice] // Add device to array
        }));

        addLog(`Connected to ${connectedDevice.name || connectedDevice.id}`);

        // Subscribe to status notifications
        subscribeToStatusNotifications(connectedDevice);
      } catch (discoverErr) {
        addLog(`Failed to discover services: ${(discoverErr as Error).message}`);

        // Still consider it connected if the connection succeeded, even if service discovery failed
        // Store the actual device instance in the ref (not in state)
        connectedDeviceRef.current = connectedDevice;

        // Update state with only the device ID (not the full device object)
        // Also ensure the connected device is in the scannedDevices array
        setState(prev => ({
          ...prev,
          connectedDeviceId: connectedDevice.id,
          connectionStatus: 'connected',
          ledStatus: { ...prev.ledStatus, btConnected: true },
          scannedDevices: prev.scannedDevices.some(d => d.id === connectedDevice.id)
            ? prev.scannedDevices.map(d => 
                d.id === connectedDevice.id ? {...connectedDevice, rssi: d.rssi} : d
              ) // Update existing device with fresh data but preserve RSSI if available
            : [...prev.scannedDevices, connectedDevice] // Add device to array
        }));

        addLog(`Connected to ${connectedDevice.name || connectedDevice.id} (with limited functionality)`);
      }
    } catch (err) {
      addLog(`Connection failed: ${(err as Error).message}`);
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        connectedDeviceId: null, // Ensure connectedDeviceId is null on failure
        ledStatus: { ...prev.ledStatus, btConnected: false }
      }));

      // If auto-connect is enabled, restart scanning to try again when device becomes available
      if (state.autoConnectEnabled && state.savedDevice) {
        addLog('Auto-connect enabled: restarting scan after connection failure');
        setTimeout(() => {
          // Only start scanning if not already connected and not currently scanning
          if (state.connectionStatus === 'disconnected' && !state.isScanning) {
            startScan();
          }
        }, 3000); // Wait 3 seconds before retrying
      }
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
    if (!state.connectedDeviceId) {
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

      await bleManagerRef.current.cancelDeviceConnection(state.connectedDeviceId);

      // Clear the device reference
      connectedDeviceRef.current = null;

      // Update state to reflect disconnection
      setState(prev => ({
        ...prev,
        connectedDeviceId: null,
        connectionStatus: 'disconnected',
        ledStatus: { btConnected: false, ready: false, wifi: false },
        contactStatus: false
      }));
      addLog(`Disconnected from device ID: ${state.connectedDeviceId}`);
    } catch (err) {
      addLog(`Disconnect error: ${(err as Error).message}`);
    }
  }, [state.connectedDeviceId, addLog, managerInitialized]);

  // Handle device disconnection
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    const subscription = bleManagerRef.current.onDeviceDisconnected(
      (error: BleError | null, device: Device) => {
        console.log('Device disconnected event triggered:', device.id, 'Expected:', state.connectedDeviceId);
        if (device.id === state.connectedDeviceId) {
          addLog(`Device disconnected: ${device.name || device.id}`);
          // Clear the device reference
          connectedDeviceRef.current = null;
          // Update saved devices to reflect disconnection
          setState(prev => ({
            ...prev,
            connectedDeviceId: null,
            connectionStatus: 'disconnected',
            ledStatus: { btConnected: false, ready: false, wifi: false },
            contactStatus: false
          }));

          // Automatically start scanning again after a delay if auto-connect is enabled
          if (state.autoConnectEnabled) {
            setTimeout(() => {
              addLog('Auto-connect enabled: starting scan after disconnection');
              startScan();
            }, 2000);
          }
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [state.connectedDeviceId, startScan, addLog, managerInitialized]);

  // Monitor connection state changes more proactively
  useEffect(() => {
    let monitorInterval: NodeJS.Timeout | null = null;

    if (state.connectionStatus === 'connected' && state.connectedDeviceId) {
      monitorInterval = setInterval(async () => {
        try {
          if (bleManagerRef.current && state.connectedDeviceId) {
            // Use BleManager to check if device is connected
            const isActuallyConnected = await bleManagerRef.current.isDeviceConnected(state.connectedDeviceId);
            if (!isActuallyConnected) {
              console.log('Device reported as connected but actually disconnected');
              addLog(`Device ID ${state.connectedDeviceId} is no longer connected`);
              
              // Clear the device reference
              connectedDeviceRef.current = null;

              // Update state to reflect disconnection
              setState(prev => ({
                ...prev,
                connectedDeviceId: null,
                connectionStatus: 'disconnected',
                ledStatus: { btConnected: false, ready: false, wifi: false },
                contactStatus: false
              }));

              // Automatically start scanning again after a delay if auto-connect is enabled
              if (state.autoConnectEnabled) {
                setTimeout(() => {
                  addLog('Auto-connect enabled: starting scan after connection status monitor detected disconnection');
                  startScan();
                }, 2000);
              }
            }
          }
        } catch (error) {
          console.error('Error checking connection status:', error);
          // If we can't check the connection status, assume it's disconnected
          addLog(`Error checking connection status, assuming disconnected`);
          
          // Clear the device reference
          connectedDeviceRef.current = null;
          
          // Update state to reflect disconnection
          setState(prev => ({
            ...prev,
            connectedDeviceId: null,
            connectionStatus: 'disconnected',
            ledStatus: { btConnected: false, ready: false, wifi: false },
            contactStatus: false
          }));

          // Automatically start scanning again after a delay if auto-connect is enabled
          if (state.autoConnectEnabled) {
            setTimeout(() => {
              addLog('Auto-connect enabled: starting scan after connection status error');
              startScan();
            }, 2000);
          }
        }
      }, 2000); // Check every 2 seconds
    }

    // Cleanup function
    return () => {
      if (monitorInterval) {
        clearInterval(monitorInterval);
      }
    };
  }, [state.connectionStatus, state.connectedDeviceId]);

  // RSSI reading loop - reads RSSI from connected device every 300-500ms
  useEffect(() => {
    let rssiIntervalId: NodeJS.Timeout | null = null;

    if (connectedDeviceRef.current && state.connectionStatus === 'connected') {
      // Start RSSI reading loop when device is connected
      rssiIntervalId = setInterval(async () => {
        try {
          // Use the device instance from the ref (not from state)
          const deviceInstance = connectedDeviceRef.current;
          
          // GUARD: Check if device exists and is connected before reading RSSI
          if (!deviceInstance) {
            console.log('No device instance available, stopping RSSI polling');
            clearInterval(rssiIntervalId);
            return;
          }
          
          // GUARD: Check if device is actually connected before reading RSSI
          const isConnected = await deviceInstance.isConnected();
          if (!isConnected) {
            console.log('Device is not connected, stopping RSSI polling');
            clearInterval(rssiIntervalId);
            return;
          }

          // Read RSSI from connected device (MUST use device.readRSSI())
          const rssiResult = await deviceInstance.readRSSI();
          // Extract the RSSI value from the result
          const rssiValue = typeof rssiResult === 'object' && rssiResult.hasOwnProperty('rssi')
            ? rssiResult.rssi
            : rssiResult;

          // Update the device's RSSI property in the scannedDevices array for UI display
          setState(prev => ({
            ...prev,
            scannedDevices: prev.scannedDevices.map(d =>
              d.id === deviceInstance.id ? {...d, rssi: rssiValue} : d
            ),
            // Also update the saved device RSSI if this is the connected device
            savedDevice: prev.savedDevice && prev.savedDevice.id === deviceInstance.id 
              ? {...prev.savedDevice, rssi: rssiValue} 
              : prev.savedDevice,
            rssiUpdateCounter: prev.rssiUpdateCounter + 1
          }));
        } catch (error) {
          // Stop RSSI polling on error to prevent "Unknown error occurred" spam
          console.log(`RSSI reading error, stopping polling: ${(error as Error).message}`);
          if (rssiIntervalId) {
            clearInterval(rssiIntervalId);
          }
        }
      }, 500); // Read RSSI every 500ms (within 300-500ms range)
    }

    // Cleanup function - stops timer on disconnect
    return () => {
      if (rssiIntervalId) {
        clearInterval(rssiIntervalId);
      }
    };
  }, [state.connectionStatus]); // Only depend on connection status, not device instance

  // Separate effect to monitor connection status and handle disconnections
  useEffect(() => {
    let connectionMonitorId: NodeJS.Timeout | null = null;

    if (connectedDeviceRef.current && state.connectionStatus === 'connected') {
      // Start monitoring connection status separately
      connectionMonitorId = setInterval(async () => {
        try {
          // Use the device instance from the ref (not from state)
          const deviceInstance = connectedDeviceRef.current;

          // GUARD: Check if device exists
          if (!deviceInstance) {
            console.log('No device instance available in connection monitor, stopping monitor');
            if (connectionMonitorId) {
              clearInterval(connectionMonitorId);
            }
            return;
          }

          const isConnected = await deviceInstance.isConnected();
          if (!isConnected) {
            addLog(`Connected device ${deviceInstance.name || deviceInstance.id} is no longer connected`);
            
            // Update state to reflect disconnection
            setState(prev => ({
              ...prev,
              connectedDeviceId: null,
              connectionStatus: 'disconnected',
              ledStatus: { btConnected: false, ready: false, wifi: false },
              contactStatus: false
            }));

            // Automatically start scanning again after a delay if auto-connect is enabled
            if (state.autoConnectEnabled) {
              setTimeout(() => {
                addLog('Auto-connect enabled: starting scan after connection monitor detected disconnection');
                startScan();
              }, 2000);
            }
          }
        } catch (error) {
          addLog(`Error checking device connection: ${(error as Error).message}`);
        }
      }, 2000); // Check connection status every 2 seconds
    }

    // Cleanup function
    return () => {
      if (connectionMonitorId) {
        clearInterval(connectionMonitorId);
      }
    };
  }, [state.connectionStatus, state.autoConnectEnabled, startScan]);

  // Check if saved device is active and update ready indicator
  useEffect(() => {
    if (state.savedDevice && state.connectedDeviceId && state.savedDevice.id === state.connectedDeviceId) {
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
  }, [state.savedDevice, state.connectedDeviceId]);

  // Handle auto-connect when saved device is found during scanning
  useEffect(() => {
    if (state.autoConnectEnabled &&
        state.savedDevice &&
        state.scannedDevices.length > 0 &&
        state.connectionStatus === 'disconnected') { // Only attempt auto-connect if not already connected

      const savedDeviceFound = state.scannedDevices.find(device => device.id === state.savedDevice!.id);
      if (savedDeviceFound) {
        addLog(`Auto-connect enabled and saved device found, attempting connection...`);
        connectToDevice(savedDeviceFound);
      }
    }
  }, [state.autoConnectEnabled, state.savedDevice, state.scannedDevices, state.connectionStatus, connectToDevice]);

  // Monitor Bluetooth state changes - SINGLE subscription with proper cleanup
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    let lastBluetoothState: string | null = null;
    
    const subscription = bleManagerRef.current.onStateChange((bluetoothState) => {
      // Only log if state actually changed to prevent spam
      if (bluetoothState !== lastBluetoothState) {
        console.log('Bluetooth state changed to:', bluetoothState);
        lastBluetoothState = bluetoothState;
        
        // Update the state with the current Bluetooth state
        setState(prev => ({ ...prev, bluetoothState }));

        if (bluetoothState === 'PoweredOn') {
          addLog('Bluetooth is powered on. Ready to scan when user initiates.');
        } else if (bluetoothState !== 'PoweredOn' && state.connectionStatus === 'connected') {
          // If Bluetooth is turned off while connected, update the state
          setState(prev => ({
            ...prev,
            connectionStatus: 'disconnected',
            connectedDeviceId: null,
            ledStatus: { ...prev.ledStatus, btConnected: false }
          }));
          addLog(`Bluetooth turned off. Connection status: ${bluetoothState}`);
        } else if (bluetoothState === 'PoweredOn' && state.connectionStatus === 'disconnected' && state.autoConnectEnabled && state.savedDevice) {
          // If Bluetooth is turned back on and auto-connect is enabled, start scanning for saved device
          addLog('Bluetooth powered on and auto-connect enabled: starting scan for saved device');
          setTimeout(() => {
            startScan();
          }, 1000); // Small delay to ensure Bluetooth is fully ready
        }
      }
    }, true);

    // Cleanup function
    return () => {
      subscription.remove();
      lastBluetoothState = null;
    };
  }, [state.connectionStatus, state.connectedDeviceId, state.isScanning, startScan, addLog, managerInitialized]);

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
      if (state.connectedDeviceId && state.savedDevice && state.connectedDeviceId === state.savedDevice.id) {
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
  }, [state.connectedDeviceId, state.savedDevice, disconnectFromDevice, addLog]);

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