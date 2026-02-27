#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

/* ================= HARDWARE ================= */

#define RELAY1 27
#define RELAY2 26
#define BUZZER 5
#define LED_STATUS 2
#define LED_KONTAK 19
#define BTN_KONTAK 4

/* ================= BLE CONFIG ================= */

#define DEVICE_NAME "ESP32_KEYLESS"

#define SERVICE_UUID  "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONTROL_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define STATUS_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define AUTH_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26aa"

#define MAX_WHITELIST 5
#define TOKEN_LENGTH 32  // 32 character token

/* ================= GLOBAL ================= */

BLEServer* pServer;
BLECharacteristic* controlChar;
BLECharacteristic* statusChar;
BLECharacteristic* authChar;

Preferences prefs;

String whitelist[MAX_WHITELIST];
uint8_t whitelistCount = 0;

bool deviceConnected = false;
bool authorized = false;

unsigned long kontakTimer = 0;
bool kontakPulseActive = false;

unsigned long lastButtonPress = 0;
unsigned long authTimeout = 0;

/* ================= SAFE STATE ================= */

void safeState() {
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(BUZZER, LOW);
  digitalWrite(LED_KONTAK, LOW);
}

/* ================= WHITELIST ================= */

void loadWhitelist() {
  prefs.begin("whitelist", false);
  whitelistCount = prefs.getUChar("count", 0);
  for (uint8_t i = 0; i < whitelistCount; i++) {
    whitelist[i] = prefs.getString(("id" + String(i)).c_str(), "");
  }
  prefs.end();
  
  Serial.print("Whitelist loaded: ");
  Serial.print(whitelistCount);
  Serial.println(" tokens");
}

void saveWhitelist() {
  prefs.begin("whitelist", false);
  prefs.putUChar("count", whitelistCount);
  for (uint8_t i = 0; i < whitelistCount; i++) {
    prefs.putString(("id" + String(i)).c_str(), whitelist[i]);
  }
  prefs.end();
}

bool isTokenWhitelisted(String token) {
  if (whitelistCount == 0) return false;
  
  for (uint8_t i = 0; i < whitelistCount; i++) {
    if (whitelist[i] == token) return true;
  }
  return false;
}

void addTokenToWhitelist(String token) {
  if (whitelistCount >= MAX_WHITELIST) {
    Serial.println("Whitelist FULL");
    return;
  }
  
  // Check if already exists
  for (uint8_t i = 0; i < whitelistCount; i++) {
    if (whitelist[i] == token) {
      Serial.println("Token already in whitelist");
      return;
    }
  }
  
  whitelist[whitelistCount++] = token;
  saveWhitelist();
  Serial.print("Token added to whitelist. Count: ");
  Serial.println(whitelistCount);
}

void clearWhitelist() {
  prefs.begin("whitelist", false);
  prefs.clear();
  prefs.end();
  whitelistCount = 0;
  for (uint8_t i = 0; i < MAX_WHITELIST; i++) {
    whitelist[i] = "";
  }
  Serial.println("Whitelist CLEARED");
}

// Generate random token (32 char hex string)
String generateToken() {
  String token = "";
  randomSeed(millis() + analogRead(0)); // Use analog noise for seed
  
  for (int i = 0; i < TOKEN_LENGTH; i++) {
    byte randomByte = random(0, 256);
    char hex[3];
    sprintf(hex, "%02X", randomByte);
    token += String(hex);
  }
  return token;
}

/* ================= CALLBACK ================= */

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) {
    deviceConnected = true;
    authorized = false;
    digitalWrite(LED_STATUS, HIGH);
    
    // Set auth timeout (5 seconds)
    authTimeout = millis() + 5000;
    
    Serial.println("Connected - waiting for auth token...");
  }

  void onDisconnect(BLEServer* server) {
    deviceConnected = false;
    authorized = false;
    safeState();
    digitalWrite(LED_STATUS, LOW);
    
    Serial.println("Disconnected - Fail Safe");
    
    // Restart advertising
    BLEDevice::startAdvertising();
  }
};

class AuthCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    std::string value = characteristic->getValue();
    if (value.length() == 0) return;

    String token = "";
    for (size_t i = 0; i < value.length(); i++) {
      token += (char)value[i];
    }

    Serial.print("Auth token received (");
    Serial.print(value.length());
    Serial.print(" chars): ");
    Serial.println(token);

    // Check if whitelist is empty - auto-add first token as OWNER
    if (whitelistCount == 0) {
      Serial.println("Whitelist empty - auto-adding as OWNER");
      addTokenToWhitelist(token);
      authorized = true;
      
      statusChar->setValue("OWNER_ADDED");
      statusChar->notify();
      
      Serial.println("OWNER_ADDED sent");
      return;
    }

    // Check if token matches whitelist
    if (isTokenWhitelisted(token)) {
      authorized = true;
      Serial.println("AUTHORIZED");
      statusChar->setValue("AUTHORIZED");
      statusChar->notify();
      Serial.println("AUTHORIZED sent");
    } else {
      authorized = false;
      Serial.println("DENIED - Token not in whitelist");
      statusChar->setValue("DENIED");
      statusChar->notify();
      
      // Disconnect after short delay
      delay(200);
      pServer->disconnect(0);
      Serial.println("Connection rejected - DENIED");
    }
  }
};

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    // Check authorization first
    if (!authorized) {
      Serial.println("Command REJECTED - not authorized");
      statusChar->setValue("NOT_AUTH");
      statusChar->notify();
      return;
    }

    std::string value = characteristic->getValue();
    if (value.length() == 0) return;

    uint8_t cmd = value[0];

    Serial.print("Command: 0x");
    Serial.println(cmd, HEX);

    switch (cmd) {
      // Relay CH1
      case 0x01: 
        digitalWrite(RELAY1, LOW); 
        Serial.println("Relay CH1 ON");
        break;
      case 0x10: 
        digitalWrite(RELAY1, HIGH); 
        Serial.println("Relay CH1 OFF");
        break;

      // Relay CH2
      case 0x02: 
        digitalWrite(RELAY2, LOW); 
        Serial.println("Relay CH2 ON");
        break;
      case 0x20: 
        digitalWrite(RELAY2, HIGH); 
        Serial.println("Relay CH2 OFF");
        break;

      // Buzzer
      case 0xB1: 
        digitalWrite(BUZZER, HIGH); 
        Serial.println("Buzzer ON");
        break;
      case 0xB0: 
        digitalWrite(BUZZER, LOW); 
        Serial.println("Buzzer OFF");
        break;

      // Kontak pulse (momentary)
      case 0xC1:
        digitalWrite(LED_KONTAK, HIGH);
        digitalWrite(RELAY1, LOW);
        kontakTimer = millis();
        kontakPulseActive = true;
        Serial.println("Kontak PULSE");
        break;

      // LED Status
      case 0xE1: 
        digitalWrite(LED_STATUS, HIGH); 
        break;
      case 0xE0: 
        digitalWrite(LED_STATUS, LOW); 
        break;

      // Enter pairing mode (accept all devices for 60 seconds)
      case 0xF1: {
        Serial.println("=== PAIRING MODE ACTIVATED (60 seconds) ===");
        // Clear whitelist temporarily
        clearWhitelist();
        // ESP32 will auto-add first device that connects
        statusChar->setValue("PAIRING_ON");
        statusChar->notify();
        break;
      }

      // Clear whitelist
      case 0xF2:
        clearWhitelist();
        statusChar->setValue("WL_CLEARED");
        statusChar->notify();
        Serial.println("Whitelist cleared via command");
        break;

      // Get whitelist count
      case 0xF3: {
        uint8_t count = whitelistCount;
        statusChar->setValue(&count, 1);
        statusChar->notify();
        Serial.print("Whitelist count sent: ");
        Serial.println(count);
        break;
      }

      // Read whitelist entries (returns all tokens)
      case 0xF4: {
        Serial.println("Reading whitelist entries...");
        
        // Send count first
        uint8_t count = whitelistCount;
        statusChar->setValue(&count, 1);
        statusChar->notify();
        delay(50);
        
        // Send each token
        for (uint8_t i = 0; i < whitelistCount; i++) {
          // Format: index (1 byte) + token length (1 byte) + token string
          String token = whitelist[i];
          uint8_t tokenLen = token.length();
          
          // Create buffer: [index][length][token bytes...]
          uint8_t buffer[34]; // 1 + 1 + 32 max
          buffer[0] = i; // Index
          buffer[1] = tokenLen; // Token length
          
          for (int j = 0; j < tokenLen && j < 32; j++) {
            buffer[2 + j] = token.charAt(j);
          }
          
          statusChar->setValue(buffer, 2 + tokenLen);
          statusChar->notify();
          delay(100); // Give time for BLE to send
        }
        
        Serial.println("Whitelist entries sent");
        break;
      }

      default:
        Serial.println("Unknown command");
        statusChar->setValue("UNKNOWN");
        statusChar->notify();
        break;
    }
  }
};

