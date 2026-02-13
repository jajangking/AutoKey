import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useBLE } from './useBLE';

const useBackgroundBLE = () => {
  const appState = useRef(AppState.currentState);
  const { state, connectToDevice, disconnectFromDevice, startScan, stopScan } = useBLE();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Optionally reconnect when app comes to foreground
        if (state.savedDevice) {
          // Attempt to reconnect to saved device
          console.log('Attempting to reconnect to saved device...');
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App has moved to the background!');
        // Handle background transition
        // Note: On iOS, BLE operations are limited in background
        // On Android, we can continue certain operations
        if (Platform.OS === 'android') {
          // For Android, we can maintain connection or continue scanning
          console.log('App in background on Android - maintaining BLE operations');
        } else {
          // For iOS, we need to rely on system's BLE background modes
          console.log('App in background on iOS - relying on system BLE background modes');
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [state.savedDevice]);

  // Function to handle reconnection when app becomes active
  const handleReconnectOnForeground = () => {
    if (state.savedDevice && !state.connectedDeviceId) {
      console.log('Reconnecting to saved device...');
      // Find the saved device in scanned devices or initiate scan
      const device = state.scannedDevices.find(d => d.id === state.savedDevice?.id);
      if (device) {
        connectToDevice(device);
      } else {
        // Start scan to find the saved device
        startScan();
      }
    }
  };

  return {
    handleReconnectOnForeground,
  };
};

export default useBackgroundBLE;