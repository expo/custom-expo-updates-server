import { createMocks } from 'node-mocks-http';
import handleManifest from '../pages/api/manifest';

test('returns 400 with POST request', async () => {
  const { req, res } = createMocks({ method: 'POST' });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 with unsupported platform header', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-platform': 'unsupported-platform',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 404 with unknown runtime version', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-platform': 'ios',
      'expo-runtime-version': '999',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(404);
});

test('returns 400 without a channel name', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-platform': 'ios',
      'expo-runtime-version': '1',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns latest ios manifest', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': '41',
      'expo-platform': 'ios',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);
  const data = JSON.parse(res._getData());
  const firstAsset = data.assets[0];

  expect(res._getStatusCode()).toBe(200);
  expect(data.id).toBe('068f815c-2450-4035-86c8-ccfdfe4a5990');
  expect(data.createdAt).toBe('2021-04-14T20:49:45.760Z');
  expect(data.runtimeVersion).toBe('41');

  expect(data.launchAsset.hash).toBe(
    'b6817c321e398e78bb21c1670637877885b1b0ef315970ce45d9ba59234dfec1'
  );
  expect(data.launchAsset.key).toBe('723d3c7cc7d2bc1488d6a18e0b8cbc64.bundle');
  expect(data.launchAsset.contentType).toBe('application/javascript');
  expect(data.launchAsset.url).toBe(
    'http://localhost:3000/api/assets/16a7f94fab7489ec93749b28f8b4b9e34bd7d5e6190401e321509fcfa25a9d62.js'
  );

  expect(firstAsset.hash).toBe(
    '2cdfeb8e5ccde7976f7012fb8cce73af2229029ee21d4f1509fed114871c6cd8'
  );
  expect(firstAsset.key).toBe('7d40544b395c5949f4646f5e150fe020.png');
  expect(firstAsset.contentType).toBe('image/png');
  expect(firstAsset.url).toBe(
    'http://localhost:3000/api/assets/9d636fea23253b6e95f7e01a97a86a7ed2dbaddf32f23b88253e74259690cfb3.png'
  );

  expect(data.updateMetadata.updateGroup).toBe(
    '112377e0-ee1d-4986-8635-5bf8faf865c7'
  );
  expect(data.updateMetadata.branchName).toBe('main');
});

test('returns latest android manifest', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': '41',
      'expo-platform': 'android',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);
  const data = JSON.parse(res._getData());
  const firstAsset = data.assets[0];

  expect(res._getStatusCode()).toBe(200);
  expect(data.id).toBe('7844a433-79bc-40d2-b575-0aa155f9c6e9');
  expect(data.createdAt).toBe('2021-04-14T20:49:45.760Z');
  expect(data.runtimeVersion).toBe('41');

  expect(data.launchAsset.hash).toBe(
    'e39d0defbd2c26eb697baba2611d8a1da0f41c3ad5c280c7fa5360c07b6beb8a'
  );

  expect(firstAsset.hash).toBe(
    '8b61a4c7ef70dc92753f0494976482f66fd4150ec23dfc772ab65e10373afa55'
  );

  expect(data.updateMetadata.updateGroup).toBe(
    '112377e0-ee1d-4986-8635-5bf8faf865c7'
  );
  expect(data.updateMetadata.branchName).toBe('main');
});
