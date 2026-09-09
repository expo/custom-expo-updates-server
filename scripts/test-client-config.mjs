import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDirectory = path.join(repositoryDirectory, 'expo-updates-client');

function run(command, args, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: clientDirectory,
      env: {
        ...process.env,
        ...environment,
      },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function expoConfig(environment = {}) {
  const output = await run(
    'npx',
    ['--no-install', 'expo', 'config', '--type', 'prebuild', '--json'],
    environment,
  );
  return JSON.parse(output);
}

async function resolvedRuntimeVersion(platform) {
  const output = await run(
    'npx',
    [
      '--no-install',
      'expo-updates',
      'runtimeversion:resolve',
      '--platform',
      platform,
    ],
    {
      EXPO_RUNTIME_VERSION_POLICY: 'fingerprint',
    },
  );
  return JSON.parse(output);
}

const defaults = await expoConfig();
assert.equal(defaults.runtimeVersion, '57');
assert.deepEqual(defaults.updates, {
  url: 'http://localhost:3000/api/manifest',
  enabled: true,
  checkAutomatically: 'ON_LOAD',
  fallbackToCacheTimeout: 0,
  useEmbeddedUpdate: true,
  enableBsdiffPatchSupport: true,
  useNativeDebug: false,
  codeSigningCertificate: './.local/code-signing/certificate.pem',
  codeSigningMetadata: {
    keyid: 'main',
    alg: 'rsa-v1_5-sha256',
  },
  requestHeaders: {
    'expo-channel-name': 'main',
    'x-local-override': 'false',
  },
  assetPatternsToBeBundled: ['**/*'],
  disableAntiBrickingMeasures: true,
});

const configured = await expoConfig({
  EXPO_RUNTIME_VERSION_POLICY: 'appVersion',
  EXPO_IOS_RUNTIME_VERSION: 'ios-manual-runtime',
  EXPO_UPDATES_ASSET_PATTERNS_TO_BE_BUNDLED: '["assets/**/*.png"]',
  EXPO_UPDATES_CHECK_AUTOMATICALLY: 'NEVER',
  EXPO_UPDATES_CODE_SIGNING: 'false',
  EXPO_UPDATES_DISABLE_ANTI_BRICKING_MEASURES: 'false',
  EXPO_UPDATES_ENABLE_BSDIFF_PATCH_SUPPORT: 'false',
  EXPO_UPDATES_ENABLED: 'false',
  EXPO_UPDATES_FALLBACK_TO_CACHE_TIMEOUT: '1234',
  EXPO_UPDATES_REQUEST_HEADERS: '{"x-test-header":"configured"}',
  EXPO_UPDATES_USE_EMBEDDED_UPDATE: 'false',
  EXPO_UPDATES_USE_NATIVE_DEBUG: 'true',
});
assert.deepEqual(configured.runtimeVersion, { policy: 'appVersion' });
assert.equal(configured.ios.runtimeVersion, 'ios-manual-runtime');
assert.equal(configured.updates.enabled, false);
assert.equal(configured.updates.checkAutomatically, 'NEVER');
assert.equal(configured.updates.fallbackToCacheTimeout, 1234);
assert.equal(configured.updates.useEmbeddedUpdate, false);
assert.equal(configured.updates.enableBsdiffPatchSupport, false);
assert.equal(configured.updates.useNativeDebug, true);
assert.equal(configured.updates.disableAntiBrickingMeasures, false);
assert.deepEqual(configured.updates.assetPatternsToBeBundled, ['assets/**/*.png']);
assert.equal(configured.updates.requestHeaders['x-test-header'], 'configured');
assert.equal(configured.updates.codeSigningCertificate, undefined);

for (const platform of ['android', 'ios']) {
  const result = await resolvedRuntimeVersion(platform);
  assert.match(result.runtimeVersion, /^[a-f0-9]{40}$/);
  assert.ok(Array.isArray(result.fingerprintSources));
  assert.equal(result.workflow, 'managed');
  console.log(`${platform} fingerprint: ${result.runtimeVersion}`);
}

console.log('Expo Updates client configuration and fingerprint resolution passed.');
