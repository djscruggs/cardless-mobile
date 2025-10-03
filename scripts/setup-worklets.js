#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */

/**
 * Setup script to create react-native-worklets redirect to react-native-reanimated
 * This is needed because some dependencies expect react-native-worklets/plugin to exist
 */

const fs = require('fs');
const path = require('path');

const workletsDirPath = path.join(__dirname, '../node_modules/react-native-worklets');
const pluginDirPath = path.join(workletsDirPath, 'plugin');

try {
  // Create directories if they don't exist
  if (!fs.existsSync(workletsDirPath)) {
    fs.mkdirSync(workletsDirPath, { recursive: true });
  }

  if (!fs.existsSync(pluginDirPath)) {
    fs.mkdirSync(pluginDirPath, { recursive: true });
  }

  // Create package.json
  const packageJson = {
    name: 'react-native-worklets',
    version: '1.0.0',
    main: '../react-native-reanimated/lib/index.js'
  };

  fs.writeFileSync(
    path.join(workletsDirPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create plugin redirect
  const pluginRedirect = `// Redirect to react-native-reanimated plugin
module.exports = require('react-native-reanimated/plugin');
`;

  fs.writeFileSync(
    path.join(pluginDirPath, 'index.js'),
    pluginRedirect
  );

  console.log('✅ react-native-worklets redirect created successfully');
} catch (error) {
  console.error('❌ Error creating react-native-worklets redirect:', error);
  // Don't fail the install process
  process.exit(0);
}
