import path from 'node:path';

function environmentJson(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : JSON.parse(value);
}

function environmentBoolean(name, fallback) {
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

export const config = {
  baseUrl: process.env.EXPO_UPDATES_CONFORMANCE_BASE_URL ?? 'http://127.0.0.1:3210',
  manifestPath:
    process.env.EXPO_UPDATES_CONFORMANCE_MANIFEST_PATH ?? '/api/manifest',
  commonHeaders: environmentJson('EXPO_UPDATES_CONFORMANCE_HEADERS_JSON', {}),
  certificatePath: process.env.EXPO_UPDATES_CONFORMANCE_CERTIFICATE_PATH
    ? path.resolve(process.env.EXPO_UPDATES_CONFORMANCE_CERTIFICATE_PATH)
    : undefined,
  expectSigning: environmentBoolean(
    'EXPO_UPDATES_CONFORMANCE_EXPECT_SIGNING',
    Boolean(process.env.EXPO_UPDATES_CONFORMANCE_CERTIFICATE_PATH),
  ),
  expectBsdiffPatch: environmentBoolean(
    'EXPO_UPDATES_CONFORMANCE_EXPECT_BSDIFF_PATCH',
    false,
  ),
  fixtures: {
    runtime: process.env.EXPO_UPDATES_CONFORMANCE_RUNTIME ?? 'test',
    updateId:
      process.env.EXPO_UPDATES_CONFORMANCE_UPDATE_ID ??
      '11111111-1111-4111-8111-111111111111',
    oldUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_OLD_UPDATE_ID ??
      '55555555-5555-4555-8555-555555555555',
    disabledUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_DISABLED_UPDATE_ID ??
      '77777777-7777-4777-8777-777777777777',
    previewChannel:
      process.env.EXPO_UPDATES_CONFORMANCE_PREVIEW_CHANNEL ?? 'preview',
    previewUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_PREVIEW_UPDATE_ID ??
      '66666666-6666-4666-8666-666666666666',
    rollbackRuntime:
      process.env.EXPO_UPDATES_CONFORMANCE_ROLLBACK_RUNTIME ?? 'testrollback',
    rollbackPreviewUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_ROLLBACK_PREVIEW_UPDATE_ID ??
      '99999999-9999-4999-8999-999999999999',
    embeddedUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_EMBEDDED_UPDATE_ID ?? 'embedded-id',
    fingerprintRuntime:
      process.env.EXPO_UPDATES_CONFORMANCE_FINGERPRINT_RUNTIME ??
      '0123456789abcdef0123456789abcdef01234567',
    fingerprintUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_FINGERPRINT_UPDATE_ID ??
      '33333333-3333-4333-8333-333333333333',
    cohortRuntime:
      process.env.EXPO_UPDATES_CONFORMANCE_COHORT_RUNTIME ?? 'testcohort',
    cohortUpdateId:
      process.env.EXPO_UPDATES_CONFORMANCE_COHORT_UPDATE_ID ??
      '44444444-4444-4444-8444-444444444444',
    cohortKey: process.env.EXPO_UPDATES_CONFORMANCE_COHORT_KEY ?? 'cohort',
    cohortValue: process.env.EXPO_UPDATES_CONFORMANCE_COHORT_VALUE ?? 'beta',
    channel: process.env.EXPO_UPDATES_CONFORMANCE_CHANNEL ?? 'main',
    unmatchedChannel:
      process.env.EXPO_UPDATES_CONFORMANCE_UNMATCHED_CHANNEL ?? 'missing-channel',
  },
};

export function manifestUrl(query = {}) {
  const result = new URL(config.manifestPath, config.baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      result.searchParams.append(key, String(value));
    }
  }
  return result;
}
