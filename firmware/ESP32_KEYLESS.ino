#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

/* ================= PIN CONFIG ================= */
#define RELAY_CH1_PIN      27
#define RELAY_CH2_PIN      26
#define BUZZER_PIN         5
#define STATUS_LED_PIN     2
#define LED_KONTAK_PIN     19

/* ================= BLE UUID ================= */
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONTROL_CHAR_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a8"

/* ================= GLOBAL ================= */
BLEServer* pServer = NULL;
BLECharacteristic* pControlCharacteristic = NULL;

bool deviceConnected = false;
bool oldDeviceConnected = false;

/* ===== Non-blocking pulse system ===== */
bool kontakPulseActive = false;
unsigned long kontakStartTime = 0;
const unsigned long kontakDuration = 200;

/* ================= SERVER CALLBACK ================= */
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    digitalWrite(STATUS_LED_PIN, HIGH);
    Serial.println("BLE Connected");
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

      default:
        Serial.println("Unknown CMD");
        break;
    }
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

  // SAFE OFF (ACTIVE LOW relay)
  digitalWrite(RELAY_CH1_PIN, HIGH);
  digitalWrite(RELAY_CH2_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(LED_KONTAK_PIN, LOW);

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

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  BLEDevice::startAdvertising();

  Serial.println("Waiting for connection...");
}

/* ================= LOOP ================= */
void loop() {

  if (kontakPulseActive) {
    if (millis() - kontakStartTime >= kontakDuration) {
      digitalWrite(LED_KONTAK_PIN, LOW);
      kontakPulseActive = false;
    }
  }

  delay(10);
}