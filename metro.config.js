/* eslint-env node */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve react-native-worklets to react-native-reanimated (bundled worklets)
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Redirect worklets plugin to reanimated's plugin
    if (moduleName === 'react-native-worklets/plugin') {
      return {
        filePath: path.resolve(
          __dirname,
          'node_modules/react-native-reanimated/plugin/index.js'
        ),
        type: 'sourceFile',
      };
    }
    // Redirect worklets package to reanimated (which has worklets bundled)
    if (moduleName === 'react-native-worklets' || moduleName.startsWith('react-native-worklets/')) {
      const subpath = moduleName.replace('react-native-worklets', '');
      return context.resolveRequest(
        context,
        `react-native-reanimated${subpath}`,
        platform
      );
    }
    // Default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
