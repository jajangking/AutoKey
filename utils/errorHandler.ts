import { Alert } from 'react-native';

export enum ErrorType {
  BLE_CONNECTION = 'ble_connection_error',
  BLUETOOTH_DISABLED = 'bluetooth_disabled',
  PERMISSION_DENIED = 'permission_denied',
  DEVICE_NOT_FOUND = 'device_not_found',
  CONNECTION_TIMEOUT = 'connection_timeout',
  DISCONNECTED = 'disconnected',
  UNKNOWN = 'unknown_error',
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  handled: boolean;
}

export class ErrorHandler {
  private static errors: AppError[] = [];

  /**
   * Log error to internal storage
   */
  static logError(type: ErrorType, message: string, details?: any): AppError {
    const error: AppError = {
      type,
      message,
      details,
      timestamp: new Date(),
      handled: false,
    };

    this.errors.push(error);
    
    // Keep only last 100 errors to prevent memory issues
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    console.error(`[${type}] ${message}`, details);
    return error;
  }

  /**
   * Handle error with appropriate UI response
   */
  static handleError(error: AppError | ErrorType, message?: string, details?: any): void {
    let appError: AppError;

    if (typeof error === 'string') {
      // If error is just a type, create new error
      appError = this.logError(error, message || 'An error occurred', details);
    } else {
      // If error is already an AppError, just log it
      appError = error;
      this.logError(error.type, error.message, error.details);
    }

    // Mark as handled
    appError.handled = true;

    // Show appropriate alert based on error type
    this.showAlert(appError);
  }

  /**
   * Show appropriate alert based on error type
   */
  private static showAlert(error: AppError): void {
    switch (error.type) {
      case ErrorType.BLUETOOTH_DISABLED:
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
        break;
        
      case ErrorType.PERMISSION_DENIED:
        Alert.alert(
          'Permission Denied',
          'This app needs Bluetooth permissions to function properly. Please grant the required permissions in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => this.openAppSettings() }
          ]
        );
        break;
        
      case ErrorType.CONNECTION_TIMEOUT:
        Alert.alert(
          'Connection Timeout',
          'Could not connect to the device. Please make sure the device is nearby and try again.',
          [{ text: 'OK' }]
        );
        break;
        
      case ErrorType.DEVICE_NOT_FOUND:
        Alert.alert(
          'Device Not Found',
          'The device could not be found. Please make sure it is turned on and in range.',
          [{ text: 'OK' }]
        );
        break;
        
      case ErrorType.DISCONNECTED:
        // For disconnection, just log it - don't show alert as it might be intentional
        console.log('Device disconnected:', error.message);
        break;
        
      default:
        Alert.alert(
          'An Error Occurred',
          error.message || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
    }
  }

  /**
   * Open app settings (implementation depends on platform)
   */
  private static openAppSettings(): void {
    // This would typically use Linking.openURL to open app settings
    // For now, we'll just log it
    console.log('Opening app settings...');
  }

  /**
   * Get recent errors
   */
  static getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count).reverse();
  }

  /**
   * Clear all errors
   */
  static clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get count of unhandled errors
   */
  static getUnhandledErrorCount(): number {
    return this.errors.filter(e => !e.handled).length;
  }
}

/**
 * Utility function to wrap async operations with error handling
 */
export const withErrorHandler = async <T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  errorMessage: string
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    ErrorHandler.handleError(errorType, errorMessage, error);
    return null;
  }
};