import { useState, useEffect } from 'react';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { getPairedDevices as getPairedBleDevices, PairedDevice } from '../utils/bluetoothStorage';
import { BluetoothManager, BluetoothDevice } from 'react-native-bluetooth-classic';

// Interface untuk perangkat Bluetooth klasik
interface ClassicBluetoothDevice {
  id: string;
  name: string;
  address: string;
  type: 'classic';
  connected?: boolean;
}

// Hook untuk manajemen Bluetooth hibrida (BLE + klasik)
export const useHybridBluetooth = () => {
  const [bleDevices, setBleDevices] = useState<PairedDevice[]>([]);
  const [classicDevices, setClassicDevices] = useState<ClassicBluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<ClassicBluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);

  // Memuat perangkat BLE yang tersimpan
  useEffect(() => {
    loadPairedBleDevices();
  }, []);

  const loadPairedBleDevices = async () => {
    try {
      const devices = await getPairedBleDevices();
      setBleDevices(devices);
    } catch (error) {
      console.error('Gagal memuat perangkat BLE:', error);
    }
  };

  // Meminta izin Bluetooth
  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      // Untuk iOS, hanya perlu izin lokasi
      return true;
    }

    try {
      // Cek versi Android
      if (Platform.Version >= 31) { // Android 12+
        const permissions = [
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.BLUETOOTH_SCAN',
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const grantedResults = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(grantedResults).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        return allGranted;
      } else { // Android 10 dan sebelumnya
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const grantedResults = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(grantedResults).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        return allGranted;
      }
    } catch (error) {
      console.error('Gagal meminta izin Bluetooth:', error);
      return false;
    }
  };

  // Mendapatkan perangkat Bluetooth klasik yang dipasangkan
  const getPairedClassicDevices = async (): Promise<ClassicBluetoothDevice[]> => {
    try {
      const pairedDevices: BluetoothDevice[] = await BluetoothManager.getBondedDevices();

      const classicDevices: ClassicBluetoothDevice[] = pairedDevices.map(device => ({
        id: device.id,
        name: device.name || 'Perangkat Tanpa Nama',
        address: device.address,
        type: 'classic',
        connected: device.connected
      }));

      return classicDevices;
    } catch (error) {
      console.error('Gagal mendapatkan perangkat Bluetooth klasik:', error);
      Alert.alert('Error', 'Gagal mendapatkan perangkat Bluetooth klasik');
      return [];
    }
  };

  // Memindai perangkat Bluetooth klasik
  const scanClassicDevices = async () => {
    setIsScanning(true);

    try {
      const hasPermissions = await requestBluetoothPermissions();
      if (!hasPermissions) {
        Alert.alert('Izin Diperlukan', 'Izin Bluetooth diperlukan untuk memindai perangkat');
        return;
      }

      // Pastikan Bluetooth diaktifkan
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert('Bluetooth Mati', 'Silakan aktifkan Bluetooth terlebih dahulu');
        return;
      }

      // Dapatkan perangkat yang sudah dipasangkan
      const pairedDevices = await getPairedClassicDevices();
      setClassicDevices(pairedDevices);

      // Mulai pemindaian untuk perangkat baru
      try {
        await BluetoothManager.scanDevices().then(foundDevices => {
          const foundClassicDevices: ClassicBluetoothDevice[] = foundDevices.map(device => ({
            id: device.id,
            name: device.name || 'Perangkat Baru',
            address: device.address,
            type: 'classic',
            connected: device.connected
          }));

          // Gabungkan perangkat yang ditemukan dengan yang sudah dipasangkan
          const allDevices = [...new Map([
            ...pairedDevices.map(d => [d.id, d]),
            ...foundClassicDevices.map(d => [d.id, d])
          ]).values()];

          setClassicDevices(allDevices);
        });
      } catch (scanError) {
        console.warn('Pemindaian perangkat baru gagal:', scanError);
        // Gunakan hanya perangkat yang sudah dipasangkan
      }
    } catch (error) {
      console.error('Gagal memindai perangkat klasik:', error);
      Alert.alert('Error', 'Gagal memindai perangkat Bluetooth klasik');
    } finally {
      setIsScanning(false);
    }
  };

  // Menghubungkan ke perangkat klasik
  const connectToClassicDevice = async (device: ClassicBluetoothDevice) => {
    try {
      // Cek apakah perangkat sudah terhubung
      if (connectedDevice && connectedDevice.id === device.id) {
        Alert.alert('Info', 'Perangkat sudah terhubung');
        return;
      }

      // Hubungkan ke perangkat
      const connectionResult = await BluetoothManager.connectToDevice(device.id);

      if (connectionResult) {
        setConnectedDevice(device);

        // Update status perangkat
        setClassicDevices(prev =>
          prev.map(d =>
            d.id === device.id ? { ...d, connected: true } : d
          )
        );

        Alert.alert('Berhasil', `Terhubung ke ${device.name}`);
      } else {
        Alert.alert('Gagal', `Gagal menghubungkan ke ${device.name}`);
      }
    } catch (error) {
      console.error('Gagal menghubungkan ke perangkat klasik:', error);
      Alert.alert('Error', `Gagal menghubungkan ke ${device.name}: ${(error as Error).message}`);
    }
  };

  // Memutus koneksi dari perangkat klasik
  const disconnectFromClassicDevice = async () => {
    if (!connectedDevice) {
      Alert.alert('Info', 'Tidak ada perangkat yang terhubung');
      return;
    }

    try {
      await BluetoothManager.disconnectFromDevice(connectedDevice.id);

      // Update status perangkat
      setClassicDevices(prev =>
        prev.map(d =>
          d.id === connectedDevice.id ? { ...d, connected: false } : d
        )
      );

      setConnectedDevice(null);
      Alert.alert('Berhasil', 'Koneksi diputus');
    } catch (error) {
      console.error('Gagal memutus koneksi dari perangkat klasik:', error);
      Alert.alert('Error', 'Gagal memutus koneksi: ' + (error as Error).message);
    }
  };

  // Membuka pengaturan Bluetooth perangkat
  const openBluetoothSettings = () => {
    try {
      BluetoothManager.openBluetoothSettings();
    } catch (error) {
      console.error('Gagal membuka pengaturan Bluetooth:', error);
      Alert.alert('Error', 'Gagal membuka pengaturan Bluetooth');
    }
  };

  // Menghapus pairing perangkat
  const unpairDevice = async (deviceId: string) => {
    try {
      // Dalam implementasi nyata, kita akan memanggil fungsi untuk membatalkan pairing
      // karena sebagian besar pustaka tidak menyediakan fungsi ini secara langsung
      // pengguna biasanya harus membuka pengaturan Bluetooth untuk menghapus pairing

      Alert.alert(
        'Hapus Pairing',
        'Untuk menghapus pairing, buka Pengaturan > Bluetooth dan hapus perangkat dari sana.',
        [
          { text: 'Buka Pengaturan', onPress: openBluetoothSettings },
          { text: 'Batal', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Gagal menghapus pairing perangkat:', error);
      Alert.alert('Error', 'Gagal menghapus pairing perangkat');
    }
  };

  // Mengaktifkan Bluetooth
  const enableBluetooth = async (): Promise<boolean> => {
    try {
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        await BluetoothManager.enableBluetooth();
        return true;
      }
      return true;
    } catch (error) {
      console.error('Gagal mengaktifkan Bluetooth:', error);
      Alert.alert('Error', 'Gagal mengaktifkan Bluetooth: ' + (error as Error).message);
      return false;
    }
  };

  // Menonaktifkan Bluetooth
  const disableBluetooth = async (): Promise<boolean> => {
    try {
      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (isEnabled) {
        await BluetoothManager.disableBluetooth();
        return true;
      }
      return true;
    } catch (error) {
      console.error('Gagal menonaktifkan Bluetooth:', error);
      Alert.alert('Error', 'Gagal menonaktifkan Bluetooth: ' + (error as Error).message);
      return false;
    }
  };

  return {
    bleDevices,
    classicDevices,
    connectedDevice,
    isScanning,
    bluetoothEnabled,
    loadPairedBleDevices,
    scanClassicDevices,
    connectToClassicDevice,
    disconnectFromClassicDevice,
    unpairDevice,
    openBluetoothSettings,
    enableBluetooth,
    disableBluetooth,
    requestBluetoothPermissions,
  };
};