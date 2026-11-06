const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.cacheVersion = 'homewise-approved-minimal-local';
if (process.env.HOMEWISE_LOCAL_VALIDATION === '1') {
  const mock = path.join(__dirname, 'validation/firebase-mock.ts');
  const real = path.join(__dirname, 'src/services/firebase.ts');
  config.resolver.resolveRequest = (context, name, platform) => {
    if (name.startsWith('firebase/')) return { type: 'sourceFile', filePath: mock };
    const result = context.resolveRequest(context, name, platform);
    if (result.type === 'sourceFile' && path.normalize(result.filePath) === real) return { type: 'sourceFile', filePath: mock };
    return result;
  };
}
module.exports = config;
