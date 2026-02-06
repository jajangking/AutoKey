import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for log entries
type LogEntry = {
  id: string;
  timestamp: Date;
  type: 'ble_connect' | 'ble_disconnect' | 'wifi_connect' | 'wifi_disconnect' | 'kontak_on' | 'kontak_off' | 'remote_on' | 'remote_off';
  deviceInfo?: string; // MAC address or SSID
  status?: string; // Additional status info
};

type LogContextType = {
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], deviceInfo?: string, status?: string) => void;
  clearLogs: () => void;
};

// Create the context
const LogContext = createContext<LogContextType | undefined>(undefined);

// Log Provider Component
export const LogProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Load logs from storage on mount
  useEffect(() => {
    loadLogsFromStorage();
  }, []);

  const loadLogsFromStorage = async () => {
    try {
      const storedLogs = await AsyncStorage.getItem('app_logs');
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        // Convert string timestamps back to Date objects
        const logsWithDates = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
        setLogs(logsWithDates);
      }
    } catch (error) {
      console.error('Error loading logs from storage:', error);
    }
  };

  // Save logs to storage whenever they change
  useEffect(() => {
    saveLogsToStorage();
  }, [logs]);

  const saveLogsToStorage = async () => {
    try {
      // Keep only the most recent 100 logs to prevent storage bloat
      const logsToSave = logs.slice(-100).map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      }));
      await AsyncStorage.setItem('app_logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.error('Error saving logs to storage:', error);
    }
  };

  const addLog = (type: LogEntry['type'], deviceInfo?: string, status?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Generate unique ID
      timestamp: new Date(),
      type,
      deviceInfo,
      status,
    };

    setLogs(prev => [newLog, ...prev]); // Add new log to the beginning
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <LogContext.Provider
      value={{
        logs,
        addLog,
        clearLogs,
      }}
    >
      {children}
    </LogContext.Provider>
  );
};

// Custom hook to use the log context
export const useLog = (): LogContextType => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
};