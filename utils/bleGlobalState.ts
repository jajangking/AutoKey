import { BleManager, Device } from 'react-native-ble-plx';

// Global BLE state - shared across all hook instances
let globalConnectedDevice: Device | null = null;
let globalConnectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let globalBleManager: BleManager | null = null;
let globalStatusSubscription: any | null = null;

// Global whitelist cache - persists across navigation
let globalWhitelistEntries: string[] = [];
let globalWhitelistCount: number = 0;

// Getters
export const getGlobalConnectedDevice = (): Device | null => globalConnectedDevice;
export const getGlobalConnectionStatus = (): 'disconnected' | 'connecting' | 'connected' => globalConnectionStatus;
export const getGlobalBleManager = (): BleManager | null => globalBleManager;
export const getGlobalStatusSubscription = (): any | null => globalStatusSubscription;
export const getGlobalWhitelistEntries = (): string[] => globalWhitelistEntries;
export const getGlobalWhitelistCount = (): number => globalWhitelistCount;

// Setters
export const setGlobalConnectedDevice = (device: Device | null) => {
  globalConnectedDevice = device;
};

export const setGlobalConnectionStatus = (status: 'disconnected' | 'connecting' | 'connected') => {
  globalConnectionStatus = status;
};

export const setGlobalBleManager = (manager: BleManager | null) => {
  globalBleManager = manager;
};

export const setGlobalStatusSubscription = (subscription: any | null) => {
  globalStatusSubscription = subscription;
};

export const setGlobalWhitelistEntries = (entries: string[]) => {
  globalWhitelistEntries = entries;
  globalWhitelistCount = entries.length;
};

export const setGlobalWhitelistCount = (count: number) => {
  globalWhitelistCount = count;
};

// Clear all global state
export const clearGlobalBLEState = () => {
  globalConnectedDevice = null;
  globalConnectionStatus = 'disconnected';
  globalBleManager = null;
  globalStatusSubscription = null;
  globalWhitelistEntries = [];
  globalWhitelistCount = 0;
};
