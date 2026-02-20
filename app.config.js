// Prebuild configuration for Expo
// This file is executed before the build process begins

export default {
  name: "AutoKey",
  slug: "AutoKey",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "autokey",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/be933b6c-23bd-43b7-a8db-32096f77032f"
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  extra: {
    eas: {
      projectId: "be933b6c-23bd-43b7-a8db-32096f77032f"
    }
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.jajang.AutoKey",
    infoPlist: {
      UIBackgroundModes: ['bluetooth-central', 'bluetooth-peripheral'],
      NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to connect to your motorcycle key system.",
      NSBluetoothPeripheralUsageDescription: "This app uses Bluetooth to connect to your motorcycle key system."
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png"
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.jajang.autokey",
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN'
    ]
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000"
        }
      }
    ],
    "react-native-ble-plx"
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  }
};