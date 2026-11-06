'use strict';

const PROJECT = 'demo-homewise';
const HOST = '127.0.0.1';
const PORT = 18080;
const HUB = 14400;

function assertConfiguration(env) {
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
    if (env[key] && env[key] !== PROJECT) throw new Error(`Non-demo ${key} rejected`);
  }
  if (env.FIRESTORE_EMULATOR_HOST !== `${HOST}:${PORT}`) throw new Error('Local Firestore emulator required at 127.0.0.1:18080');
  if (env.FIREBASE_EMULATOR_HUB !== `${HOST}:${HUB}`) throw new Error('Local emulator hub required at 127.0.0.1:14400');
  if (env.FIREBASE_CONFIG) {
    let config;
    try { config = JSON.parse(env.FIREBASE_CONFIG); } catch { throw new Error('Non-JSON FIREBASE_CONFIG rejected'); }
    if (config.projectId !== PROJECT) throw new Error('Non-demo FIREBASE_CONFIG rejected');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN || env.CLOUDSDK_AUTH_ACCESS_TOKEN) {
    throw new Error('Production-capable credential environment rejected');
  }
  return { projectId: PROJECT, host: HOST, port: PORT };
}

async function localJson(url, fetchImpl) {
  // Hard allowlist, no DNS, no redirects and a bounded timeout.
  if (!url.startsWith(`http://${HOST}:${HUB}/`) && !url.startsWith(`http://${HOST}:${PORT}/`)) throw new Error('Non-local URL rejected');
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`Local emulator probe failed: HTTP ${response.status}`);
  return response.json();
}

async function requireEmulator(env = process.env, fetchImpl = fetch) {
  const config = assertConfiguration(env);
  const hub = await localJson(`http://${HOST}:${HUB}/emulators`, fetchImpl);
  if (hub.firestore?.host !== HOST || hub.firestore?.port !== PORT) throw new Error('Unexpected emulator in hub');
  await localJson(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default):ruleCoverage`, fetchImpl);
  return config;
}

if (require.main === module) {
  requireEmulator().then(() => console.log('Local demo-homewise emulator verified'))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { PROJECT, HOST, PORT, HUB, assertConfiguration, requireEmulator };
