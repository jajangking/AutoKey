#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

/* ================= PIN CONFIG ================= */
#define RELAY_CH1_PIN      27
#define RELAY_CH2_PIN      26
#define BUZZER_PIN         5
#define STATUS_LED_PIN     2
#define LED_KONTAK_PIN     19
#define PAIRING_BUTTON     4  // GPIO 4 untuk pairing button

/* ================= BLE UUID ================= */
#define SERVICE_UUID              "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONTROL_CHAR_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define STATUS_CHAR_UUID          "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define PAIRING_CHAR_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26aa"

/* ================= WHITELIST CONFIG ================= */
#define MAX_WHITELIST_SIZE   5
#define WHITELIST_PREF_NAME  "whitelist"
#define WHITELIST_KEY        "allowed_devices"

/* ================= GLOBAL ================= */
BLEServer* pServer = NULL;
BLECharacteristic* pControlCharacteristic = NULL;
BLECharacteristic* pStatusCharacteristic = NULL;
BLECharacteristic* pPairingCharacteristic = NULL;

Preferences preferences;

bool deviceConnected = false;
bool oldDeviceConnected = false;
bool pairingMode = false;
unsigned long pairingStartTime = 0;
const unsigned long pairingTimeout = 60000;  // 60 detik pairing mode

String allowedDevices[MAX_WHITELIST_SIZE];
int allowedDevicesCount = 0;

/* ===== Non-blocking pulse system ===== */
bool kontakPulseActive = false;
unsigned long kontakStartTime = 0;
const unsigned long kontakDuration = 200;

/* ================= HELPER FUNCTIONS ================= */

// Load whitelist from preferences
void loadWhitelist() {
  preferences.begin(WHITELIST_PREF_NAME, false);
  String stored = preferences.getString(WHITELIST_KEY, "");
  preferences.end();
  
  allowedDevicesCount = 0;
  if (stored.length() > 0) {
    int startIndex = 0;
    int endIndex;
    while ((endIndex = stored.indexOf(',', startIndex)) != -1 && allowedDevicesCount < MAX_WHITELIST_SIZE) {
      allowedDevices[allowedDevicesCount++] = stored.substring(startIndex, endIndex);
      startIndex = endIndex + 1;
    }
    if (allowedDevicesCount < MAX_WHITELIST_SIZE && startIndex < stored.length()) {
      allowedDevices[allowedDevicesCount++] = stored.substring(startIndex);
    }
  }
  
  Serial.print("Loaded whitelist (");
  Serial.print(allowedDevicesCount);
  Serial.println(" devices):");
  for (int i = 0; i < allowedDevicesCount; i++) {
    Serial.print("  - ");
    Serial.println(allowedDevices[i]);
  }
}

// Save whitelist to preferences
void saveWhitelist() {
  String stored = "";
  for (int i = 0; i < allowedDevicesCount; i++) {
    if (i > 0) stored += ",";
    stored += allowedDevices[i];
  }
  
  preferences.begin(WHITELIST_PREF_NAME, false);
  preferences.putString(WHITELIST_KEY, stored);
  preferences.end();
  
  Serial.print("Saved whitelist (");
  Serial.print(allowedDevicesCount);
  Serial.println(" devices)");
}

// Add device to whitelist
bool addToWhitelist(String macAddress) {
  // Check if already in whitelist
  for (int i = 0; i < allowedDevicesCount; i++) {
    if (allowedDevices[i] == macAddress) {
      Serial.println("Device already in whitelist");
      return true;
    }
  }
  
  // Check if whitelist is full
  if (allowedDevicesCount >= MAX_WHITELIST_SIZE) {
    Serial.println("Whitelist is full");
    return false;
  }
  
  // Add new device
  allowedDevices[allowedDevicesCount++] = macAddress;
  saveWhitelist();
  Serial.print("Added device to whitelist: ");
  Serial.println(macAddress);
  return true;
}

// Remove device from whitelist
bool removeFromWhitelist(String macAddress) {
  for (int i = 0; i < allowedDevicesCount; i++) {
    if (allowedDevices[i] == macAddress) {
      // Shift remaining devices
      for (int j = i; j < allowedDevicesCount - 1; j++) {
        allowedDevices[j] = allowedDevices[j + 1];
      }
      allowedDevicesCount--;
      saveWhitelist();
      Serial.print("Removed device from whitelist: ");
      Serial.println(macAddress);
      return true;
    }
  }
  return false;
}

