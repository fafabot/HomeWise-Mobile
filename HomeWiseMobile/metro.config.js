const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
if (process.env.EXPO_PUBLIC_HOMEWISE_REVIEW === '1') {
  const mock = path.join(__dirname, 'review/firebase-mock.ts');
  const real = path.join(__dirname, 'src/services/firebase.ts');
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith('firebase/')) return { type: 'sourceFile', filePath: mock };
    const resolved = context.resolveRequest(context, moduleName, platform);
    if (resolved.type === 'sourceFile' && path.normalize(resolved.filePath) === real) return { type: 'sourceFile', filePath: mock };
    return resolved;
  };
}
module.exports = config;
