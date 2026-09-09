import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isMultipartPartWithName,
  parseMultipartMixedResponseAsync,
} from '@expo/multipart-body-parser';
import { createMocks } from 'node-mocks-http';
import nullthrows from 'nullthrows';

import handleManifest from '../pages/api/manifest';

const UPDATE_ID = '11111111-1111-4111-8111-111111111111';
let signingDirectory: string;
let privateKeyPath: string;

function createManifestRequest({
  headers = {},
  method = 'GET',
}: {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
} = {}) {
  return createMocks({
    method,
    headers: {
      accept: 'multipart/mixed',
      'expo-channel-name': 'main',
      'expo-platform': 'ios',
      'expo-protocol-version': '1',
      'expo-runtime-version': 'test',
      ...headers,
    },
  });
}

async function getMultipartPart(res: ReturnType<typeof createMocks>['res'], name: string) {
  const parts = await parseMultipartMixedResponseAsync(
    String(res.getHeader('content-type')),
    res._getBuffer(),
  );
  return nullthrows(parts.find((part) => isMultipartPartWithName(part, name)));
}

beforeAll(() => {
  signingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-updates-test-key-'));
  privateKeyPath = path.join(signingDirectory, 'private-key.pem');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  });
  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
});

afterEach(() => {
  delete process.env.PRIVATE_KEY_PATH;
});

afterAll(() => {
  fs.rmSync(signingDirectory, { recursive: true, force: true });
});

test('rejects methods other than GET', async () => {
  const { req, res } = createManifestRequest({ method: 'POST' });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(405);
  expect(res.getHeader('allow')).toBe('GET');
});

test.each([
  ['unsupported protocol', { 'expo-protocol-version': '2' }],
  ['unsupported platform', { 'expo-platform': 'windows' }],
  ['missing runtime', { 'expo-runtime-version': '' }],
])('rejects %s', async (_label, headers) => {
  const { req, res } = createManifestRequest({ headers });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(400);
});

test('returns 404 for an unknown runtime', async () => {
  const { req, res } = createManifestRequest({
    headers: { 'expo-runtime-version': 'unknown' },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(404);
});

test('returns 404 when the configured channel does not match', async () => {
  const { req, res } = createManifestRequest({
    headers: { 'expo-channel-name': 'missing-channel' },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(404);
});

test.each(['application/expo+json', 'application/json'])(
  'returns a protocol 1 manifest as %s',
  async (accept) => {
    const { req, res } = createManifestRequest({ headers: { accept } });
    await handleManifest(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('content-type')).toBe(`${accept}; charset=utf-8`);
    expect(res.getHeader('expo-protocol-version')).toBe(1);
    expect(String(res.getHeader('expo-manifest-filters'))).toContain('channel');
    expect(String(res.getHeader('expo-server-defined-headers'))).toContain(
      'expo-channel-name',
    );

    const manifest = JSON.parse(res._getData());
    expect(manifest).toMatchObject({
      id: UPDATE_ID,
      runtimeVersion: 'test',
      metadata: { channel: 'main' },
    });
    expect(manifest.launchAsset.url).toContain(`updateId=${UPDATE_ID}`);
    expect(manifest.launchAsset.url).toContain('runtimeVersion=test');
  },
);

test('honors Accept quality values', async () => {
  const { req, res } = createManifestRequest({
    headers: {
      accept: 'multipart/mixed;q=0.1, application/json;q=0.9',
    },
  });
  await handleManifest(req, res);
  expect(res.getHeader('content-type')).toBe('application/json; charset=utf-8');
});

test('returns 406 when no requested representation is supported', async () => {
  const { req, res } = createManifestRequest({
    headers: { accept: 'text/plain' },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(406);
});

test('returns a signed multipart manifest and asset request headers', async () => {
  process.env.PRIVATE_KEY_PATH = privateKeyPath;
  const { req, res } = createManifestRequest({
    headers: {
      'expo-expect-signature': 'sig, keyid="main", alg="rsa-v1_5-sha256"',
    },
  });
  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(200);
  const manifestPart = await getMultipartPart(res, 'manifest');
  const manifest = JSON.parse(manifestPart.body);
  expect(manifest.id).toBe(UPDATE_ID);
  expect(manifestPart.headers.get('expo-signature')).toContain('sig=');

  const extensionsPart = await getMultipartPart(res, 'extensions');
  const extensions = JSON.parse(extensionsPart.body);
  expect(extensions.assetRequestHeaders[manifest.launchAsset.key]).toEqual({
    'x-expo-update-id': UPDATE_ID,
  });
});

test('rejects a signing request when no private key is configured', async () => {
  const { req, res } = createManifestRequest({
    headers: { 'expo-expect-signature': 'sig' },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(400);
});

test('returns noUpdateAvailable when the client already has the latest update', async () => {
  const { req, res } = createManifestRequest({
    headers: { 'expo-current-update-id': UPDATE_ID },
  });
  await handleManifest(req, res);
  const directivePart = await getMultipartPart(res, 'directive');
  expect(JSON.parse(directivePart.body)).toEqual({ type: 'noUpdateAvailable' });
});

test('requires multipart support for directives', async () => {
  const { req, res } = createManifestRequest({
    headers: {
      accept: 'application/json',
      'expo-current-update-id': UPDATE_ID,
    },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(406);
});

test('preserves protocol 0 JSON compatibility', async () => {
  process.env.PRIVATE_KEY_PATH = privateKeyPath;
  const { req, res } = createManifestRequest({
    headers: {
      'expo-expect-signature': 'sig',
      'expo-protocol-version': '0',
    },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(res.getHeader('expo-protocol-version')).toBe(0);
  expect(String(res.getHeader('expo-signature'))).toContain('sig=');
  expect(JSON.parse(res._getData()).id).toBe(UPDATE_ID);
});

test('returns a rollback directive', async () => {
  const { req, res } = createManifestRequest({
    headers: {
      'expo-embedded-update-id': 'embedded-id',
      'expo-runtime-version': 'testrollback',
    },
  });
  await handleManifest(req, res);
  const directivePart = await getMultipartPart(res, 'directive');
  expect(JSON.parse(directivePart.body)).toEqual({
    type: 'rollBackToEmbedded',
    parameters: { commitTime: '2022-10-20T21:00:00.000Z' },
  });
});

test('returns noUpdateAvailable when already running the embedded update', async () => {
  const { req, res } = createManifestRequest({
    headers: {
      'expo-current-update-id': 'embedded-id',
      'expo-embedded-update-id': 'embedded-id',
      'expo-runtime-version': 'testrollback',
    },
  });
  await handleManifest(req, res);
  const directivePart = await getMultipartPart(res, 'directive');
  expect(JSON.parse(directivePart.body)).toEqual({ type: 'noUpdateAvailable' });
});

test('requires the embedded update ID for rollback responses', async () => {
  const { req, res } = createManifestRequest({
    headers: { 'expo-runtime-version': 'testrollback' },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(400);
});

test('does not serve rollback directives to protocol 0 clients', async () => {
  const { req, res } = createManifestRequest({
    headers: {
      'expo-embedded-update-id': 'embedded-id',
      'expo-protocol-version': '0',
      'expo-runtime-version': 'testrollback',
    },
  });
  await handleManifest(req, res);
  expect(res._getStatusCode()).toBe(406);
});