// Check if device is in whitelist
bool isDeviceWhitelisted(String macAddress) {
  // If whitelist is empty, allow all (pairing mode)
  if (allowedDevicesCount == 0) {
    Serial.println("Whitelist empty - allowing all devices (pairing mode)");
    return true;
  }
  
  for (int i = 0; i < allowedDevicesCount; i++) {
    if (allowedDevices[i] == macAddress) {
      return true;
    }
  }
  return false;
}

// Get MAC address as string
String getMacAddressString(BLEServer* pServer) {
  esp_bd_addr_t addr;
  esp_read_mac(addr, ESP_MAC_BT);
  char mac[18];
  sprintf(mac, "%02X:%02X:%02X:%02X:%02X:%02X", 
          addr[0], addr[1], addr[2], addr[3], addr[4], addr[5]);
  return String(mac);
}

// Enter pairing mode
void enterPairingMode() {
  pairingMode = true;
  pairingStartTime = millis();
  digitalWrite(STATUS_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("=== PAIRING MODE ACTIVATED (60 seconds) ===");
}

// Exit pairing mode
void exitPairingMode() {
  pairingMode = false;
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.println("=== PAIRING MODE DEACTIVATED ===");
}

/* ================= SERVER CALLBACK ================= */
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    // Get client MAC address
    esp_bd_addr_t client_addr;
    uint16_t client_handle = pServer->getConnId();
    
    // Get connection info
    BLEAddress clientAddress = pServer->getPeerAddress(client_handle);
    String clientMac = clientAddress.toString();
    
    Serial.print("Connection attempt from: ");
    Serial.println(clientMac);
    
    // Check whitelist
    if (!isDeviceWhitelisted(clientMac) && !pairingMode) {
      Serial.println("Device NOT in whitelist - REJECTING connection!");
      digitalWrite(BUZZER_PIN, HIGH);
      delay(500);
      digitalWrite(BUZZER_PIN, LOW);
      pServer->disconnect(client_handle);
      return;
    }
    
    deviceConnected = true;
    digitalWrite(STATUS_LED_PIN, HIGH);
    Serial.println("BLE Connected (whitelisted)");
    
    // If in pairing mode, add device to whitelist
    if (pairingMode) {
      if (addToWhitelist(clientMac)) {
        Serial.println("Device added to whitelist during pairing");
        // Send notification that device was added
        uint8_t pairResponse = 0x01;  // Success
        pPairingCharacteristic->setValue(&pairResponse, 1);
        pPairingCharacteristic->notify();
      }
      exitPairingMode();
    }
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("BLE Disconnected");

    // Fail-safe OFF
    digitalWrite(RELAY_CH1_PIN, HIGH);
    digitalWrite(RELAY_CH2_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_KONTAK_PIN, LOW);

    pServer->getAdvertising()->start();
  }
  
  // Override onConnect with BLEAddress for proper MAC detection
  void onConnect(BLEServer* pServer, esp_ble_gatts_cb_param_t* param) {
    // This will be handled in the main onConnect
  }
};

/* ================= CONTROL CALLBACK ================= */
class ControlCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {

    if (!deviceConnected) return;

    std::string rxValue = pCharacteristic->getValue();
    if (rxValue.length() != 1) {
      Serial.println("Invalid data length");
      return;
    }

    uint8_t cmd = rxValue[0];

    Serial.print("CMD: 0x");
    Serial.println(cmd, HEX);

    switch(cmd) {

      case 0x01: // Relay CH1 ON
        digitalWrite(RELAY_CH1_PIN, LOW);
        break;

      case 0x10: // Relay CH1 OFF
        digitalWrite(RELAY_CH1_PIN, HIGH);
        break;

      case 0x02: // Relay CH2 ON
        digitalWrite(RELAY_CH2_PIN, LOW);
        break;

      case 0x20: // Relay CH2 OFF
        digitalWrite(RELAY_CH2_PIN, HIGH);
        break;

      case 0xB1: // Buzzer ON
        digitalWrite(BUZZER_PIN, HIGH);
        break;

      case 0xB0: // Buzzer OFF
        digitalWrite(BUZZER_PIN, LOW);
        break;

      case 0xC1: // Button Kontak Pulse
        digitalWrite(LED_KONTAK_PIN, HIGH);
        kontakPulseActive = true;
        kontakStartTime = millis();
        break;

      case 0xE1:
        digitalWrite(LED_KONTAK_PIN, HIGH);
        break;

      case 0xE0:
        digitalWrite(LED_KONTAK_PIN, LOW);
        break;

      case 0xF1: // Enter pairing mode
        enterPairingMode();
        break;

      case 0xF2: // Clear whitelist
        preferences.begin(WHITELIST_PREF_NAME, false);
        preferences.clear();
        preferences.end();
        loadWhitelist();
        Serial.println("Whitelist cleared");
        break;

      case 0xF3: // Get whitelist count (send back via status characteristic)
        {
          uint8_t count = allowedDevicesCount;
          pStatusCharacteristic->setValue(&count, 1);
          pStatusCharacteristic->notify();
          Serial.print("Whitelist count: ");
          Serial.println(count);
        }
        break;

      default:
        Serial.println("Unknown CMD");
        break;
    }
  }
};

