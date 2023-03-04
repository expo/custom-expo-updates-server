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

test('returns 405 with POST request', async () => {
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

describe.each([['0'], ['1']])('protocol version %p', (protocolVersion) => {
  test.each([
    [
      'ios',
      {
        hash: '4nGjshgRoD62YxnJAnZBWllEzCBrQR2zQ_2ei8glL6s',
        key: '9d01842d6ee1224f7188971c5d397115',
        fileExtension: '.bundle',
        contentType: 'application/javascript',
        url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/1/bundles/ios-9d01842d6ee1224f7188971c5d397115.js&runtimeVersion=test&platform=ios`,
      },
    ],
    [
      'android',
      {
        hash: 't3kWQ00Lhn5qCGGhNNMxiD_pcTO_4d7I_1zO3S5Me5k',
        key: '82adadb1fb6e489d04ad95fd79670deb',
        fileExtension: '.bundle',
        contentType: 'application/javascript',
        url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/1/bundles/android-82adadb1fb6e489d04ad95fd79670deb.js&runtimeVersion=test&platform=android`,
      },
    ],
  ])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
    process.env.PRIVATE_KEY_PATH = 'updates/test/1/privatekey.pem';

    const firstAssetExpectation = {
      hash: 'JCcs2u_4LMX6zazNmCpvBbYMRQRwS7-UwZpjiGWYgLs',
      key: '4f1cb2cac2370cd5050681232e8575a8',
      fileExtension: '.jpg',
      contentType: 'image/png',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/1/assets/4f1cb2cac2370cd5050681232e8575a8&runtimeVersion=test&platform=${platform}`,
    };
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        'expo-protocol-version': protocolVersion,
        'expo-runtime-version': 'test',
        'expo-platform': platform,
        'expo-channel-name': 'main',
        'expo-expect-signature': 'true',
      },
    });

    await handleManifest(req, res);

    expect(res._getStatusCode()).toBe(200);

    const { body, headers } = nullthrows(await getManifestPartAsync(res, 'manifest'));
    const data = JSON.parse(body);

    expect(data.id).toBe('b15ed6d8-f39b-04ad-a248-fa3b95fd7e0e');
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
});

test.each([['ios'], ['android']])('returns rollback %p', async (platform) => {
  process.env.PRIVATE_KEY_PATH = 'updates/test/1/privatekey.pem';

  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-protocol-version': '1',
      'expo-runtime-version': 'testrollback',
      'expo-platform': platform,
      'expo-channel-name': 'main',
      'expo-expect-signature': 'true',
      'expo-embedded-update-id': '123',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(200);

  const { body, headers } = nullthrows(await getManifestPartAsync(res, 'directive'));
  const data = JSON.parse(body);
  expect(data).toMatchObject({
    type: 'rollBackToEmbedded',
    parameters: { commitTime: expect.any(String) },
  });

  expect(headers.get('expo-signature')).toBeTruthy();
});

test.each([['ios'], ['android']])('throws for rollback %p for protocol 0', async (platform) => {
  process.env.PRIVATE_KEY_PATH = 'updates/test/1/privatekey.pem';

  const { req, res } = createMocks({
    method: 'GET',
    headers: {
      'expo-runtime-version': 'testrollback',
      'expo-platform': platform,
      'expo-channel-name': 'main',
      'expo-expect-signature': 'true',
      'expo-embedded-update-id': '123',
    },
  });

  await handleManifest(req, res);

  expect(res._getStatusCode()).toBe(404);
});
