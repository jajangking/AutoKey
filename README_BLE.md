# AutoKey - Keyless Motor System Mobile App

This React Native application connects to an ESP32 microcontroller via Bluetooth Low Energy (BLE) to control a keyless motor system. The app allows users to scan for, connect to, and control an ESP32 device named "ESP32_KEYLESS" using GATT protocol.

## Features

- Scans for ESP32 devices with the name "ESP32_KEYLESS"
- Automatic connection to the device when found
- Real-time status monitoring (BT Connected, Ready, WiFi)
- Control commands (Kontak ON/OFF) to send to the ESP32
- Activity log showing all BLE events
- Auto-reconnection when device comes back online
- Visual LED indicators for system status

## Prerequisites

- Node.js (v14 or higher)
- Expo CLI or Expo Go app on your mobile device
- An ESP32 programmed with BLE GATT server (with matching service UUIDs)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd autokey
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Make sure your ESP32 is programmed with the corresponding BLE firmware that:
   - Advertises with the name "ESP32_KEYLESS"
   - Implements the service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
   - Has characteristics:
     - Control: `beb5483e-36e1-4688-b7f5-ea07361b26a8` (for sending commands)
     - Status: `beb5483e-36e1-4688-b7f5-ea07361b26a9` (for receiving status updates)

## Running the Application

### On Physical Device (Recommended)
1. Install the Expo Go app from your device's app store
2. Run the following command:
```bash
npx expo start
```
3. Scan the QR code with the Expo Go app

### On Emulator
- For Android: `npx expo start --android`
- For iOS: `npx expo start --ios`

## Usage

1. Make sure your ESP32 is powered on and advertising as "ESP32_KEYLESS"
2. Launch the app - it will automatically start scanning for the device
3. Once connected, you'll see the connection status and LED indicators
4. Use the "Kontak ON/OFF" button to send commands to the ESP32
5. Monitor the activity log for connection events and command acknowledgments

## Architecture

- `app/index.tsx` - Main application screen with UI components
- `hooks/useBLE.ts` - Custom hook managing all BLE operations
- Uses `expo-bluetooth` for BLE functionality
- Compatible with both Android and iOS

## Troubleshooting

- Make sure Bluetooth permissions are granted
- On Android, location services need to be enabled for BLE scanning
- Ensure your ESP32 is advertising with the correct name and UUIDs
- Check that the ESP32 firmware implements the expected GATT services and characteristics

## Service and Characteristic UUIDs

The app expects the ESP32 to implement:
- Service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- Control Characteristic: `beb5483e-36e1-4688-b7f5-ea07361b26a8` (Write)
- Status Characteristic: `beb5483e-36e1-4688-b7f5-ea07361b26a9` (Notify)

## Status Data Format

The status characteristic should send a byte with bits representing:
- Bit 0: Contact status (1=ON, 0=OFF)
- Bit 1: Ready status (1=Ready, 0=Not Ready)
- Bit 2: WiFi status (1=Connected, 0=Disconnected)