/* ================= PAIRING CALLBACK ================= */
class PairingCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string rxValue = pCharacteristic->getValue();
    
    if (rxValue.length() >= 1) {
      uint8_t cmd = rxValue[0];
      
      switch(cmd) {
        case 0x01: // Request pairing mode
          enterPairingMode();
          break;
          
        case 0x02: // Remove specific device (need MAC in payload)
          // For simplicity, we'll handle this via control characteristic
          break;
          
        case 0x03: // Get whitelist info
          {
            // Send back whitelist count and status
            uint8_t response[2] = {allowedDevicesCount, pairingMode ? 1 : 0};
            pPairingCharacteristic->setValue(response, 2);
            pPairingCharacteristic->notify();
          }
          break;
      }
    }
  }
  
  void onRead(BLECharacteristic *pCharacteristic) {
    // Send current whitelist status
    uint8_t response[2] = {allowedDevicesCount, pairingMode ? 1 : 0};
    pPairingCharacteristic->setValue(response, 2);
  }
};

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_CH1_PIN, OUTPUT);
  pinMode(RELAY_CH2_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(LED_KONTAK_PIN, OUTPUT);
  pinMode(PAIRING_BUTTON, INPUT_PULLUP);

  // SAFE OFF (ACTIVE LOW relay)
  digitalWrite(RELAY_CH1_PIN, HIGH);
  digitalWrite(RELAY_CH2_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(LED_KONTAK_PIN, LOW);

  // Load whitelist from preferences
  loadWhitelist();

  // Boot self-test (no delay in BLE zone yet)
  digitalWrite(RELAY_CH1_PIN, LOW);
  digitalWrite(RELAY_CH2_PIN, LOW);
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(LED_KONTAK_PIN, HIGH);
  delay(300);
  digitalWrite(RELAY_CH1_PIN, HIGH);
  digitalWrite(RELAY_CH2_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_KONTAK_PIN, LOW);

  Serial.println("Starting BLE...");

  BLEDevice::init("ESP32_KEYLESS");
  BLEDevice::setMTU(128);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pControlCharacteristic = pService->createCharacteristic(
      CONTROL_CHAR_UUID,
      BLECharacteristic::PROPERTY_WRITE
  );

  pControlCharacteristic->setCallbacks(new ControlCallbacks());

  pStatusCharacteristic = pService->createCharacteristic(
      STATUS_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );

  pPairingCharacteristic = pService->createCharacteristic(
      PAIRING_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY
  );

  pPairingCharacteristic->setCallbacks(new PairingCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  BLEDevice::startAdvertising();

  Serial.println("Waiting for connection...");
  
  // Print whitelist status
  Serial.print("Whitelist status: ");
  Serial.print(allowedDevicesCount);
  Serial.print("/");
  Serial.println(MAX_WHITELIST_SIZE);
  if (allowedDevicesCount == 0) {
    Serial.println("PAIRING MODE: Open to all devices");
  }
}

/* ================= LOOP ================= */
void loop() {

  // Handle kontak pulse
  if (kontakPulseActive) {
    if (millis() - kontakStartTime >= kontakDuration) {
      digitalWrite(LED_KONTAK_PIN, LOW);
      kontakPulseActive = false;
    }
  }

  // Handle pairing mode timeout
  if (pairingMode && millis() - pairingStartTime >= pairingTimeout) {
    exitPairingMode();
  }

  // Handle pairing button (long press for 3 seconds)
  static unsigned long buttonPressTime = 0;
  static bool buttonPressed = false;
  
  if (digitalRead(PAIRING_BUTTON) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressTime = millis();
      Serial.println("Pairing button pressed");
    }
    
    // Long press detected (3 seconds)
    if (millis() - buttonPressTime >= 3000) {
      if (!pairingMode) {
        enterPairingMode();
      }
      buttonPressed = false;
    }
  } else {
    buttonPressed = false;
  }

  // Blink STATUS_LED when in pairing mode
  if (pairingMode) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink >= 500) {
      lastBlink = millis();
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    }
  }

  delay(10);
}