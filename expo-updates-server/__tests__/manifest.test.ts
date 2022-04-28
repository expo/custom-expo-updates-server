import { parseMultipartMixedResponseAsync, MultipartPart } from '@expo/multipart-body-parser';
import { createMocks } from 'node-mocks-http';
import nullthrows from 'nullthrows';
import { parseItem } from 'structured-headers';

import handleManifest from '../pages/api/manifest';

function isManifestMultipartPart(multipartPart: MultipartPart, part: string) {
  const [, parameters] = parseItem(nullthrows(multipartPart.headers.get('content-disposition')));
  const partName = parameters.get('name');
  return partName === part;
}

export async function getManifestPartAsync(res: any, part: string) {
  const multipartParts = await parseMultipartMixedResponseAsync(
    res.getHeader('content-type'),
    res._getBuffer()
  );
  const manifestPart = multipartParts.find((it) => isManifestMultipartPart(it, part));
  return manifestPart;
}

const env = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...env };
});

afterEach(() => {
  process.env = env;
});

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
      hash: 'mbNuiwr-AgAAh6kbIgZQ5WEG0fpnK7x39IGq6cIa8_s',
      key: 'dacaa233e4886477facc9d5ca16952ad',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/ios-dacaa233e4886477facc9d5ca16952ad.js&runtimeVersion=test&platform=ios`,
    },
  ],
  [
    'android',
    {
      hash: 'NxKzqcHjv384P-kWoRPZk3tewMz-Wl9AArL_j7APpoE',
      key: 'f1539de9a8bd655e7346639e6a6c2d2a',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/android-f1539de9a8bd655e7346639e6a6c2d2a.js&runtimeVersion=test&platform=android`,
    },
  ],
])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
  process.env.PRIVATE_KEY_PATH = 'updates/test/privatekey.pem';

  const firstAssetExpectation = {
    hash: 'y2X6-17UVvw-2Kcmz0CH03uHUYTrqW8z9tmRBObiJm0',
    key: '489ea2f19fa850b65653ab445637a181',
    fileExtension: '.jpg',
    contentType: 'image/jpeg',
    url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/assets/489ea2f19fa850b65653ab445637a181&runtimeVersion=test&platform=${platform}`,
  };
  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': 'test',
      'expo-platform': platform,
      'expo-channel-name': 'main',
      'expo-expect-signature': 'true',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(200);

  const { body, headers } = await getManifestPartAsync(res, 'manifest');
  const data = JSON.parse(body);

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

  expect(headers.get('expo-signature')).toBeTruthy();
});
