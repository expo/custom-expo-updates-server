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
      hash: 'aRlpVHrYvXJ4OZOOtUOojMlFLus6ZkyVK2a38PzyN9E',
      key: 'c9bfd652a7fbd202192b12116522277d',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/ios-c9bfd652a7fbd202192b12116522277d.js&runtimeVersion=test&platform=ios`,
    },
  ],
  [
    'android',
    {
      hash: '-JXlfof61fxpCaGE-DzW7TIS9KqdhLgncfokxnqS3MI',
      key: 'b8ee8494e0cf548b34bfafc25ae5c144',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/android-b8ee8494e0cf548b34bfafc25ae5c144.js&runtimeVersion=test&platform=android`,
    },
  ],
])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
  process.env.PRIVATE_KEY_PATH = 'code-signing-keys/test-private-key.pem';

  const firstAssetExpectation = {
    hash: 'JCcs2u_4LMX6zazNmCpvBbYMRQRwS7-UwZpjiGWYgLs',
    key: '4f1cb2cac2370cd5050681232e8575a8',
    fileExtension: '.png',
    contentType: 'image/png',
    url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/assets/4f1cb2cac2370cd5050681232e8575a8&runtimeVersion=test&platform=${platform}`,
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

  expect(data.id).toBe('59c721f4-b9e9-650b-d21b-481b26fb7351');
  expect(data.runtimeVersion).toBe('test');
  expect(data.metadata).toEqual({});
  expect(data.extra).toMatchSnapshot();

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
