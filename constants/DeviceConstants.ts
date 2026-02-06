// Device constants for AutoKey application
export const DEVICE_CONSTANTS = {
  // BLE device name
  BLE_DEVICE_NAME: 'ESP32_KEYLESS',
  
  // BLE service UUIDs
  SERVICE_UUID: '12345678-1234-1234-1234-123456789abc',
  CHARACTERISTIC_UUID: '87654321-4321-4321-4321-cba987654321',
  
  // Timeout values (in ms)
  CONNECTION_TIMEOUT: 10000,
  SCAN_TIMEOUT: 5000,
  
  // Command codes for communication
  COMMANDS: {
    UNLOCK: 0x01,
    LOCK: 0x02,
    REMOTE_ON: 0x03,
    REMOTE_OFF: 0x04,
    STATUS_REQUEST: 0x05,
  },
  
  // Response codes
  RESPONSES: {
    SUCCESS: 0x01,
    FAILED: 0x00,
    BUSY: 0x02,
  },
};

// Safety constants
export const SAFETY_CONSTANTS = {
  // Maximum time to wait for BLE connection before fallback
  MAX_BLE_WAIT_TIME: 30000, // 30 seconds
  
  // Minimum time between consecutive commands
  MIN_COMMAND_INTERVAL: 1000, // 1 second
  
  // Maximum number of retry attempts for critical operations
  MAX_RETRY_ATTEMPTS: 3,
};