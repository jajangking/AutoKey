import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ErrorHandler, AppError } from '@/utils/errorHandler';

interface ErrorDisplayProps {
  visible: boolean;
  onClose: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ visible, onClose }) => {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    if (visible) {
      setErrors(ErrorHandler.getRecentErrors());
    }
  }, [visible]);

  const clearErrors = () => {
    ErrorHandler.clearErrors();
    setErrors([]);
  };

  const renderErrorItem = ({ item }: { item: AppError }) => (
    <View style={styles.errorItem}>
      <Text style={styles.errorType}>{item.type}</Text>
      <Text style={styles.errorMessage}>{item.message}</Text>
      <Text style={styles.errorTime}>
        {item.timestamp.toLocaleTimeString()}
      </Text>
      {item.details && (
        <Text style={styles.errorDetails}>
          Details: {JSON.stringify(item.details)}
        </Text>
      )}
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Error Log</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={errors}
          renderItem={renderErrorItem}
          keyExtractor={(item, index) => `${item.timestamp.getTime()}-${index}`}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No errors logged</Text>
          }
        />

        <TouchableOpacity onPress={clearErrors} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear Errors</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  closeButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  errorItem: {
    backgroundColor: '#1e293b',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f87171',
    marginBottom: 5,
  },
  errorMessage: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 5,
  },
  errorTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 5,
  },
  errorDetails: {
    fontSize: 12,
    color: '#fbbf24',
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  clearButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ErrorDisplay;