// Prebuild configuration for Expo
// This file is executed before the build process begins

import { ConfigPlugin, withPlugins } from '@expo/config-plugins';

const withCustomPrebuild: ConfigPlugin<void> = (config) => {
  // Custom prebuild logic can be added here
  console.log('Running custom prebuild configuration...');
  
  // You can modify config here if needed
  // For example, adding permissions, modifying Info.plist, etc.
  
  return config;
};

export default withCustomPrebuild;