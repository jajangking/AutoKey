import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWhitelist } from '../../context/WhitelistContext';

export default function BleWhitelistScreen() {
  const { whitelist, addToWhitelist, removeFromWhitelist } = useWhitelist();
  const router = useRouter();
  const [newAddress, setNewAddress] = React.useState('');

  const handleAddAddress = () => {
    if (!newAddress.trim()) {
      Alert.alert('Error', 'Alamat BLE tidak boleh kosong');
      return;
    }

    // Basic validation for MAC address format (AA:BB:CC:DD:EE:FF)
    const macRegex = /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/i;
    if (!macRegex.test(newAddress.trim())) {
      Alert.alert('Error', 'Format alamat MAC tidak valid. Gunakan format AA:BB:CC:DD:EE:FF');
      return;
    }

    addToWhitelist('ble', newAddress.trim());
    setNewAddress('');
  };

  const handleRemoveAddress = (address: string) => {
    Alert.alert(
      'Konfirmasi',
      `Hapus alamat BLE ${address} dari whitelist?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: () => removeFromWhitelist('ble', address)
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}>{item}</Text>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleRemoveAddress(item)}
      >
        <Text style={styles.deleteButtonText}>Hapus</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Whitelist BLE</Text>
      </View>

      <View style={styles.addContainer}>
        <TextInput
          style={styles.input}
          placeholder="Masukkan alamat MAC (AA:BB:CC:DD:EE:FF)"
          value={newAddress}
          onChangeText={setNewAddress}
          keyboardType="default"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
          <Text style={styles.addButtonText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={whitelist.ble}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada alamat BLE dalam whitelist</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    backgroundColor: '#1e3a8a',
  },
  backButton: {
    color: '#e2e8f0',
    fontSize: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  addContainer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemText: {
    color: '#e2e8f0',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});