import { useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { useBLE } from './useBLE';

const useBackgroundBLE = () => {
  const appState = useRef(AppState.currentState);
  const { state, connectToDevice, startScan } = useBLE();
  const isReconnecting = useRef(false);

  // Handle reconnection when app becomes active
  const handleReconnectOnForeground = useCallback(() => {
    // Prevent multiple reconnection attempts
    if (isReconnecting.current) return;
    
    // Only reconnect if we have a saved device and not currently connected
    if (state.savedDevice && !state.connectedDeviceId) {
      isReconnecting.current = true;
      
      // Find the saved device in scanned devices
      const device = state.scannedDevices.find(d => d.id === state.savedDevice?.id);
      
      if (device) {
        connectToDevice(device);
      } else {
        // Start scan to find the saved device
        startScan();
      }
      
      // Reset flag after delay
      setTimeout(() => {
        isReconnecting.current = false;
      }, 5000);
    }
  }, [state.savedDevice, state.connectedDeviceId, state.scannedDevices, connectToDevice, startScan]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        handleReconnectOnForeground();
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App has moved to the background!');
        
        if (Platform.OS === 'android') {
          console.log('App in background on Android - maintaining BLE operations');
        } else {
          console.log('App in background on iOS - relying on system BLE background modes');
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [handleReconnectOnForeground]);

  return {
    handleReconnectOnForeground,
  };
};

export default useBackgroundBLE;