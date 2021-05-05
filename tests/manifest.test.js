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

test.each([
  [
    'ios',
    {
      hash: '99b36e8b0afe02000087a91b220650e56106d1fa672bbc77f481aae9c21af3fb',
      key: 'dacaa233e4886477facc9d5ca16952ad.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/ios-dacaa233e4886477facc9d5ca16952ad.js&runtimeVersion=test&platform=ios`,
    },
  ],
  [
    'android',
    {
      hash: '3712b3a9c1e3bf7f383fe916a113d9937b5ec0ccfe5a5f4002b2ff8fb00fa681',
      key: 'f1539de9a8bd655e7346639e6a6c2d2a.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/android-f1539de9a8bd655e7346639e6a6c2d2a.js&runtimeVersion=test&platform=android`,
    },
  ],
])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
  const firstAssetExpectation = {
    hash: 'cb65fafb5ed456fc3ed8a726cf4087d37b875184eba96f33f6d99104e6e2266d',
    key: '489ea2f19fa850b65653ab445637a181.jpg',
    contentType: 'image/jpeg',
    url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/assets/489ea2f19fa850b65653ab445637a181&runtimeVersion=test&platform=${platform}`,
  };
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': 'test',
      'expo-platform': platform,
      'expo-channel-name': 'main',
    },
  });

  await handleManifest(req, res);

  const data = JSON.parse(res._getData());
  expect(res._getStatusCode()).toBe(200);

  expect(data.id).toBe('5668cf5b-c7cc-1fc3-da9c-4b6548e9eb9c');
  expect(data.runtimeVersion).toBe('test');

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
