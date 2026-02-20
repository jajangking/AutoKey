import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Modal,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { loadAllSettings, saveAllSettings } from '@/utils/settingsManager';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  bleState: {
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    contactStatus: boolean;
  };
  sendRelayCH1Command: (on: boolean) => Promise<boolean>;
  sendRelayCH2Command: (on: boolean) => Promise<boolean>;
  sendBuzzerCommand: (on: boolean) => Promise<boolean>;
  sendLEDCommand: (on: boolean) => Promise<boolean>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, bleState, sendRelayCH1Command, sendRelayCH2Command, sendBuzzerCommand, sendLEDCommand }) => {
  const { theme } = useTheme();
  
  const [settings, setSettings] = useState({
    kontakOn: false,
    switchStandar: false,
    buzzer: false,
    statusBypass: false,
    statusMonitoring: true,
    autoRefresh: true
  });

  // Load settings when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  // Sync settings with ESP32 status when connection status changes
  useEffect(() => {
    if (bleState.connectionStatus === 'connected') {
      // Update settings to reflect current ESP32 state
      setSettings(prevSettings => ({
        ...prevSettings,
        kontakOn: bleState.contactStatus,
        // Note: We can't determine switchStandar, buzzer, and statusBypass states from current ESP32 status
        // These will remain as last saved values until we enhance the ESP32 firmware to report these
      }));
    }
  }, [bleState.connectionStatus, bleState.contactStatus, visible]);

  const loadSettings = async () => {
    try {
      const loadedSettings = await loadAllSettings();
      setSettings({
        kontakOn: loadedSettings.kontakOn || false,
        switchStandar: loadedSettings.switchStandar || false,
        buzzer: loadedSettings.buzzer || false,
        statusBypass: loadedSettings.statusBypass || false,
        statusMonitoring: loadedSettings.statusMonitoring !== undefined ? loadedSettings.statusMonitoring : true,
        autoRefresh: loadedSettings.autoRefresh !== undefined ? loadedSettings.autoRefresh : true
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    }
  };

  const saveSettings = async (updatedSettings: typeof settings) => {
    try {
      await saveAllSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  type SettingName = keyof typeof settings;

  const toggleSetting = async (settingName: SettingName) => {
    const currentValue = settings[settingName];
    const newValue = !currentValue;
    
    // Update local state immediately for UI responsiveness
    const updatedSettings = {
      ...settings,
      [settingName]: newValue
    };
    
    setSettings(updatedSettings);
    
    // Send command to ESP32 based on the setting being toggled
    let commandSuccess = true;
    
    if (bleState.connectionStatus === 'connected') {
      switch (settingName) {
        case 'kontakOn':
          commandSuccess = await sendRelayCH1Command(newValue);
          break;
        case 'switchStandar':
          commandSuccess = await sendRelayCH2Command(newValue);
          break;
        case 'buzzer':
          commandSuccess = await sendBuzzerCommand(newValue);
          break;
        case 'statusBypass':
          commandSuccess = await sendLEDCommand(newValue);
          break;
        default:
          // For settings that don't control hardware, just save to storage
          commandSuccess = true;
          break;
      }
      
      if (!commandSuccess) {
        Alert.alert('Error', `Failed to send command to device for ${settingName.replace(/([A-Z])/g, ' $1').trim()}.`);
        
        // Revert the UI state if command failed
        setSettings(settings);
        return;
      }
    }
    
    // Save settings to storage
    saveSettings(updatedSettings);
  };

  const styles = getStyles(theme);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>Settings</Text>

          {/* Connection Status Indicator */}
          <View style={styles.connectionStatusCard}>
            <View style={styles.connectionStatusRow}>
              <Text style={styles.connectionStatusText}>
                Device Connection: 
                <Text style={[
                  styles.connectionStatusValue,
                  bleState.connectionStatus === 'connected' ? styles.connected :
                  bleState.connectionStatus === 'connecting' ? styles.connecting :
                  styles.disconnected
                ]}>
                  {' '}{bleState.connectionStatus.charAt(0).toUpperCase() + bleState.connectionStatus.slice(1)}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Controls</Text>

            {/* Relay CH1 (Kontak) */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Relay CH1 (Kontak)</Text>
              <Switch
                value={settings.kontakOn}
                onValueChange={() => toggleSetting('kontakOn')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={bleState.connectionStatus !== 'connected'}
              />
            </View>

            {/* Relay CH2 (Switch Standar) */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Relay CH2 (Switch Standar)</Text>
              <Switch
                value={settings.switchStandar}
                onValueChange={() => toggleSetting('switchStandar')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={bleState.connectionStatus !== 'connected'}
              />
            </View>

            {/* Buzzer */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Buzzer</Text>
              <Switch
                value={settings.buzzer}
                onValueChange={() => toggleSetting('buzzer')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={bleState.connectionStatus !== 'connected'}
              />
            </View>

            {/* LED */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>LED</Text>
              <Switch
                value={settings.statusBypass}
                onValueChange={() => toggleSetting('statusBypass')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
                disabled={bleState.connectionStatus !== 'connected'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Settings</Text>

            {/* Status Monitoring */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Status Monitoring</Text>
              <Switch
                value={settings.statusMonitoring}
                onValueChange={() => toggleSetting('statusMonitoring')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
            </View>

            {/* Auto Refresh */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Auto Refresh</Text>
              <Switch
                value={settings.autoRefresh}
                onValueChange={() => toggleSetting('autoRefresh')}
                trackColor={{ false: '#767577', true: '#10b981' }}
                thumbColor={'#f4f4f4'}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: 'light' | 'dark' | 'oled') => {
  const isDark = theme === 'dark' || theme === 'oled';
  const isOled = theme === 'oled';

  return StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
      width: '90%',
      maxWidth: 500,
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#e2e8f0' : '#1e293b',
      marginBottom: 20,
      textAlign: 'center',
    },
    connectionStatusCard: {
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      width: '100%',
    },
    connectionStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    connectionStatusText: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    connectionStatusValue: {
      fontWeight: 'bold',
    },
    connected: {
      color: '#4ade80',
    },
    connecting: {
      color: '#fbbf24',
    },
    disconnected: {
      color: '#f87171',
    },
    section: {
      width: '100%',
      backgroundColor: isDark ? (isOled ? '#000000' : '#1e293b') : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
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
    settingLabel: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : '#1e293b',
      flex: 1,
    },
    closeButton: {
      backgroundColor: '#3b82f6',
      padding: 12,
      borderRadius: 8,
      marginTop: 10,
      width: '100%',
      alignItems: 'center',
    },
    closeButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
};

export default SettingsModal;