import fs from 'node:fs';
import path from 'node:path';
import * as zlib from 'node:zlib';
import { createMocks } from 'node-mocks-http';

import handleAssets from '../pages/api/assets';

const UPDATE_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_PATH = 'assets/4f1cb2cac2370cd5050681232e8575a8';
const IOS_BUNDLE_PATH = 'bundles/ios-9d01842d6ee1224f7188971c5d397115.js';

function createAssetRequest({
  headers = {},
  method = 'GET',
  query = {},
}: {
  headers?: Record<string, string>;
  method?: 'GET' | 'HEAD' | 'POST';
  query?: Record<string, string | undefined>;
} = {}) {
  return createMocks({
    method,
    headers,
    query: {
      asset: IMAGE_PATH,
      platform: 'ios',
      runtimeVersion: 'test',
      updateId: UPDATE_ID,
      ...query,
    },
  });
}

test('returns an immutable asset from the requested update', async () => {
  const { req, res } = createAssetRequest();
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(res.getHeader('content-type')).toBe('image/png');
  expect(res.getHeader('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(res.getHeader('etag')).toMatch(/^"sha256-/);
  expect(res._getBuffer().length).toBeGreaterThan(0);
});

test('supports HEAD requests', async () => {
  const { req, res } = createAssetRequest({ method: 'HEAD' });
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(Number(res.getHeader('content-length'))).toBeGreaterThan(0);
  expect(res._getBuffer()).toHaveLength(0);
});

test('returns 304 for a matching ETag', async () => {
  const first = createAssetRequest();
  await handleAssets(first.req, first.res);
  const etag = String(first.res.getHeader('etag'));

  const second = createAssetRequest({ headers: { 'if-none-match': etag } });
  await handleAssets(second.req, second.res);
  expect(second.res._getStatusCode()).toBe(304);
  expect(second.res._getBuffer()).toHaveLength(0);
});

test.each([
  ['gzip', (value: Buffer) => zlib.gunzipSync(value)],
  ['br', (value: Buffer) => zlib.brotliDecompressSync(value)],
])('compresses launch assets with %s', async (encoding, decompress) => {
  const { req, res } = createAssetRequest({
    headers: { 'accept-encoding': encoding },
    query: { asset: IOS_BUNDLE_PATH },
  });
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(res.getHeader('content-encoding')).toBe(encoding);

  const original = fs.readFileSync(path.join('updates', 'test', '1', IOS_BUNDLE_PATH));
  expect(decompress(res._getBuffer())).toEqual(original);
});

test('supports zstd compression when the Node runtime provides it', async () => {
  const zstdDecompressSync = (
    zlib as typeof zlib & {
      zstdDecompressSync?: (buffer: Buffer) => Buffer;
    }
  ).zstdDecompressSync;
  if (!zstdDecompressSync) {
    return;
  }
  const { req, res } = createAssetRequest({
    headers: { 'accept-encoding': 'zstd, br, gzip' },
    query: { asset: IOS_BUNDLE_PATH },
  });
  await handleAssets(req, res);
  expect(res.getHeader('content-encoding')).toBe('zstd');

  const original = fs.readFileSync(path.join('updates', 'test', '1', IOS_BUNDLE_PATH));
  expect(zstdDecompressSync(res._getBuffer())).toEqual(original);
});

test('falls back to the full launch asset when bsdiff is requested', async () => {
  const { req, res } = createAssetRequest({
    headers: { 'a-im': 'bsdiff' },
    query: { asset: IOS_BUNDLE_PATH },
  });
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(res.getHeader('im')).toBeUndefined();
});

test.each([
  ['unknown update', { updateId: '22222222-2222-4222-8222-222222222222' }, 404],
  ['unknown asset', { asset: 'assets/not-in-the-manifest' }, 404],
  ['path traversal', { asset: '../package.json' }, 400],
  ['unsupported platform', { platform: 'web' }, 400],
  ['missing runtime', { runtimeVersion: undefined }, 400],
  ['missing update ID', { updateId: undefined }, 400],
  ['missing asset', { asset: undefined }, 400],
])('rejects %s', async (_label, query, status) => {
  const { req, res } = createAssetRequest({ query });
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(status);
});

test('rejects unsupported methods', async () => {
  const { req, res } = createAssetRequest({ method: 'POST' });
  await handleAssets(req, res);
  expect(res._getStatusCode()).toBe(405);
  expect(res.getHeader('allow')).toBe('GET, HEAD');
});
