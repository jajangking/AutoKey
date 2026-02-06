import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface BluetoothDeviceItemProps {
  device: any;
  onSelect: (device: any) => void;
  onSaveDevice: (device: any) => void;
  theme: 'light' | 'dark' | 'oled';
}

const BluetoothDeviceItem: React.FC<BluetoothDeviceItemProps> = ({ 
  device, 
  onSelect, 
  onSaveDevice, 
  theme 
}) => {
  const isDark = theme === 'dark' || theme === 'oled';
  const isOled = theme === 'oled';

  const getSignalColor = (rssi: number | undefined) => {
    if (rssi === undefined) return '#94a3b8'; // Gray if no RSSI
    if (rssi >= -50) return '#4ade80'; // Strong signal - green
    if (rssi >= -70) return '#fbbf24'; // Medium signal - yellow
    return '#f87171'; // Weak signal - red
  };

  const styles = StyleSheet.create({
    deviceCard: {
      backgroundColor: isDark ? '#1e293b' : isOled ? '#000000' : '#f1f5f9',
      padding: 16,
      marginVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : isOled ? '#333333' : '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    deviceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    deviceName: {
      fontSize: 16,
      color: isDark ? '#e2e8f0' : isOled ? '#f1f5f9' : '#1e293b',
      fontWeight: '600',
      flex: 1,
    },
    deviceAddress: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : isOled ? '#cbd5e1' : '#64748b',
      marginTop: 4,
    },
    deviceRssi: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : isOled ? '#cbd5e1' : '#64748b',
      marginTop: 4,
    },
    signalStrength: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    deviceActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginLeft: 10,
    },
    selectButton: {
      backgroundColor: '#3b82f6', // Blue
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    saveButton: {
      backgroundColor: '#10b981', // Green
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 8,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    signalBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    signalBar: {
      width: 4,
      height: 12,
      backgroundColor: '#94a3b8',
    },
    signalBarEmpty: {
      backgroundColor: isDark ? '#4b5563' : isOled ? '#374151' : '#cbd5e1',
    },
  });

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>
            {device.name || 'Unknown Device'}
          </Text>
          <Text style={styles.deviceAddress}>
            ID: {device.id}
          </Text>
        </View>
        
        <View style={styles.signalStrength}>
          <MaterialCommunityIcons name="signal" size={16} color="#94a3b8" />
          <Text style={styles.deviceRssi}>
            {device.rssi !== undefined ? `${device.rssi} dBm` : 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.deviceActions}>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => onSelect(device)}
        >
          <Ionicons name="bluetooth" size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => onSaveDevice(device)}
        >
          <Ionicons name="save" size={16} color="#ffffff" />
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BluetoothDeviceItem;