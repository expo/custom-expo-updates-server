import { createMocks } from 'node-mocks-http';

import handleAssets from '../pages/api/assets';

test('returns asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      runtimeVersion: 'test',
      asset: 'updates/test/1/assets/4f1cb2cac2370cd5050681232e8575a8',
      platform: 'ios',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('image/png');
});

test('returns launch asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      runtimeVersion: 'test',
      asset: 'updates/test/1/bundles/ios-9d01842d6ee1224f7188971c5d397115.js',
      platform: 'ios',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('application/javascript');
});

test('returns 404 when asset does not exist', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: 'updates/1/assets/does-not-exist.png',
      runtimeVersion: 'test',
      platform: 'ios',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(404);
});

test('returns 400 with no asset name', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: undefined,
      runtimeVersion: 'test',
      platform: 'ios',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 with no runtime version', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: 'updates/1/assets/does-not-exist.png',
      runtimeVersion: undefined,
      platform: 'ios',
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 with no platform', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      asset: 'updates/1/assets/does-not-exist.png',
      runtimeVersion: 'test',
      platform: undefined,
    },
  });

  await handleAssets(req, res);

  expect(res._getStatusCode()).toBe(400);
});
