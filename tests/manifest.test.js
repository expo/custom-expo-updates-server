import { createMocks } from 'node-mocks-http';
import handleManifest from '../pages/api/manifest';

test('returns 400 with POST request', async () => {
  const { req, res } = createMocks({ method: 'POST' });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 with unsupported platform header', async () => {
  const { req, res } = createMocks({
    method: 'POST',
    headers: {
      'expo-platform': 'unsupported-platform',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 with unknown runtime version', async () => {
  const { req, res } = createMocks({
    method: 'POST',
    headers: {
      'expo-platform': 'ios',
      'expo-runtime-version': '999',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns 400 without a channel name', async () => {
  const { req, res } = createMocks({
    method: 'POST',
    headers: {
      'expo-platform': 'ios',
      'expo-runtime-version': '1',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(400);
});

test('returns manifest [WIP]', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': '1',
      'expo-platform': 'ios',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);
  const data = JSON.parse(res._getData());

  expect(res._getStatusCode()).toBe(200);
  expect(data.id).toBe('id-1');
  expect(data.createdAt).toBe('2021-04-12T17:01:13.837Z');
  expect(data.runtimeVersion).toBe('1');

  expect(data.launchAsset.hash).toBe(
    'b6817c321e398e78bb21c1670637877885b1b0ef315970ce45d9ba59234dfec1'
  );
  expect(data.launchAsset.contentType).toBe('application/javascript');
  expect(data.launchAsset.url).toBe(
    'http://localhost:3000/api/assets/rtv-1/main/id-1/bundles/ios-723d3c7cc7d2bc1488d6a18e0b8cbc64.js'
  );

  expect(data.assets[0].hash).toBe(
    '116518f93a217ae12ccb7bd633169bc34cf5e641633c68de16edbe37d5faa6c7'
  );
  expect(data.assets[0].contentType).toBe('image/png');
  expect(data.assets[0].url).toBe(
    'http://localhost:3000/api/assets/rtv-1/main/id-1/assets/7d40544b395c5949f4646f5e150fe020'
  );

  expect(data.updateMetadata.updateGroup).toBe('id-1');
  expect(data.updateMetadata.createAt).toBe('2021-04-12T17:01:13.837Z');
  expect(data.updateMetadata.branchName).toBe('main');
});
