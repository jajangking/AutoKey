import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PairedDevice {
  id: string;
  name: string;
  type: 'ble' | 'classic';
  lastConnected: string;
  isConnected?: boolean;
}

const PAIRED_DEVICES_KEY = 'paired_bluetooth_devices';

export const savePairedDevice = async (device: PairedDevice): Promise<void> => {
  try {
    const existingDevices = await getPairedDevices();
    const existingIndex = existingDevices.findIndex(d => d.id === device.id);
    
    if (existingIndex !== -1) {
      // Update existing device
      existingDevices[existingIndex] = { ...device, lastConnected: new Date().toISOString() };
    } else {
      // Add new device
      existingDevices.push({ ...device, lastConnected: new Date().toISOString() });
    }
    
    await AsyncStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(existingDevices));
  } catch (error) {
    console.error('Error saving paired device:', error);
    throw error;
  }
};

export const getPairedDevices = async (): Promise<PairedDevice[]> => {
  try {
    const stored = await AsyncStorage.getItem(PAIRED_DEVICES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting paired devices:', error);
    return [];
  }
};

export const removePairedDevice = async (deviceId: string): Promise<void> => {
  try {
    const existingDevices = await getPairedDevices();
    const filteredDevices = existingDevices.filter(device => device.id !== deviceId);
    await AsyncStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(filteredDevices));
  } catch (error) {
    console.error('Error removing paired device:', error);
    throw error;
  }
};

export const clearPairedDevices = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PAIRED_DEVICES_KEY);
  } catch (error) {
    console.error('Error clearing paired devices:', error);
    throw error;
  }
};