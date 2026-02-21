import AsyncStorage from '@react-native-async-storage/async-storage';

// Key untuk menyimpan whitelist
const WHITELIST_KEY = 'bluetooth_whitelist';

// Interface untuk device whitelist
export interface WhitelistDevice {
  id: string;
  name?: string;
  rssi?: number;
  mtu?: number;
  addedAt?: string;
  notes?: string;
}

// Fungsi untuk mendapatkan semua device dalam whitelist
export const getWhitelist = async (): Promise<WhitelistDevice[]> => {
  try {
    const data = await AsyncStorage.getItem(WHITELIST_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading whitelist:', error);
    return [];
  }
};

// Fungsi untuk menyimpan whitelist
export const saveWhitelist = async (devices: WhitelistDevice[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(WHITELIST_KEY, JSON.stringify(devices));
  } catch (error) {
    console.error('Error saving whitelist:', error);
    throw error;
  }
};

// Fungsi untuk menambahkan device ke whitelist
export const addToWhitelist = async (device: WhitelistDevice): Promise<WhitelistDevice[]> => {
  try {
    const whitelist = await getWhitelist();
    
    // Cek apakah device sudah ada
    const existingIndex = whitelist.findIndex(d => d.id === device.id);
    
    if (existingIndex !== -1) {
      // Update device yang sudah ada
      whitelist[existingIndex] = {
        ...whitelist[existingIndex],
        name: device.name || whitelist[existingIndex].name,
        rssi: device.rssi || whitelist[existingIndex].rssi,
        mtu: device.mtu || whitelist[existingIndex].mtu,
        addedAt: whitelist[existingIndex].addedAt || new Date().toISOString(),
        notes: device.notes || whitelist[existingIndex].notes,
      };
    } else {
      // Tambahkan device baru
      whitelist.push({
        ...device,
        addedAt: new Date().toISOString(),
      });
    }
    
    await saveWhitelist(whitelist);
    return whitelist;
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    throw error;
  }
};

// Fungsi untuk menghapus device dari whitelist
export const removeFromWhitelist = async (deviceId: string): Promise<WhitelistDevice[]> => {
  try {
    const whitelist = await getWhitelist();
    const filtered = whitelist.filter(d => d.id !== deviceId);
    await saveWhitelist(filtered);
    return filtered;
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    throw error;
  }
};

// Fungsi untuk mengecek apakah device ada di whitelist
export const isDeviceWhitelisted = async (deviceId: string): Promise<boolean> => {
  try {
    const whitelist = await getWhitelist();
    return whitelist.some(d => d.id === deviceId);
  } catch (error) {
    console.error('Error checking whitelist:', error);
    return false;
  }
};

// Fungsi untuk mendapatkan device dari whitelist
export const getDeviceFromWhitelist = async (deviceId: string): Promise<WhitelistDevice | null> => {
  try {
    const whitelist = await getWhitelist();
    const device = whitelist.find(d => d.id === deviceId);
    return device || null;
  } catch (error) {
    console.error('Error getting device from whitelist:', error);
    return null;
  }
};

// Fungsi untuk mengupdate notes device
export const updateDeviceNotes = async (deviceId: string, notes: string): Promise<WhitelistDevice[]> => {
  try {
    const whitelist = await getWhitelist();
    const index = whitelist.findIndex(d => d.id === deviceId);
    
    if (index !== -1) {
      whitelist[index] = {
        ...whitelist[index],
        notes,
      };
      await saveWhitelist(whitelist);
    }
    
    return whitelist;
  } catch (error) {
    console.error('Error updating device notes:', error);
    throw error;
  }
};

// Fungsi untuk menghapus semua device dari whitelist
export const clearWhitelist = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(WHITELIST_KEY);
  } catch (error) {
    console.error('Error clearing whitelist:', error);
    throw error;
  }
};
