const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const firebaseAuthRn = path.resolve(
  __dirname,
  'node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && moduleName === 'firebase/auth') {
    return {
      filePath: firebaseAuthRn,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
