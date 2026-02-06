declare module 'expo-bluetooth' {
  export class BleManager {
    constructor();
    enable(): Promise<boolean>;
    requestPermissionsAsync(): Promise<boolean>;
    getStateAsync(): Promise<string>;
    startDeviceScan(
      serviceUUIDs: string[] | null,
      options: { allowDuplicates?: boolean; filter?: (device: Device) => boolean },
      callback: (error: Error | null, device: Device | null) => void
    ): Promise<void>;
    stopDeviceScan(): void;
    connectToDevice(deviceId: string): Promise<void>;
    getConnectedDevice(deviceId: string): Promise<Device>;
    cancelDeviceConnection(deviceId: string): Promise<void>;
    onDeviceDisconnected(
      callback: (device: Device) => void,
      deviceIds?: string[]
    ): { remove: () => void };
    onStateChange(
      callback: (state: string) => void,
      emitCurrentState: boolean
    ): { remove: () => void };
    destroy(): void;
  }

  export interface Device {
    id: string;
    name?: string;
    rssi?: number;
    manufacturerData?: { [key: string]: string };
    serviceData?: { [uuid: string]: string };
    serviceUUIDs?: string[];
    isConnectable?: boolean;
    isConnected: boolean;
    isPaired: boolean;
    discoverAllServicesAndCharacteristics(): Promise<void>;
    monitorCharacteristicForService(
      serviceUUID: string,
      characteristicUUID: string,
      callback: (error: Error | null, characteristic: Characteristic | null) => void
    ): Promise<Subscription>;
    writeCharacteristicWithResponseForService(
      serviceUUID: string,
      characteristicUUID: string,
      value: string
    ): Promise<void>;
  }

  export interface Characteristic {
    value?: string;
    uuid: string;
    serviceUUID: string;
    isNotifying: boolean;
    isValid: boolean;
    permissions: string[];
    properties: {
      broadcast: boolean;
      extendedProperties: boolean;
      indicate: boolean;
      notify: boolean;
      read: boolean;
      reliableWrite: boolean;
      signedWrite: boolean;
      write: boolean;
      writeWithoutResponse: boolean;
    };
  }

  export interface Subscription {
    remove(): void;
  }
}