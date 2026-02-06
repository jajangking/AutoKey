const fs = require('fs');
const path = require('path');

console.log('Running prebuild script for AutoKey...');

// Function to check if required dependencies are installed
function checkDependencies() {
  const requiredDeps = [
    'react-native-ble-plx',
    '@react-native-async-storage/async-storage',
    'expo',
    '@react-navigation/native',
    'react-native-gesture-handler',
    'react-native-reanimated'
  ];

  console.log('Checking for required dependencies...');

  requiredDeps.forEach(dep => {
    try {
      require.resolve(dep);
      console.log(`✓ ${dep} is installed`);
    } catch (e) {
      console.warn(`⚠ ${dep} is not installed`);
    }
  });
}

// Function to validate necessary files exist
function validateFiles() {
  const requiredFiles = [
    './hooks/useBLE.ts',
    './app/index.tsx',
    './components/BluetoothDeviceItem.tsx',
    './app.config.js',
    './package.json'
  ];

  console.log('Validating required files...');

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✓ ${file} exists`);
    } else {
      console.error(`✗ ${file} does not exist`);
    }
  });
}

// Function to create necessary directories if they don't exist
function createDirectories() {
  const dirs = ['./logs', './dist', './build'];

  console.log('Creating necessary directories...');

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    } else {
      console.log(`✓ Directory exists: ${dir}`);
    }
  });
}

// Function to backup important files
function backupFiles() {
  const filesToBackup = [
    './package.json',
    './app.json',
    './tsconfig.json',
    './hooks/useBLE.ts',
    './app/index.tsx'
  ];

  const backupDir = './backup';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✓ Created backup directory: ${backupDir}`);
  }

  console.log('Backing up important files...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  filesToBackup.forEach(file => {
    if (fs.existsSync(file)) {
      const fileName = path.basename(file);
      const backupPath = path.join(backupDir, `${fileName}_${timestamp}`);
      fs.copyFileSync(file, backupPath);
      console.log(`✓ Backed up ${file} to ${backupPath}`);
    } else {
      console.warn(`⚠ File ${file} does not exist, skipping backup`);
    }
  });
}

// Function to validate BLE permissions in app configuration
function validateBLEPermissions() {
  console.log('Validating BLE permissions in app configuration...');

  try {
    const appConfig = fs.readFileSync('./app.json', 'utf8');
    const config = JSON.parse(appConfig);

    // Check for Android permissions
    if (config.expo.plugins) {
      const blePlugin = config.expo.plugins.find(plugin =>
        (Array.isArray(plugin) && plugin[0] === 'react-native-ble-plx') || 
        (typeof plugin === 'string' && plugin === 'react-native-ble-plx')
      );

      if (blePlugin) {
        console.log('✓ BLE plugin configuration found in app.json');
      } else {
        console.warn('⚠ BLE plugin configuration not found in app.json');
      }
    }

    // Check for iOS permissions
    if (config.expo.ios?.infoPlist) {
      const plist = config.expo.ios.infoPlist;
      if (plist.NSBluetoothAlwaysUsageDescription || plist.NSBluetoothPeripheralUsageDescription) {
        console.log('✓ iOS Bluetooth permissions found in app.json');
      } else {
        console.warn('⚠ iOS Bluetooth permissions not found in app.json');
      }
    }
  } catch (e) {
    console.warn('⚠ Could not validate BLE permissions:', e.message);
  }
}

// Main prebuild process
function runPrebuild() {
  console.log('Starting prebuild process for AutoKey...\n');

  checkDependencies();
  console.log(); // Empty line for readability

  validateFiles();
  console.log(); // Empty line for readability

  createDirectories();
  console.log(); // Empty line for readability

  backupFiles();
  console.log(); // Empty line for readability

  validateBLEPermissions();
  console.log(); // Empty line for readability

  // Create/update timestamp file
  const timestamp = new Date().toISOString();
  fs.writeFileSync('./logs/build-timestamp.txt', timestamp);
  console.log(`✓ Build timestamp recorded: ${timestamp}`);

  // Create build info file
  const buildInfo = {
    timestamp: timestamp,
    platform: process.platform,
    nodeVersion: process.version,
    dependenciesChecked: [
      'react-native-ble-plx',
      '@react-native-async-storage/async-storage',
      'expo'
    ]
  };

  fs.writeFileSync('./logs/build-info.json', JSON.stringify(buildInfo, null, 2));
  console.log('✓ Build information recorded');

  console.log('\nPrebuild process completed successfully!');
  console.log('AutoKey is ready for build!');
}

// Run the prebuild process
runPrebuild();