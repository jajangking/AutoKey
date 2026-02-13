import AsyncStorage from '@react-native-async-storage/async-storage';

// Key untuk menyimpan pengaturan
const SETTINGS_KEYS = {
  THEME: 'selectedTheme',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  AUTO_CONNECT_ENABLED: 'autoConnectEnabled',
  DEBUG_MODE: 'debugMode',
  WIFI_NETWORK: 'wifiNetwork',
  WIFI_PASSWORD: 'wifiPassword',
  WIFI_STATUS: 'wifiStatus',
  KONTAK_ON: 'kontakOn',
  SWITCH_STANDAR: 'switchStandar',
  BUZZER: 'buzzer',
  STATUS_BYPASS: 'statusBypass',
};

// Fungsi untuk menyimpan pengaturan
export const saveSetting = async (key: string, value: any) => {
  try {
    await AsyncStorage.setItem(key, value.toString());
  } catch (error) {
    console.error('Error saving setting:', error);
  }
};

// Fungsi untuk memuat pengaturan
export const loadSetting = async (key: string, defaultValue: any = null) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      // Konversi string ke tipe data yang sesuai
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      if (!isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    }
    return defaultValue;
  } catch (error) {
    console.error('Error loading setting:', error);
    return defaultValue;
  }
};

// Fungsi untuk memuat semua pengaturan
export const loadAllSettings = async () => {
  try {
    const settings = {
      theme: await loadSetting(SETTINGS_KEYS.THEME, 'light'),
      notificationsEnabled: await loadSetting(SETTINGS_KEYS.NOTIFICATIONS_ENABLED, true),
      autoConnectEnabled: await loadSetting(SETTINGS_KEYS.AUTO_CONNECT_ENABLED, true),
      debugMode: await loadSetting(SETTINGS_KEYS.DEBUG_MODE, false),
      wifiNetwork: await loadSetting(SETTINGS_KEYS.WIFI_NETWORK, 'AutoKey_WiFi'),
      wifiPassword: await loadSetting(SETTINGS_KEYS.WIFI_PASSWORD, ''),
      wifiStatus: await loadSetting(SETTINGS_KEYS.WIFI_STATUS, 'Connected'),
      kontakOn: await loadSetting(SETTINGS_KEYS.KONTAK_ON, false),
      switchStandar: await loadSetting(SETTINGS_KEYS.SWITCH_STANDAR, true),
      buzzer: await loadSetting(SETTINGS_KEYS.BUZZER, false),
      statusBypass: await loadSetting(SETTINGS_KEYS.STATUS_BYPASS, false),
    };

    return settings;
  } catch (error) {
    console.error('Error in loadAllSettings:', error);
    
    // Return default settings in case of error
    return {
      theme: 'light',
      notificationsEnabled: true,
      autoConnectEnabled: true,
      debugMode: false,
      wifiNetwork: 'AutoKey_WiFi',
      wifiPassword: '',
      wifiStatus: 'Connected',
      kontakOn: false,
      switchStandar: true,
      buzzer: false,
      statusBypass: false,
    };
  }
};

// Fungsi untuk menyimpan semua pengaturan
export const saveAllSettings = async (settings: any) => {
  try {
    await Promise.all([
      saveSetting(SETTINGS_KEYS.THEME, settings.theme),
      saveSetting(SETTINGS_KEYS.NOTIFICATIONS_ENABLED, settings.notificationsEnabled),
      saveSetting(SETTINGS_KEYS.AUTO_CONNECT_ENABLED, settings.autoConnectEnabled),
      saveSetting(SETTINGS_KEYS.DEBUG_MODE, settings.debugMode),
      saveSetting(SETTINGS_KEYS.WIFI_NETWORK, settings.wifiNetwork),
      saveSetting(SETTINGS_KEYS.WIFI_PASSWORD, settings.wifiPassword),
      saveSetting(SETTINGS_KEYS.WIFI_STATUS, settings.wifiStatus),
      saveSetting(SETTINGS_KEYS.KONTAK_ON, settings.kontakOn),
      saveSetting(SETTINGS_KEYS.SWITCH_STANDAR, settings.switchStandar),
      saveSetting(SETTINGS_KEYS.BUZZER, settings.buzzer),
      saveSetting(SETTINGS_KEYS.STATUS_BYPASS, settings.statusBypass),
    ]);
  } catch (error) {
    console.error('Error saving all settings:', error);
  }
};

// Ekspor semua kunci untuk referensi
export { SETTINGS_KEYS };