const updatesUrl =
  process.env.EXPO_UPDATES_URL || 'http://localhost:3000/api/manifest';
const channel = process.env.EXPO_UPDATES_CHANNEL || 'main';

function booleanEnvironmentValue(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`${name} must be "true" or "false".`);
}

function integerEnvironmentValue(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  const result = Number.parseInt(value, 10);
  if (!Number.isInteger(result)) {
    throw new Error(`${name} must be an integer.`);
  }
  return result;
}

function jsonEnvironmentValue(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return JSON.parse(value);
}

function runtimeVersionValue(platform) {
  const platformValue = process.env[`EXPO_${platform.toUpperCase()}_RUNTIME_VERSION`];
  const platformPolicy = process.env[`EXPO_${platform.toUpperCase()}_RUNTIME_VERSION_POLICY`];
  if (platformValue && platformPolicy) {
    throw new Error(`Set only one ${platform} runtime version or policy.`);
  }
  if (platformValue) {
    return platformValue;
  }
  if (platformPolicy) {
    return { policy: platformPolicy };
  }
  return undefined;
}

const configuredRuntimeVersion = process.env.EXPO_RUNTIME_VERSION;
const configuredRuntimePolicy = process.env.EXPO_RUNTIME_VERSION_POLICY;
if (configuredRuntimeVersion && configuredRuntimePolicy) {
  throw new Error('Set only one EXPO_RUNTIME_VERSION or EXPO_RUNTIME_VERSION_POLICY.');
}
const runtimeVersion = configuredRuntimeVersion
  ? configuredRuntimeVersion
  : configuredRuntimePolicy
    ? { policy: configuredRuntimePolicy }
    : '57';
const iosRuntimeVersion = runtimeVersionValue('ios');
const androidRuntimeVersion = runtimeVersionValue('android');
const checkAutomatically = process.env.EXPO_UPDATES_CHECK_AUTOMATICALLY || 'ON_LOAD';
const supportedCheckPolicies = ['ON_LOAD', 'ON_ERROR_RECOVERY', 'WIFI_ONLY', 'NEVER'];
if (!supportedCheckPolicies.includes(checkAutomatically)) {
  throw new Error(
    `EXPO_UPDATES_CHECK_AUTOMATICALLY must be one of ${supportedCheckPolicies.join(', ')}.`,
  );
}
const codeSigningEnabled = booleanEnvironmentValue('EXPO_UPDATES_CODE_SIGNING', true);
const requestHeaders = {
  'expo-channel-name': channel,
  'x-local-override': 'false',
  ...jsonEnvironmentValue('EXPO_UPDATES_REQUEST_HEADERS', {}),
};

module.exports = {
  expo: {
    name: 'Expo Updates SDK 57 Client',
    slug: 'expo-updates-sdk-57-client',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    runtimeVersion,
    updates: {
      url: updatesUrl,
      enabled: booleanEnvironmentValue('EXPO_UPDATES_ENABLED', true),
      checkAutomatically,
      fallbackToCacheTimeout: integerEnvironmentValue(
        'EXPO_UPDATES_FALLBACK_TO_CACHE_TIMEOUT',
        0,
      ),
      useEmbeddedUpdate: booleanEnvironmentValue('EXPO_UPDATES_USE_EMBEDDED_UPDATE', true),
      enableBsdiffPatchSupport: booleanEnvironmentValue(
        'EXPO_UPDATES_ENABLE_BSDIFF_PATCH_SUPPORT',
        true,
      ),
      useNativeDebug: booleanEnvironmentValue('EXPO_UPDATES_USE_NATIVE_DEBUG', false),
      ...(codeSigningEnabled
        ? {
            codeSigningCertificate:
              process.env.EXPO_UPDATES_CODE_SIGNING_CERTIFICATE ||
              './.local/code-signing/certificate.pem',
            codeSigningMetadata: {
              keyid: process.env.EXPO_UPDATES_CODE_SIGNING_KEY_ID || 'main',
              alg: 'rsa-v1_5-sha256',
            },
          }
        : {}),
      requestHeaders,
      assetPatternsToBeBundled: jsonEnvironmentValue(
        'EXPO_UPDATES_ASSET_PATTERNS_TO_BE_BUNDLED',
        ['**/*'],
      ),
      disableAntiBrickingMeasures: booleanEnvironmentValue(
        'EXPO_UPDATES_DISABLE_ANTI_BRICKING_MEASURES',
        true,
      ),
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'dev.expo.customupdatesserver',
      ...(iosRuntimeVersion ? { runtimeVersion: iosRuntimeVersion } : {}),
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      ...(androidRuntimeVersion ? { runtimeVersion: androidRuntimeVersion } : {}),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      package: 'dev.expo.customupdatesserver',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
          },
        },
      ],
    ],
    extra: {
      localUpdatesServerUrl: updatesUrl,
      localUpdatesChannel: channel,
    },
  },
};
