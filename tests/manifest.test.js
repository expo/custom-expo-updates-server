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
      'expo-runtime-version': '1',
      'expo-platform': 'ios',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);
  const data = JSON.parse(res._getData());
  const firstAsset = data.assets[0];

  expect(res._getStatusCode()).toBe(200);
  expect(data.id).toBe('663cdf84-799b-4a76-8b3c-d0691c1514c1');
  expect(data.createdAt).toBe('2021-04-15T16:02:56.074Z');
  expect(data.runtimeVersion).toBe('1');

  expect(data.launchAsset.hash).toBe(
    '7150d995d5330ce3851a945f995f075735f94062e6c5abbc387da93ddf81c9ed'
  );
  expect(data.launchAsset.key).toBe('1c377a3d8385daeee2c6fe355793fff1.bundle');
  expect(data.launchAsset.contentType).toBe('application/javascript');
  expect(data.launchAsset.url).toBe(
    'http://localhost:3000/api/assets/aa45e592585056b252968e7fefb72e7706dde1a2837e2cb0fcdb58a1895140f5.js'
  );

  expect(firstAsset.hash).toBe(
    '38b0ab4977499b171bb4e9384a9004cccf4bd9cdf950870c8070ac0a5a2611e1'
  );
  expect(firstAsset.key).toBe('4842a0f5ef20e73aa86e03bdc980c6ad.jpg');
  expect(firstAsset.contentType).toBe('image/jpeg');
  expect(firstAsset.url).toBe(
    'http://localhost:3000/api/assets/31fea2560634258e9d002be1000bfa42384a5e752e8c42e9471e429daddb04bd.jpeg'
  );

  expect(data.updateMetadata.updateGroup).toBe(
    '16a16b9a-308e-4970-8fbf-3f44c2145e76'
  );
  expect(data.updateMetadata.branchName).toBe('main');
});

test('returns latest android manifest', async () => {
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': '1',
      'expo-platform': 'android',
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);
  const data = JSON.parse(res._getData());
  const firstAsset = data.assets[0];

  expect(res._getStatusCode()).toBe(200);
  expect(data.id).toBe('ecbdfc41-b9a3-4c20-9515-24605846774b');
  expect(data.createdAt).toBe('2021-04-15T16:02:56.074Z');
  expect(data.runtimeVersion).toBe('1');

  expect(data.launchAsset.hash).toBe(
    '910af2ca55bfd531a9730a5d7eed14a0a3690f8512933e44db5e3e5b8d5dcc0d'
  );

  expect(firstAsset.hash).toBe(
    '38b0ab4977499b171bb4e9384a9004cccf4bd9cdf950870c8070ac0a5a2611e1'
  );

  expect(data.updateMetadata.updateGroup).toBe(
    '16a16b9a-308e-4970-8fbf-3f44c2145e76'
  );
  expect(data.updateMetadata.branchName).toBe('main');
});
