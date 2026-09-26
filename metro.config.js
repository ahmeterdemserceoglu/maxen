const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

const firebaseAuthRn = path.resolve(
  __dirname,
  'node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js',
);

const pnpmDir = path.resolve(__dirname, 'node_modules/.pnpm');
if (fs.existsSync(pnpmDir)) {
  config.watchFolders = [...(config.watchFolders || []), pnpmDir];
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && moduleName === 'firebase/auth') {
    const targetFile = fs.existsSync(firebaseAuthRn) ? fs.realpathSync(firebaseAuthRn) : firebaseAuthRn;
    return {
      filePath: targetFile,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