/* ================= SETUP ================= */

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED_STATUS, OUTPUT);
  pinMode(LED_KONTAK, OUTPUT);
  pinMode(BTN_KONTAK, INPUT_PULLUP);

  safeState();

  prefs.begin("whitelist", false);
  loadWhitelist();
  prefs.end();

  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(128);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* service = pServer->createService(SERVICE_UUID);

  // Control characteristic (WRITE)
  controlChar = service->createCharacteristic(
                  CONTROL_UUID,
                  BLECharacteristic::PROPERTY_WRITE
                );
  controlChar->setCallbacks(new ControlCallbacks());

  // Status characteristic (READ + NOTIFY)
  statusChar = service->createCharacteristic(
                 STATUS_UUID,
                 BLECharacteristic::PROPERTY_READ |
                 BLECharacteristic::PROPERTY_NOTIFY
               );
  statusChar->addDescriptor(new BLE2902());

  // Auth characteristic (WRITE)
  authChar = service->createCharacteristic(
               AUTH_UUID,
               BLECharacteristic::PROPERTY_WRITE
             );
  authChar->setCallbacks(new AuthCallbacks());

  service->start();
  pServer->getAdvertising()->start();

  Serial.println("=== ESP32 KEYLESS READY ===");
  Serial.print("Whitelist: ");
  Serial.print(whitelistCount);
  Serial.println(" tokens");
  if (whitelistCount == 0) {
    Serial.println("MODE: OPEN (first token becomes OWNER)");
  } else {
    Serial.println("MODE: WHITELIST (only authorized tokens)");
  }
}

/* ================= LOOP ================= */

void loop() {
  // Non-blocking kontak pulse (200ms)
  if (kontakPulseActive && millis() - kontakTimer >= 200) {
    digitalWrite(RELAY1, HIGH);
    digitalWrite(LED_KONTAK, LOW);
    kontakPulseActive = false;
    Serial.println("Kontak pulse END");
  }

  // Check auth timeout
  if (deviceConnected && !authorized && authTimeout > 0 && millis() > authTimeout) {
    Serial.println("Auth timeout - disconnecting");
    pServer->disconnect(0);
    authTimeout = 0;
  }

  // Tombol kontak fisik
  if (!digitalRead(BTN_KONTAK)) {
    if (millis() - lastButtonPress > 300) {
      digitalWrite(LED_KONTAK, HIGH);
      digitalWrite(RELAY1, LOW);
      kontakTimer = millis();
      kontakPulseActive = true;
      lastButtonPress = millis();
      Serial.println("Physical button pressed - kontak pulse");
    }
  }
  
  delay(10);
}
