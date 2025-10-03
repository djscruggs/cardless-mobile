/* eslint-env node */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve react-native-worklets/plugin to react-native-reanimated/plugin
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'react-native-worklets/plugin') {
      return {
        filePath: path.resolve(
          __dirname,
          'node_modules/react-native-reanimated/plugin/index.js'
        ),
        type: 'sourceFile',
      };
    }
    // Default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
