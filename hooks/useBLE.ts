import { useState, useEffect, useCallback, useRef } from 'react';
import { BleManager, Device, BleError, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorHandler, ErrorType, withErrorHandler } from '@/utils/errorHandler';
import { loadAllSettings, saveAllSettings } from '@/utils/settingsManager';

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
  lastBluetoothStateChangeTime: number; // Track when the last Bluetooth state change occurred
}

export const useBLE = () => {
  const bleManagerRef = useRef<BleManager | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null); // Store actual Device instance in useRef
  const [managerInitialized, setManagerInitialized] = useState(false);

  // Add log entry
  const addLog = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()}: ${message}`].slice(-20) // Keep last 20 logs
    }));
  }, []);

  // Load settings from AsyncStorage when initializing
  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        // First, try to load from the unified settings system
        const allSettings = await loadAllSettings();
        let autoConnectValue = allSettings.autoConnectEnabled;
        
        // If not found in unified settings, try legacy storage
        if (autoConnectValue === undefined) {
          const autoConnectEnabled = await AsyncStorage.getItem('autoConnectEnabled');
          if (autoConnectEnabled !== null) {
            autoConnectValue = autoConnectEnabled === 'true';
          }
        }
        
        // If we have a value, update state and ensure it's saved to unified settings
        if (autoConnectValue !== undefined) {
          setState(prev => ({
            ...prev,
            autoConnectEnabled: autoConnectValue
          }));
          
          // Ensure the value is also saved to unified settings system for consistency
          try {
            await saveAllSettings({...allSettings, autoConnectEnabled: autoConnectValue});
          } catch (saveError) {
            console.error('Failed to save auto-connect setting to unified system:', saveError);
          }
        }
      } catch (error) {
        console.error('Failed to load initial settings:', error);
        
        // Fallback to legacy storage if unified settings fail
        try {
          const autoConnectEnabled = await AsyncStorage.getItem('autoConnectEnabled');
          if (autoConnectEnabled !== null) {
            setState(prev => ({
              ...prev,
              autoConnectEnabled: autoConnectEnabled === 'true'
            }));
          }
        } catch (fallbackError) {
          console.error('Fallback to legacy settings also failed:', fallbackError);
        }
      }
    };

    loadInitialSettings();
  }, []);

  // Initialize BleManager only on the client side after native modules are available
  useEffect(() => {
    // Only initialize on the client side (mobile device)
    if (typeof window !== 'undefined') {
      // Wait a bit to ensure native modules are loaded
      const timer: number | NodeJS.Timeout = setTimeout(() => {
        try {
          if (!bleManagerRef.current) {
            bleManagerRef.current = new BleManager();
            setManagerInitialized(true);

            // Update state with the manager
            setState(prev => ({ ...prev, manager: bleManagerRef.current }));

            console.log('BLE Manager initialized successfully');
            
            // Check for any existing connections after initialization
            setTimeout(async () => {
              if (bleManagerRef.current) {
                try {
                  // Get all connected devices
                  const connectedDevices = await bleManagerRef.current.connectedDevices([SERVICE_UUID]);

                  if (connectedDevices && connectedDevices.length > 0) {
                    // If there are connected devices, update our state to reflect this
                    const device = connectedDevices[0]; // Take the first connected device

                    // Guard: Validate device before using it
                    if (device && device.id) {
                      // Update state to reflect that we're connected
                      setState(prev => ({
                        ...prev,
                        connectedDeviceId: device.id,
                        connectionStatus: 'connected',
                        ledStatus: { ...prev.ledStatus, btConnected: true },
                        scannedDevices: prev.scannedDevices.some(d => d.id === device.id)
                          ? prev.scannedDevices.map(d =>
                              d.id === device.id ? device : d
                            ) // Update existing device with fresh data
                          : [...prev.scannedDevices, device] // Add device to array
                      }));

                      addLog(`Reconnected to device: ${device.name || device.id} (found on startup)`);

                      // Subscribe to status notifications for this device
                      subscribeToStatusNotifications(device);
                    }
                  }
                } catch (error) {
                  console.log('Error checking for existing connections:', error);
                  addLog(`Error checking for existing connections: ${(error as Error).message}`);
                }
              }
            }, 1000); // Delay slightly to ensure manager is fully initialized
          }
        } catch (error) {
          console.error('Failed to initialize BleManager:', error);
          addLog(`BLE Manager initialization failed: ${(error as Error).message}`);
        }
      }, 500); // Small delay to ensure native modules are loaded

      // Cleanup function
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
        if (bleManagerRef.current) {
          try {
            bleManagerRef.current.destroy();
          } catch (error) {
            // Handle the specific error that causes the crash
            let destroyErrorMessage = '';
            if (error instanceof Error) {
              destroyErrorMessage = error.message || 'Unknown error';
              if (destroyErrorMessage.includes('Parameter specified as non-null is null')) {
                destroyErrorMessage = 'Error destroying BleManager: A known error occurred. This is probably a bug!';
              }
            } else {
              destroyErrorMessage = 'Error destroying BleManager: A known error occurred. This is probably a bug!';
            }
            console.error('Error destroying BleManager:', error);
            addLog(`Error destroying BleManager: ${destroyErrorMessage}`);
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
    rssiUpdateCounter: 0,
    lastBluetoothStateChangeTime: 0 // Initialize to 0
  });

  // Keep references to subscriptions to properly clean them up
  const statusSubscriptionRef = useRef<any | null>(null);

  // Request Bluetooth permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      // Check Android version and request appropriate permissions
      if (Platform.Version >= 31) { // Android 12+ (API 31+)
        // Request all required permissions at once
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
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
          
          ErrorHandler.handleError(ErrorType.PERMISSION_DENIED, 'Bluetooth permissions denied');
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
          ErrorHandler.handleError(ErrorType.PERMISSION_DENIED, 'Location permission denied');
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
          addLog('Failed to enable Bluetooth automatically. Please enable it manually.');
          ErrorHandler.handleError(ErrorType.BLUETOOTH_DISABLED, 'Bluetooth is disabled');
          return;
        }
        return;
      } else {
        addLog('Bluetooth is powered on. Starting scan...');
      }
    } catch (error) {
      // Handle the specific error that causes the crash
      let bluetoothStateErrorMessage = '';
      if (error instanceof Error) {
        bluetoothStateErrorMessage = error.message || 'Unknown error';
        if (bluetoothStateErrorMessage.includes('Parameter specified as non-null is null')) {
          bluetoothStateErrorMessage = 'Error checking Bluetooth state: A known error occurred. This is probably a bug!';
        }
      } else {
        bluetoothStateErrorMessage = 'Error checking Bluetooth state: A known error occurred. This is probably a bug!';
      }
      addLog(bluetoothStateErrorMessage);
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
          // Handle error case with proper null checks to prevent crashes
          if (error) {
            // Check if the error is related to Bluetooth being off
            if (error.message?.toLowerCase().includes('powered off') ||
                error.message?.toLowerCase().includes('bluetoothle is powered off')) {
              addLog(`Bluetooth is powered off: ${error.message || 'Unknown error'}`);
              setState(prev => ({ ...prev, isScanning: false }));
              if (bleManagerRef.current) {
                try {
                  bleManagerRef.current.stopDeviceScan();
                } catch (stopError) {
                  addLog(`Error stopping scan: ${(stopError as Error)?.message || 'Unknown error'}`);
                }
              }
              return;
            }
            // Check if the error is related to permissions
            else if (error.message?.toLowerCase().includes('permission') ||
                     error.message?.toLowerCase().includes('authorization')) {
              addLog(`Permission error: ${error.message || 'Unknown permission error'}. Please check app permissions.`);
            } else {
              // Handle the specific error that causes the crash
              let scanErrorMessage = error.message || 'Unknown error';
              if (scanErrorMessage.includes('Parameter specified as non-null is null')) {
                scanErrorMessage = 'Scan error: A known error occurred. This is probably a bug!';
              }
              addLog(`Scan error: ${scanErrorMessage}`);
            }

            setState(prev => ({ ...prev, isScanning: false }));
            if (bleManagerRef.current) {
              try {
                bleManagerRef.current.stopDeviceScan();
              } catch (stopError) {
                addLog(`Error stopping scan: ${(stopError as Error)?.message || 'Unknown error'}`);
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
                        addLog(`Error stopping scan: ${(stopError as Error)?.message || 'Unknown error'}`);
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
      // Handle the specific error that causes the crash
      let scanStartErrorMessage = '';
      if (err instanceof Error) {
        scanStartErrorMessage = err.message || 'Unknown error';
        if (scanStartErrorMessage.includes('Parameter specified as non-null is null')) {
          scanStartErrorMessage = 'Failed to start scan: A known error occurred. This is probably a bug!';
        }
      } else {
        scanStartErrorMessage = 'Failed to start scan: A known error occurred. This is probably a bug!';
      }
      addLog(`Failed to start scan: ${scanStartErrorMessage}`);
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [state.isScanning, requestPermissions, addLog, managerInitialized]);

  // Connect to a specific device
  const connectToDevice = useCallback(async (device: Device) => {
    // Guard: Validate device parameter
    if (!device || !device.id) {
      addLog('Invalid device: device or device.id is null/undefined');
      return;
    }

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

      // Connect to the device using the bleManager
      // Using shorter timeout to prevent hanging
      const connectedDevice = await bleManagerRef.current.connectToDevice(device.id, { timeout: 8000 });

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
                d.id === connectedDevice.id ? connectedDevice : d
              ) // Update existing device with fresh data
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
                d.id === connectedDevice.id ? connectedDevice : d
              ) // Update existing device with fresh data
            : [...prev.scannedDevices, connectedDevice] // Add device to array
        }));

        addLog(`Connected to ${connectedDevice.name || connectedDevice.id} (with limited functionality)`);
      }
    } catch (err) {
      // Handle the specific error that causes the crash
      let errorMessage = '';
      if (err instanceof Error) {
        errorMessage = err.message || 'Unknown error';
        if (errorMessage.includes('Parameter specified as non-null is null')) {
          errorMessage = 'Connection failed: A known error occurred. This is probably a bug!';
        } else {
          errorMessage = `Connection failed: ${errorMessage}`;
        }
      } else {
        errorMessage = 'Connection failed: A known error occurred. This is probably a bug!';
      }

      addLog(errorMessage);
      ErrorHandler.handleError(ErrorType.CONNECTION_TIMEOUT, errorMessage, err);

      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        connectedDeviceId: null, // Ensure connectedDeviceId is null on failure
        ledStatus: { ...prev.ledStatus, btConnected: false }
      }));

      // If auto-connect is enabled, restart scanning to try again when device becomes available
      if (state.autoConnectEnabled) {
        addLog('Auto-connect enabled: restarting scan after connection failure');
        const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
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
    // Guard: Validate device parameter
    if (!device || !device.id) {
      addLog('Invalid device for subscription: device or device.id is null/undefined');
      return;
    }

    if (!bleManagerRef.current) {
      addLog('BLE Manager not initialized for subscribing to notifications');
      return;
    }

    try {
      // First, unsubscribe from any existing subscription
      if (statusSubscriptionRef.current) {
        try {
          statusSubscriptionRef.current.remove();
        } catch (unsubscribeError) {
          addLog(`Error unsubscribing from previous notifications: ${(unsubscribeError as Error)?.message || 'Unknown error'}`);
        }
        statusSubscriptionRef.current = null;
      }

      // Subscribe to status characteristic notifications
      const subscription = device.monitorCharacteristicForService(
        SERVICE_UUID,
        STATUS_CHARACTERISTIC_UUID,
        (error: BleError | null, characteristic: any | null) => {
          if (error) {
            // Handle the specific error that causes the crash
            let notificationErrorMessage = error.message || 'Unknown error';
            if (notificationErrorMessage.includes('Parameter specified as non-null is null')) {
              notificationErrorMessage = 'Notification error: A known error occurred. This is probably a bug!';
            }
            addLog(notificationErrorMessage);
            return;
          }

          if (characteristic?.value) {
            try {
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
            } catch (processError) {
              addLog(`Error processing notification: ${(processError as Error)?.message || 'Unknown error'}`);
            }
          }
        }
      );

      // Store reference to subscription for cleanup
      statusSubscriptionRef.current = subscription;
      addLog('Subscribed to status notifications');
    } catch (err) {
      // Handle the specific error that causes the crash
      let subscribeErrorMessage = '';
      if (err instanceof Error) {
        subscribeErrorMessage = err.message || 'Unknown error';
        if (subscribeErrorMessage.includes('Parameter specified as non-null is null')) {
          subscribeErrorMessage = 'Failed to subscribe to notifications: A known error occurred. This is probably a bug!';
        }
      } else {
        subscribeErrorMessage = 'Failed to subscribe to notifications: A known error occurred. This is probably a bug!';
      }
      addLog(`Failed to subscribe to notifications: ${subscribeErrorMessage}`);
    }
  }, [addLog]);

  // Safe wrapper for BLE operations
  const safeBleOperation = useCallback(async (operation: () => Promise<any>, operationName: string) => {
    if (!bleManagerRef.current || !managerInitialized) {
      addLog(`BLE Manager not initialized for ${operationName}`);
      return null;
    }

    try {
      return await operation();
    } catch (error) {
      let errorMessage = '';
      if (error instanceof Error) {
        errorMessage = error.message || 'Unknown error';
        if (errorMessage.includes('Parameter specified as non-null is null')) {
          errorMessage = `${operationName}: A known error occurred. This is probably a bug!`;
        } else {
          errorMessage = `${operationName}: ${errorMessage}`;
        }
      } else {
        errorMessage = `${operationName}: A known error occurred. This is probably a bug!`;
      }
      addLog(errorMessage);
      return null;
    }
  }, [addLog, managerInitialized]);

  // Send command to ESP32
  const sendCommand = useCallback(async (command: number): Promise<boolean> => {
    if (state.connectionStatus !== 'connected' || !connectedDeviceRef.current) {
      addLog('Not connected to device');
      return false;
    }

    const result = await safeBleOperation(async () => {
      const device = connectedDeviceRef.current;
      if (!device) {
        throw new Error('No device instance available');
      }

      // Prepare command data as a single-byte array
      const commandBuffer = new Uint8Array([command]);
      // Convert to base64 for sending
      const commandData = btoa(String.fromCharCode(...commandBuffer));

      // Write to control characteristic
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CONTROL_CHARACTERISTIC_UUID,
        commandData
      );

      addLog(`Sent command: 0x${command.toString(16).padStart(2, '0').toUpperCase()}`);
      return true;
    }, 'sendCommand');

    return result !== null;
  }, [state.connectionStatus, addLog, safeBleOperation]);

  // Specific command functions based on the mapping
  const sendRelayCH1Command = useCallback(async (on: boolean): Promise<boolean> => {
    const command = on ? 0x01 : 0x10; // 0x01 = Relay CH1 ON, 0x10 = Relay CH1 OFF
    return await sendCommand(command);
  }, [sendCommand]);

  const sendRelayCH2Command = useCallback(async (on: boolean): Promise<boolean> => {
    const command = on ? 0x02 : 0x20; // 0x02 = Relay CH2 ON, 0x20 = Relay CH2 OFF
    return await sendCommand(command);
  }, [sendCommand]);

  const sendBuzzerCommand = useCallback(async (on: boolean): Promise<boolean> => {
    const command = on ? 0xB1 : 0xB0; // 0xB1 = Buzzer ON, 0xB0 = Buzzer OFF
    return await sendCommand(command);
  }, [sendCommand]);

  const sendButtonPulseCommand = useCallback(async (): Promise<boolean> => {
    const command = 0xC1; // 0xC1 = Button Pulse
    return await sendCommand(command);
  }, [sendCommand]);

  const sendLEDCommand = useCallback(async (on: boolean): Promise<boolean> => {
    const command = on ? 0xE1 : 0xE0; // 0xE1 = LED ON, 0xE0 = LED OFF
    return await sendCommand(command);
  }, [sendCommand]);

  // Toggle contact state
  const toggleContact = useCallback(async () => {
    if (state.connectionStatus !== 'connected') {
      addLog('Cannot toggle contact - not connected');
      return;
    }

    const newStatus = !state.contactStatus;
    
    const success = await sendRelayCH1Command(newStatus);
    if (success) {
      addLog(`Contact ${newStatus ? 'ON' : 'OFF'} command sent successfully`);
      
      // Update local state to reflect the command sent
      setState(prev => ({
        ...prev,
        contactStatus: newStatus
      }));
    }
  }, [state.connectionStatus, state.contactStatus, sendRelayCH1Command, addLog]);

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
        try {
          statusSubscriptionRef.current.remove();
        } catch (unsubscribeError) {
          addLog(`Error removing notification subscription: ${(unsubscribeError as Error)?.message || 'Unknown error'}`);
        }
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
      // Don't treat intentional disconnections as errors
      // ErrorHandler.handleError(ErrorType.DISCONNECTED, `Disconnected from device ID: ${state.connectedDeviceId}`);
    } catch (err) {
      // Handle the specific error that causes the crash
      let disconnectErrorMessage = '';
      if (err instanceof Error) {
        disconnectErrorMessage = err.message || 'Unknown error';
        if (disconnectErrorMessage.includes('Parameter specified as non-null is null')) {
          disconnectErrorMessage = 'Disconnect error: A known error occurred. This is probably a bug!';
        }
      } else {
        disconnectErrorMessage = 'Disconnect error: A known error occurred. This is probably a bug!';
      }
      addLog(disconnectErrorMessage);
      ErrorHandler.handleError(ErrorType.UNKNOWN, disconnectErrorMessage, err);
    }
  }, [state.connectedDeviceId, addLog, managerInitialized]);

  // Handle device disconnection
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    const subscription = bleManagerRef.current.onDeviceDisconnected(
      state.connectedDeviceId || '', // Device ID to listen for disconnection
      (error: BleError | null, device: Device | null) => {
        if (error) {
          // Handle disconnection error with proper null checks
          let errorMessage = error.message || 'Unknown error';
          if (errorMessage.includes('Parameter specified as non-null is null')) {
            errorMessage = 'Device disconnection error: A known error occurred. This is probably a bug!';
          }
          addLog(errorMessage);
          ErrorHandler.handleError(ErrorType.DISCONNECTED, errorMessage, error);
        } else if (device) {
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
              const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                addLog('Auto-connect enabled: starting scan after disconnection');
                startScan();
              }, 2000);
            } else {
              // Only log for unexpected disconnections (not intentional ones)
              console.log('Device disconnected unexpectedly:', device.id);
            }
          }
        }
      }
    );

    return () => {
      try {
        subscription?.remove();
      } catch (cleanupError) {
        addLog(`Error cleaning up disconnection subscription: ${(cleanupError as Error)?.message || 'Unknown error'}`);
      }
    };
  }, [state.connectedDeviceId, startScan, addLog, managerInitialized]);

  // Effect to handle reconnection attempts when device is in range but not connected
  useEffect(() => {
    let reconnectInterval: number | NodeJS.Timeout | null = null;
    let lastReconnectAttemptTime: number | null = null;
    const RECONNECT_DEBOUNCE_TIME = 10000; // 10 seconds debounce time for reconnection attempts

    const setupReconnectInterval = () => {
      // Clear any existing interval
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }

      // Only start the reconnection interval if auto-connect is enabled, we have a saved device,
      // we're not connected, and we're not currently scanning
      if (state.autoConnectEnabled &&
          state.savedDevice &&
          !state.connectedDeviceId &&
          !state.isScanning) {
        
        // Start periodic scanning to detect when saved device comes back online
        reconnectInterval = setInterval(() => {
          // Double-check conditions before starting scan to avoid conflicts
          const now = Date.now();
          const shouldAttemptReconnect = !lastReconnectAttemptTime || (now - lastReconnectAttemptTime) > RECONNECT_DEBOUNCE_TIME;
          
          if (state.autoConnectEnabled &&
              state.savedDevice &&
              !state.connectedDeviceId &&
              !state.isScanning &&
              shouldAttemptReconnect) {
            addLog('Attempting to reconnect to saved device...');
            lastReconnectAttemptTime = now;
            startScan();
          } else if (!shouldAttemptReconnect) {
            addLog('Reconnection attempt debounced - waiting before next attempt');
          }
        }, 20000); // Increase interval to 20 seconds to reduce frequency and avoid conflicts
      } else {
        // If conditions aren't met, ensure interval is cleared
        reconnectInterval = null;
      }
    };

    // Set up the interval initially
    setupReconnectInterval();

    // Return cleanup function
    return () => {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
      lastReconnectAttemptTime = null;
    };
  }, [state.autoConnectEnabled, state.savedDevice, state.connectedDeviceId, state.isScanning, startScan]);

  // Monitor connection state changes more proactively
  useEffect(() => {
    let monitorInterval: number | NodeJS.Timeout | null = null;

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
                const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                  addLog('Auto-connect enabled: starting scan after connection status monitor detected disconnection');
                  startScan();
                }, 2000);
              }
            }
          }
        } catch (error) {
          // Handle the specific error that causes the crash
          let connectionCheckErrorMessage = '';
          if (error instanceof Error) {
            connectionCheckErrorMessage = error.message || 'Unknown error';
            if (connectionCheckErrorMessage.includes('Parameter specified as non-null is null')) {
              connectionCheckErrorMessage = 'Error checking connection status: A known error occurred. This is probably a bug!';
            } else {
              connectionCheckErrorMessage = `Error checking connection status: ${connectionCheckErrorMessage}`;
            }
          } else {
            connectionCheckErrorMessage = 'Error checking connection status: A known error occurred. This is probably a bug!';
          }

          addLog(connectionCheckErrorMessage);
          console.error('Error checking connection status:', error);

          // Rather than immediately disconnecting, we'll try to verify the connection status
          // Sometimes temporary network issues can cause this check to fail
          try {
            if (bleManagerRef.current && state.connectedDeviceId) {
              // Double-check the connection status
              const doubleCheck = await bleManagerRef.current.isDeviceConnected(state.connectedDeviceId);
              if (!doubleCheck) {
                // Confirmed: device is disconnected
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
                  const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                    addLog('Auto-connect enabled: starting scan after connection status error');
                    startScan();
                  }, 2000);
                }
              } else {
                // The connection is still good, just had a temporary issue
                addLog('Connection check recovered - connection still active');
              }
            }
          } catch (doubleCheckError) {
            console.log('Double check also failed:', (doubleCheckError as Error).message);
            // If double check also fails, assume disconnection
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
              const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                addLog('Auto-connect enabled: starting scan after connection status error');
                startScan();
              }, 2000);
            }
          }
        }
      }, 3000); // Check every 3 seconds to be less aggressive
    }

    // Cleanup function
    return () => {
      if (monitorInterval) {
        try {
          clearInterval(monitorInterval);
        } catch (clearError) {
          addLog(`Error clearing connection monitor interval: ${(clearError as Error)?.message || 'Unknown error'}`);
        }
      }
    };
  }, [state.connectionStatus, state.connectedDeviceId]);

  // RSSI reading loop - reads RSSI from connected device every 300-500ms
  useEffect(() => {
    let rssiIntervalId: number | NodeJS.Timeout | null = null;

    if (connectedDeviceRef.current && state.connectionStatus === 'connected') {
      // Start RSSI reading loop when device is connected
      rssiIntervalId = setInterval(async () => {
        try {
          // Use the device instance from the ref (not from state)
          const deviceInstance = connectedDeviceRef.current;

          // GUARD: Check if device exists and is connected before reading RSSI
          if (!deviceInstance) {
            console.log('No device instance available, stopping RSSI polling');
            if (rssiIntervalId) {
              clearInterval(rssiIntervalId);
            }
            return;
          }

          // GUARD: Check if device is actually connected before reading RSSI
          try {
            const isConnected = await deviceInstance.isConnected();
            if (!isConnected) {
              console.log('Device is not connected, stopping RSSI polling');
              if (rssiIntervalId) {
                clearInterval(rssiIntervalId);
              }
              return;
            }
          } catch (connCheckError) {
            // If connection check fails, assume device is disconnected
            console.log('Connection check failed, stopping RSSI polling');
            if (rssiIntervalId) {
              clearInterval(rssiIntervalId);
            }
            return;
          }

          // Read RSSI from connected device (MUST use device.readRSSI())
          const rssiResult = await deviceInstance.readRSSI();
          // Extract the RSSI value from the result - ensure it's a number
          let rssiValue: number | undefined;
          if (typeof rssiResult === 'object' && rssiResult && 'rssi' in rssiResult) {
            rssiValue = rssiResult.rssi as number;
          } else if (typeof rssiResult === 'number') {
            rssiValue = rssiResult;
          }

          // Update the device's RSSI property in the scannedDevices array for UI display
          if (rssiValue !== undefined) {
            setState(prev => ({
              ...prev,
              scannedDevices: prev.scannedDevices.map(d =>
                d.id === deviceInstance.id ? Object.assign({}, d, { rssi: rssiValue }) : d
              ),
              // Also update the saved device RSSI if this is the connected device
              savedDevice: prev.savedDevice && prev.savedDevice.id === deviceInstance.id && rssiValue !== undefined
                ? {
                    id: prev.savedDevice.id,
                    name: prev.savedDevice.name,
                    rssi: rssiValue,
                    mtu: prev.savedDevice.mtu
                  }
                : prev.savedDevice,
              rssiUpdateCounter: prev.rssiUpdateCounter + 1
            }));
          }
        } catch (error) {
          // Stop RSSI polling on error to prevent "Unknown error occurred" spam
          console.log(`RSSI reading error, stopping polling: ${(error as Error).message}`);
          if (rssiIntervalId) {
            clearInterval(rssiIntervalId);
          }
        }
      }, 500); // Read RSSI every 500ms (within 300-500ms range)
    }

    // Cleanup function - stops timer on disconnect or unmount
    return () => {
      if (rssiIntervalId) {
        try {
          clearInterval(rssiIntervalId);
        } catch (cleanupError) {
          console.log('Error clearing RSSI interval:', (cleanupError as Error).message);
        }
      }
    };
  }, [state.connectionStatus]); // Only depend on connection status, not device instance

  // Separate effect to monitor connection status and handle disconnections
  useEffect(() => {
    let connectionMonitorId: number | NodeJS.Timeout | null = null;

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

          try {
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
                const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                  addLog('Auto-connect enabled: starting scan after connection monitor detected disconnection');
                  startScan();
                }, 2000);
              }
            }
          } catch (connCheckError) {
            // If connection check fails, assume device is disconnected
            addLog(`Connection check failed, treating as disconnection: ${(connCheckError as Error).message}`);

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
              const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                addLog('Auto-connect enabled: starting scan after connection check failure');
                startScan();
              }, 2000);
            }
          }
        } catch (error) {
          // Handle the specific error that causes the crash
          let connectionMonitorErrorMessage = '';
          if (error instanceof Error) {
            connectionMonitorErrorMessage = error.message || 'Unknown error';
            if (connectionMonitorErrorMessage.includes('Parameter specified as non-null is null')) {
              connectionMonitorErrorMessage = 'Error checking device connection: A known error occurred. This is probably a bug!';
            }
          } else {
            connectionMonitorErrorMessage = 'Error checking device connection: A known error occurred. This is probably a bug!';
          }
          addLog(`Error checking device connection: ${connectionMonitorErrorMessage}`);
        }
      }, 2000); // Check connection status every 2 seconds
    }

    // Cleanup function
    return () => {
      if (connectionMonitorId) {
        try {
          clearInterval(connectionMonitorId);
        } catch (clearError) {
          addLog(`Error clearing connection monitor interval: ${(clearError as Error)?.message || 'Unknown error'}`);
        }
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
        state.scannedDevices.length > 0) { // Attempt auto-connect regardless of current connection status

      const savedDeviceFound = state.scannedDevices.find(device => device.id === state.savedDevice!.id);
      if (savedDeviceFound) {
        // Only connect if we're not already connected to the same device
        if (state.connectionStatus !== 'connected' || state.connectedDeviceId !== state.savedDevice.id) {
          addLog(`Auto-connect enabled and saved device found, attempting connection...`);
          connectToDevice(savedDeviceFound);
        }
      }
    }
  }, [state.autoConnectEnabled, state.savedDevice, state.scannedDevices, state.connectionStatus, state.connectedDeviceId, connectToDevice]);

  // Monitor Bluetooth state changes - SINGLE subscription with proper cleanup
  useEffect(() => {
    if (!bleManagerRef.current || !managerInitialized) {
      return;
    }

    let lastBluetoothState: string | null = null;
    let lastScanAttemptTime: number | null = null;
    const SCAN_DEBOUNCE_TIME = 5000; // 5 seconds debounce time
    const STATE_CHANGE_COOLDOWN = 3000; // 3 seconds cooldown between state change reactions

    const subscription = bleManagerRef.current.onStateChange((bluetoothState) => {
      const now = Date.now();
      
      // Only log if state actually changed to prevent spam
      if (bluetoothState !== lastBluetoothState) {
        console.log('Bluetooth state changed to:', bluetoothState);
        lastBluetoothState = bluetoothState;

        // Update the state with the current Bluetooth state and timestamp
        setState(prev => ({ 
          ...prev, 
          bluetoothState,
          lastBluetoothStateChangeTime: now
        }));

        if (bluetoothState === State.PoweredOn) {
          addLog('Bluetooth is powered on.');
          
          // Use functional setState to ensure we have the latest state values
          setState(prev => {
            // Check if enough time has passed since the last state change to avoid reacting to rapid cycles
            const timeSinceLastStateChange = now - prev.lastBluetoothStateChangeTime;
            const shouldReactToStateChange = timeSinceLastStateChange > STATE_CHANGE_COOLDOWN;
            
            // Debounce scan attempts to prevent rapid successive scans
            const shouldScan = !lastScanAttemptTime || (now - lastScanAttemptTime) > SCAN_DEBOUNCE_TIME;
            
            if (shouldReactToStateChange && shouldScan && prev.autoConnectEnabled && prev.savedDevice && !prev.isScanning) {
              // If auto-connect is enabled and we have a saved device, start scanning for saved device
              // But only if we're not already scanning and enough time has passed since last scan
              addLog('Auto-connect enabled and saved device exists: starting scan for saved device');
              lastScanAttemptTime = now;
              const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                startScan();
              }, 1000); // Small delay to ensure Bluetooth is fully ready
            } else if (shouldReactToStateChange && shouldScan && prev.autoConnectEnabled && !prev.savedDevice && !prev.isScanning) {
              // If auto-connect is enabled but no saved device, start general scanning
              // But only if we're not already scanning and enough time has passed since last scan
              addLog('Auto-connect enabled but no saved device: starting general scan');
              lastScanAttemptTime = now;
              const timeoutId: number | NodeJS.Timeout = setTimeout(() => {
                startScan();
              }, 1000);
            } else if (!shouldScan) {
              addLog('Scan attempt debounced - waiting before next scan attempt');
            } else if (!shouldReactToStateChange) {
              addLog(`State change reaction debounced - ${timeSinceLastStateChange}ms since last change, waiting ${STATE_CHANGE_COOLDOWN}ms`);
            }
            
            return prev; // Return the state unchanged (we're only using setState for the side effect of getting fresh state)
          });
        } else if (state.connectionStatus === 'connected') {
          // If Bluetooth is turned off while connected, update the state
          setState(prev => ({
            ...prev,
            connectionStatus: 'disconnected',
            connectedDeviceId: null,
            ledStatus: { ...prev.ledStatus, btConnected: false }
          }));
          addLog(`Bluetooth turned off. Connection status: ${bluetoothState}`);
        }
      }
    }, true);

    // Cleanup function
    return () => {
      try {
        if (subscription) {
          subscription.remove();
        }
      } catch (cleanupError) {
        addLog(`Error cleaning up Bluetooth state subscription: ${(cleanupError as Error)?.message || 'Unknown error'}`);
      }
      lastBluetoothState = null;
      lastScanAttemptTime = null;
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
        try {
          bleManagerRef.current.stopDeviceScan();
        } catch (scanStopError) {
          addLog(`Error stopping scan during cleanup: ${(scanStopError as Error)?.message || 'Unknown error'}`);
        }
      }
      if (statusSubscriptionRef.current) {
        try {
          statusSubscriptionRef.current.remove();
        } catch (subscriptionRemoveError) {
          addLog(`Error removing subscription during cleanup: ${(subscriptionRemoveError as Error)?.message || 'Unknown error'}`);
        }
      }
    };
  }, [managerInitialized, addLog]);

  // Function to save selected device to storage and state
  const saveSelectedDevice = useCallback(async (device: Device) => {
    try {
      const deviceInfo = {
        id: device.id,
        name: device.name || '',
        rssi: device.rssi !== null ? device.rssi : undefined,
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
        // Handle the specific error that causes the crash
        let stopScanErrorMessage = '';
        if (error instanceof Error) {
          stopScanErrorMessage = error.message || 'Unknown error';
          if (stopScanErrorMessage.includes('Parameter specified as non-null is null')) {
            stopScanErrorMessage = 'Failed to stop scanning: A known error occurred. This is probably a bug!';
          }
        } else {
          stopScanErrorMessage = 'Failed to stop scanning: A known error occurred. This is probably a bug!';
        }
        addLog(`Failed to stop scanning: ${stopScanErrorMessage}`);
      }
    } else {
      addLog('No active scan to stop');
    }
  }, [state.isScanning, addLog]);

  // Function to enable/disable auto-connect
  const toggleAutoConnect = useCallback(async () => {
    // Get current state to determine new value
    const newAutoConnectStatus = !state.autoConnectEnabled;
    addLog(`Auto-connect ${newAutoConnectStatus ? 'enabled' : 'disabled'}`);

    // Update the state
    setState(prev => ({
      ...prev,
      autoConnectEnabled: newAutoConnectStatus
    }));

    // Save the new auto-connect status to legacy storage
    try {
      await AsyncStorage.setItem('autoConnectEnabled', newAutoConnectStatus.toString());
    } catch (error) {
      console.error('Failed to save auto-connect setting:', error);
    }

    // Also save to unified settings system
    try {
      // Get all current settings and update autoConnectEnabled
      const allSettings = await loadAllSettings();
      await saveAllSettings({...allSettings, autoConnectEnabled: newAutoConnectStatus});
    } catch (error) {
      console.error('Failed to save auto-connect setting to unified system:', error);
    }
  }, [state.autoConnectEnabled, addLog, saveAllSettings, loadAllSettings]);

  // Function to attempt auto-connect when saved device is detected
  const attemptAutoConnect = useCallback((device: Device) => {
    if (state.autoConnectEnabled && state.savedDevice && device.id === state.savedDevice.id) {
      addLog(`Auto-connecting to saved device: ${device.name || device.id}`);
      connectToDevice(device);
    }
  }, [state.autoConnectEnabled, state.savedDevice, connectToDevice, addLog]);

// Function to reset the list of scanned devices
const resetScannedDevices = useCallback(() => {
  setState(prev => ({
    ...prev,
    scannedDevices: []
  }));
  addLog('Scanned devices list reset');
}, [addLog]);

  // Global cleanup effect to ensure all resources are released when the hook is unmounted
  useEffect(() => {
    return () => {
      // Stop any ongoing scans
      if (bleManagerRef.current && state.isScanning) {
        try {
          bleManagerRef.current.stopDeviceScan();
        } catch (error) {
          console.log('Error stopping scan during cleanup:', (error as Error).message);
        }
      }

      // Remove any active status subscription
      if (statusSubscriptionRef.current) {
        try {
          statusSubscriptionRef.current.remove();
        } catch (error) {
          console.log('Error removing status subscription during cleanup:', (error as Error).message);
        }
        statusSubscriptionRef.current = null;
      }

      // Disconnect from device if connected
      if (state.connectionStatus === 'connected' && state.connectedDeviceId && bleManagerRef.current) {
        try {
          bleManagerRef.current.cancelDeviceConnection(state.connectedDeviceId);
        } catch (error) {
          console.log('Error disconnecting device during cleanup:', (error as Error).message);
        }
      }

      // Destroy the BLE manager to free resources
      if (bleManagerRef.current) {
        try {
          bleManagerRef.current.destroy();
        } catch (error) {
          console.log('Error destroying BLE manager during cleanup:', (error as Error).message);
        }
        bleManagerRef.current = null;
      }
    };
  }, []);

  return {
    state,
    startScan,
    stopScan,
    disconnectFromDevice,
    connectToDevice,
    toggleContact,
    sendCommand,
    sendRelayCH1Command,
    sendRelayCH2Command,
    sendBuzzerCommand,
    sendButtonPulseCommand,
    sendLEDCommand,
    addLog,
    bleManagerRef,
    saveSelectedDevice,
    loadSelectedDevice,
    clearSelectedDevice,
    toggleAutoConnect,
    attemptAutoConnect,
    resetScannedDevices
  };
};