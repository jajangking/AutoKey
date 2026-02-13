import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAllSettings, saveSetting, SETTINGS_KEYS } from '@/utils/settingsManager';

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const colorScheme = useColorScheme();
  
  // State for all settings - these will be loaded from global settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [wifiNetwork, setWifiNetwork] = useState('AutoKey_WiFi');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState('Connected');
  const [kontakOn, setKontakOn] = useState(false);
  const [switchStandar, setSwitchStandar] = useState(true);
  const [buzzer, setBuzzer] = useState(false);
  const [statusBypass, setStatusBypass] = useState(false);
  
  useEffect(() => {
    // Load all saved settings when component mounts
    const loadAllSettingsFunc = async () => {
      try {
        // Load all settings at once
        const settings = await loadAllSettings();
        
        // Update local state with loaded values
        setNotificationsEnabled(settings.notificationsEnabled);
        setAutoConnectEnabled(settings.autoConnectEnabled);
        setDebugMode(settings.debugMode);
        setWifiNetwork(settings.wifiNetwork);
        setWifiPassword(settings.wifiPassword);
        setWifiStatus(settings.wifiStatus);
        setKontakOn(settings.kontakOn);
        setSwitchStandar(settings.switchStandar);
        setBuzzer(settings.buzzer);
        setStatusBypass(settings.statusBypass);
        
        // Handle theme separately since it's managed by ThemeContext
        if (settings.theme && settings.theme !== theme) {
          // Adjust theme using toggleTheme function based on saved theme
          if (settings.theme === 'light' && theme !== 'light') {
            if (theme === 'oled') {
              toggleTheme(); // oled to dark
              toggleTheme(); // dark to light
            } else if (theme === 'dark') {
              toggleTheme(); // dark to light
            }
          } else if (settings.theme === 'dark' && theme !== 'dark') {
            if (theme === 'light') {
              toggleTheme(); // light to dark
            } else if (theme === 'oled') {
              toggleTheme(); // oled to dark
            }
          } else if (settings.theme === 'oled' && theme !== 'oled') {
            if (theme === 'light') {
              toggleTheme(); // light to dark
              toggleTheme(); // dark to oled
            } else if (theme === 'dark') {
              toggleTheme(); // dark to oled
            }
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    loadAllSettingsFunc();
  }, [theme, toggleTheme]);

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme === 'light' ? '#1e293b' : '#e2e8f0'} />
            </TouchableOpacity>
            <Text style={styles.title}>Settings</Text>
          </View>
        </View>

        {/* General Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          {/* Theme Selection */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Theme</Text>
            <View style={styles.themePickerContainer}>
              <TouchableOpacity 
                style={[
                  styles.themeOption,
                  theme === 'light' && styles.selectedTheme
                ]}
                onPress={async () => {
                  // Toggle to light theme
                  if (theme !== 'light') {
                    toggleTheme(); // First toggle to switch from oled to dark
                    if (theme === 'dark') {
                      toggleTheme(); // Second toggle to switch from dark to light
                    }
                  }
                  // Save theme preference to async storage
                  await AsyncStorage.setItem('selectedTheme', 'light');
                }}
              >
                <Text style={[
                  styles.themeText,
                  theme === 'light' && styles.selectedThemeText
                ]}>Light</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.themeOption,
                  theme === 'dark' && styles.selectedTheme
                ]}
                onPress={async () => {
                  // Toggle to dark theme
                  if (theme === 'light') {
                    toggleTheme(); // From light to dark
                  } else if (theme === 'oled') {
                    toggleTheme(); // From oled to dark
                  }
                  // Save theme preference to async storage
                  await AsyncStorage.setItem('selectedTheme', 'dark');
                }}
              >
                <Text style={[
                  styles.themeText,
                  theme === 'dark' && styles.selectedThemeText
                ]}>Dark</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.themeOption,
                  theme === 'oled' && styles.selectedTheme
                ]}
                onPress={async () => {
                  // Toggle to oled theme
                  if (theme === 'light') {
                    toggleTheme(); // From light to dark
                    toggleTheme(); // From dark to oled
                  } else if (theme === 'dark') {
                    toggleTheme(); // From dark to oled
                  }
                  // Save theme preference to async storage
                  await AsyncStorage.setItem('selectedTheme', 'oled');
                }}
              >
                <Text style={[
                  styles.themeText,
                  theme === 'oled' && styles.selectedThemeText
                ]}>OLED</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={async (value) => {
                setNotificationsEnabled(value);
                await saveSetting(SETTINGS_KEYS.NOTIFICATIONS_ENABLED, value);
              }}
              trackColor={{ false: '#767577', true: '#818cf8' }}
              thumbColor={theme === 'light' ? '#f4f4f4' : '#f0f0f0'}
            />
          </View>

          {/* Auto Connect */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Auto Connect to Device</Text>
            <Switch
              value={autoConnectEnabled}
              onValueChange={async (value) => {
                setAutoConnectEnabled(value);
                await saveSetting(SETTINGS_KEYS.AUTO_CONNECT_ENABLED, value);
              }}
              trackColor={{ false: '#767577', true: '#818cf8' }}
              thumbColor={theme === 'light' ? '#f4f4f4' : '#f0f0f0'}
            />
          </View>
        </View>

        {/* ESP32 Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ESP32 Setting</Text>

          {/* Device Name */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Device Name</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>AutoKey_ESP32</Text>
              <Ionicons name="chevron-down" size={20} color={theme === 'light' ? '#64748b' : '#94a3b8'} />
            </View>
          </View>

          {/* Connection Timeout */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Connection Timeout (seconds)</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>10s</Text>
              <Ionicons name="chevron-down" size={20} color={theme === 'light' ? '#64748b' : '#94a3b8'} />
            </View>
          </View>

          {/* Auto-Reconnect */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Auto-Reconnect</Text>
            <Switch
              value={autoConnectEnabled}
              onValueChange={setAutoConnectEnabled}
              trackColor={{ false: '#767577', true: '#818cf8' }}
              thumbColor={theme === 'light' ? '#f4f4f4' : '#f0f0f0'}
            />
          </View>
        </View>

        {/* WiFi Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WiFi Setting</Text>

          {/* WiFi Network */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Network</Text>
            <TextInput
              style={styles.textInput}
              value={wifiNetwork}
              onChangeText={async (text) => {
                setWifiNetwork(text);
                await saveSetting(SETTINGS_KEYS.WIFI_NETWORK, text);
              }}
              placeholder="Enter WiFi network name"
            />
          </View>

          {/* WiFi Password */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Password</Text>
            <TextInput
              style={styles.textInput}
              value={wifiPassword}
              onChangeText={async (text) => {
                setWifiPassword(text);
                await saveSetting(SETTINGS_KEYS.WIFI_PASSWORD, text);
              }}
              placeholder="Enter WiFi password"
              secureTextEntry={true}
            />
          </View>

          {/* WiFi Status */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Status</Text>
            <View style={[styles.statusBadge, styles.connectedStatus]}>
              <Text style={styles.statusText}>Connected</Text>
            </View>
          </View>
        </View>

        {/* Manual Control Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Control</Text>

          {/* Kontak On */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Kontak On</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={kontakOn}
                onValueChange={async (value) => {
                  setKontakOn(value);
                  await saveSetting(SETTINGS_KEYS.KONTAK_ON, value);
                }}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Switch Standar */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Switch Standar</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={switchStandar}
                onValueChange={async (value) => {
                  setSwitchStandar(value);
                  await saveSetting(SETTINGS_KEYS.SWITCH_STANDAR, value);
                }}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Buzzer */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Buzzer</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>OFF</Text>
              <Switch
                value={buzzer}
                onValueChange={async (value) => {
                  setBuzzer(value);
                  await saveSetting(SETTINGS_KEYS.BUZZER, value);
                }}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
              <Text style={styles.toggleText}>ON</Text>
            </View>
          </View>

          {/* Status Bypass */}
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Status Bypass</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>INACTIVE</Text>
              <Switch
                value={statusBypass}
                onValueChange={async (value) => {
                  setStatusBypass(value);
                  await saveSetting(SETTINGS_KEYS.STATUS_BYPASS, value);
                }}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
              <Text style={styles.toggleText}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Debug Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug</Text>

          {/* Debug Mode */}
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Enable Debug Mode</Text>
            <Switch
              value={debugMode}
              onValueChange={async (value) => {
                setDebugMode(value);
                await saveSetting(SETTINGS_KEYS.DEBUG_MODE, value);
              }}
              trackColor={{ false: '#767577', true: '#ef4444' }}
              thumbColor={theme === 'light' ? '#f4f4f4' : '#f0f0f0'}
            />
          </View>

          {/* Clear Logs */}
          <TouchableOpacity style={styles.clearLogsButton}>
            <Ionicons name="trash" size={20} color="#ef4444" />
            <Text style={styles.clearLogsText}>Clear Activity Logs</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>BLE Library</Text>
            <Text style={styles.infoValue}>react-native-ble-plx v3.5.0</Text>
          </View>

          <TouchableOpacity style={styles.infoItem}>
            <Text style={styles.infoLabel}>License</Text>
            <Text style={styles.infoValue}>MIT License</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: 'light' | 'dark' | 'oled') => {
  const isDark = theme === 'dark' || theme === 'oled';
  const isOled = theme === 'oled';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? (isOled ? '#000000' : '#0f172a') : '#f1f5f9',
    },
    scrollContainer: {
      padding: 16,
      paddingBottom: 60,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      padding: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#e2e8f0' : '#1e293b',
    },
    section: {
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#e2e8f0',
    },
    settingText: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    themePickerContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderRadius: 8,
      padding: 4,
    },
    themeOption: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: 'center',
    },
    selectedTheme: {
      backgroundColor: isDark ? '#4f46e5' : '#6366f1', // Indigo background when selected
    },
    themeText: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#64748b',
      fontWeight: '500',
    },
    selectedThemeText: {
      color: '#ffffff',
      fontWeight: '600',
    },
    pickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    pickerText: {
      fontSize: 14,
      color: isDark ? '#e2e8f0' : '#475569',
      marginRight: 8,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    passwordText: {
      fontSize: 14,
      color: isDark ? '#e2e8f0' : '#475569',
      marginRight: 8,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    connectedStatus: {
      backgroundColor: '#10b981', // Green for connected
    },
    disconnectedStatus: {
      backgroundColor: '#ef4444', // Red for disconnected
    },
    statusText: {
      fontSize: 12,
      color: '#ffffff',
      fontWeight: '500',
    },
    controlItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#e2e8f0',
    },
    controlLabel: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleText: {
      fontSize: 14,
      color: isDark ? '#cbd5e1' : '#64748b',
    },
    textInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#cbd5e1',
      borderRadius: 8,
      color: isDark ? '#e2e8f0' : '#1e293b',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
    },
    clearLogsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: isDark ? '#3f3f46' : '#fef2f2',
      borderRadius: 8,
      marginTop: 8,
    },
    clearLogsText: {
      fontSize: 16,
      color: '#ef4444',
      marginLeft: 8,
    },
    infoItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#e2e8f0',
    },
    infoLabel: {
      fontSize: 16,
      color: isDark ? '#cbd5e1' : '#475569',
    },
    infoValue: {
      fontSize: 16,
      color: isDark ? '#94a3b8' : '#64748b',
    },
  });
};