import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

// This tab points to the control screen in the app directory
export default function ControlTab() {
  return <Redirect href="/control" />;
}