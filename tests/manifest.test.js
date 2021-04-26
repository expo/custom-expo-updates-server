import { createMocks } from 'node-mocks-http';
import handleManifest from '../pages/api/manifest';

test('returns 400 with POST request', async () => {
  const { req, res } = createMocks({ method: 'POST' });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(405);
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

test.each([
  [
    'ios',
    {
      hash: '9a0a74279e9b0ce315196d849d79ce0a280e304b2cdf6c5b9add19795d3d599d',
      key: 'dacfca1e0dd47920779600d8daa69a29.bundle',
      contentType: 'application/javascript',
      url:
        'http://localhost:3000/api/assets?asset=updates/1/bundles/ios-dacfca1e0dd47920779600d8daa69a29.js&contentType=application/javascript',
    },
  ],
  [
    'android',
    {
      hash: '954659bf14e157d88f48f0cc2ba2a6806ad3bb836f1bb26f8f06d0feca2800b9',
      key: '2ec667aaa6df2ac7b35916e9e555bd48.bundle',
      contentType: 'application/javascript',
      url:
        'http://localhost:3000/api/assets?asset=updates/1/bundles/android-2ec667aaa6df2ac7b35916e9e555bd48.js&contentType=application/javascript',
    },
  ],
])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
  const firstAssetExpectation = {
    hash: 'cb65fafb5ed456fc3ed8a726cf4087d37b875184eba96f33f6d99104e6e2266d',
    key: '489ea2f19fa850b65653ab445637a181.jpg',
    contentType: 'image/jpeg',
    url:
      'http://localhost:3000/api/assets?asset=updates/1/assets/489ea2f19fa850b65653ab445637a181&contentType=image/jpeg',
  };
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': '1',
      'expo-platform': platform,
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  const data = JSON.parse(res._getData());
  expect(res._getStatusCode()).toBe(200);

  expect(data.id).toBe('cf7a73b7-5986-2d26-bc4d-45b3fbb4bf2c');
  expect(data.createdAt).toBe('2021-04-26T19:32:32.187Z');
  expect(data.runtimeVersion).toBe('1');
  expect(data.updateMetadata.branchName).toBe('main');

  const launchAsset = data.launchAsset;
  expect(launchAsset.hash).toBe(launchAssetExpectation.hash);
  expect(launchAsset.key).toBe(launchAssetExpectation.key);
  expect(launchAsset.contentType).toBe(launchAssetExpectation.contentType);
  expect(launchAsset.url).toBe(launchAssetExpectation.url);

  const firstAsset = data.assets[0];
  expect(firstAsset.hash).toBe(firstAssetExpectation.hash);
  expect(firstAsset.key).toBe(firstAssetExpectation.key);
  expect(firstAsset.contentType).toBe(firstAssetExpectation.contentType);
  expect(firstAsset.url).toBe(firstAssetExpectation.url);
});
