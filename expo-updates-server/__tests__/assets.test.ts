import { createMocks } from 'node-mocks-http';
import handleAssets from '../pages/api/assets';

test('returns asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      runtimeVersion: 'test',
      asset: 'updates/test/assets/489ea2f19fa850b65653ab445637a181',
      platform: 'ios',
    },
  });

  handleAssets(req, res);

  expect(res._getStatusCode()).toBe(200);
  expect(res._getHeaders()['content-type']).toBe('image/jpeg');
});

test('returns launch asset file', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    query: {
      runtimeVersion: 'test',
      asset: 'updates/test/bundles/ios-dacaa233e4886477facc9d5ca16952ad.js',
      platform: 'ios',
    },
  });

  handleAssets(req, res);

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

  handleAssets(req, res);

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

  handleAssets(req, res);

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

  handleAssets(req, res);

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

  handleAssets(req, res);

  expect(res._getStatusCode()).toBe(400);
});
