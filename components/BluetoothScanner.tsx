import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface BluetoothScannerProps {
  bleManagerRef: React.RefObject<BleManager>;
  onDeviceSelect: (device: Device) => void;
  visible: boolean;
  onClose: () => void;
}

const BluetoothScanner: React.FC<BluetoothScannerProps> = ({
  bleManagerRef,
  onDeviceSelect,
  visible,
  onClose
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !isScanning) {
      startScan();
    }

    return () => {
      if (isScanning && bleManagerRef.current) {
        bleManagerRef.current.stopDeviceScan();
        setIsScanning(false);
      }
    };
  }, [visible]);

  const startScan = async () => {
    try {
      if (!bleManagerRef.current) {
        throw new Error('BLE Manager not initialized');
      }

      setScanError(null);
      setIsScanning(true);

      // Clear previous devices
      setDevices([]);

      // Check if Bluetooth is enabled
      const state = await bleManagerRef.current.state();
      if (state !== 'PoweredOn') {
        throw new Error('Bluetooth is not enabled');
      }

      // Start scanning
      bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          setScanError(error.message);
          setIsScanning(false);
          return;
        }

        if (device) {
          // Add new device to the list if not already present
          setDevices(prevDevices => {
            const existingDevice = prevDevices.find(d => d.id === device.id);
            if (existingDevice) {
              // Update existing device with new info
              return prevDevices.map(d =>
                d.id === device.id ? device : d
              );
            } else {
              // Add new device
              return [...prevDevices, device];
            }
          });
        }
      });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'An error occurred');
      setIsScanning(false);
    }
  };

  const handleDevicePress = (device: Device) => {
    onDeviceSelect(device);
    closeModal();
  };

  const closeModal = () => {
    if (isScanning) {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }
    onClose();
  };

  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity 
      style={styles.deviceItem}
      onPress={() => handleDevicePress(item)}
    >
      <ThemedText style={styles.deviceName}>
        {item.name || 'Unknown Device'}
      </ThemedText>
      <ThemedText style={styles.deviceId}>
        ID: {item.id}
      </ThemedText>
      {item.rssi !== undefined && (
        <ThemedText style={styles.deviceRssi}>
          RSSI: {item.rssi} dBm
        </ThemedText>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={closeModal}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <ThemedText style={styles.modalTitle}>
            Available Bluetooth Devices
          </ThemedText>
          
          {scanError ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>
                Error: {scanError}
              </ThemedText>
            </View>
          ) : null}
          
          <FlatList
            data={devices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {isScanning ? (
                  <>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <ThemedText style={styles.emptyText}>
                      Scanning for devices...
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText style={styles.emptyText}>
                    No devices found. Tap "Scan" to search.
                  </ThemedText>
                )}
              </View>
            }
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.scanButton]}
              onPress={startScan}
              disabled={isScanning}
            >
              <ThemedText style={styles.buttonText}>
                {isScanning ? 'Scanning...' : 'Scan Again'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={closeModal}
            >
              <ThemedText style={styles.buttonText}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#888',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  scanButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default BluetoothScanner;