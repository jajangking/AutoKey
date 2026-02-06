import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for whitelist management
type WhitelistState = {
  ble: string[];
  wifi: string[];
};

type WhitelistContextType = {
  whitelist: WhitelistState;
  addToWhitelist: (type: 'ble' | 'wifi', value: string) => void;
  removeFromWhitelist: (type: 'ble' | 'wifi', value: string) => void;
  isInWhitelist: (type: 'ble' | 'wifi', value: string) => boolean;
  clearWhitelist: (type: 'ble' | 'wifi') => void;
};

// Create the context
const WhitelistContext = createContext<WhitelistContextType | undefined>(undefined);

// Whitelist Provider Component
export const WhitelistProvider = ({ children }: { children: ReactNode }) => {
  const [whitelist, setWhitelist] = useState<WhitelistState>({
    ble: [],
    wifi: [],
  });

  // Load whitelist from storage on mount
  useEffect(() => {
    loadWhitelistFromStorage();
  }, []);

  const loadWhitelistFromStorage = async () => {
    try {
      const storedBle = await AsyncStorage.getItem('whitelist_ble');
      const storedWifi = await AsyncStorage.getItem('whitelist_wifi');

      const bleList = storedBle ? JSON.parse(storedBle) : [];
      const wifiList = storedWifi ? JSON.parse(storedWifi) : [];

      setWhitelist({
        ble: bleList,
        wifi: wifiList,
      });
    } catch (error) {
      console.error('Error loading whitelist from storage:', error);
    }
  };

  // Save whitelist to storage whenever it changes
  useEffect(() => {
    saveWhitelistToStorage();
  }, [whitelist]);

  const saveWhitelistToStorage = async () => {
    try {
      await AsyncStorage.setItem('whitelist_ble', JSON.stringify(whitelist.ble));
      await AsyncStorage.setItem('whitelist_wifi', JSON.stringify(whitelist.wifi));
    } catch (error) {
      console.error('Error saving whitelist to storage:', error);
    }
  };

  // Add to whitelist
  const addToWhitelist = (type: 'ble' | 'wifi', value: string) => {
    setWhitelist(prev => {
      const currentList = [...prev[type]];
      if (!currentList.includes(value)) {
        currentList.push(value);
      }
      return {
        ...prev,
        [type]: currentList
      };
    });
  };

  // Remove from whitelist
  const removeFromWhitelist = (type: 'ble' | 'wifi', value: string) => {
    setWhitelist(prev => ({
      ...prev,
      [type]: prev[type].filter(item => item !== value)
    }));
  };

  // Check if value is in whitelist
  const isInWhitelist = (type: 'ble' | 'wifi', value: string): boolean => {
    return whitelist[type].includes(value);
  };

  // Clear whitelist
  const clearWhitelist = (type: 'ble' | 'wifi') => {
    setWhitelist(prev => ({
      ...prev,
      [type]: []
    }));
  };

  return (
    <WhitelistContext.Provider
      value={{
        whitelist,
        addToWhitelist,
        removeFromWhitelist,
        isInWhitelist,
        clearWhitelist,
      }}
    >
      {children}
    </WhitelistContext.Provider>
  );
};

// Custom hook to use the whitelist context
export const useWhitelist = (): WhitelistContextType => {
  const context = useContext(WhitelistContext);
  if (!context) {
    throw new Error('useWhitelist must be used within a WhitelistProvider');
  }
  return context;
};