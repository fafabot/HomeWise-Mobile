const PROJECT = 'demo-homewise';
const HOST = '127.0.0.1', PORT = 19080, HUB = 15400;
function configuration(env) {
  if (env.FIRESTORE_EMULATOR_HOST !== `${HOST}:${PORT}` || env.FIREBASE_EMULATOR_HUB !== `${HOST}:${HUB}`) throw new Error('Exact local emulator endpoints required');
  for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) if (env[key] && env[key] !== PROJECT) throw new Error('Only demo-homewise allowed');
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_TOKEN || env.CLOUDSDK_AUTH_ACCESS_TOKEN) throw new Error('Credential-bearing environment rejected');
  if (env.FIREBASE_CONFIG && JSON.parse(env.FIREBASE_CONFIG).projectId !== PROJECT) throw new Error('Non-demo Firebase config');
  return { projectId: PROJECT, host: HOST, port: PORT };
}
async function requireLocal(env = process.env, fetcher = fetch) {
  const result = configuration(env);
  const read = async url => {
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error('Local emulator unavailable');
    return response.json();
  };
  const hub = await read(`http://${HOST}:${HUB}/emulators`);
  if (hub.firestore?.host !== HOST || hub.firestore?.port !== PORT) throw new Error('Unexpected emulator');
  await read(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default):ruleCoverage`);
  return result;
}
module.exports = { PROJECT, HOST, PORT, HUB, configuration, requireLocal };
