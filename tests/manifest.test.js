import { createMocks } from 'node-mocks-http';
import Dicer from 'dicer';
import nullthrows from 'nullthrows';
import { Stream } from 'stream';
import { parseItem } from 'structured-headers';

import handleManifest from '../pages/api/manifest';

function isManifestMultipartPart(multipartPart, part) {
  const [, parameters] = parseItem(
    nullthrows(multipartPart.headers.get('content-disposition'))
  );
  const partName = parameters.get('name');
  return partName === part;
}

export async function getManifestPartAsync(response, part) {
  const multipartParts = await parseMultipartMixedResponseAsync(response);
  const manifestPart = multipartParts.find((it) =>
    isManifestMultipartPart(it, part)
  );
  return manifestPart;
}

async function parseMultipartMixedResponseAsync(res) {
  const contentType = res.getHeader('content-type');
  if (!contentType || typeof contentType != 'string') {
    throw new Error(
      'The multipart manifest response is missing the content-type header'
    );
  }

  const boundaryRegex = /^multipart\/.+?; boundary=(?:"([^"]+)"|([^\s;]+))/i;
  const matches = boundaryRegex.exec(contentType);
  if (!matches) {
    throw new Error(
      'The content-type header in the HTTP response is not a multipart media type'
    );
  }
  const boundary = matches[1] ?? matches[2];

  const bufferStream = new Stream.PassThrough();
  bufferStream.end(res._getBuffer());

  return await new Promise((resolve, reject) => {
    const parts = [];
    bufferStream.pipe(
      new Dicer({ boundary })
        .on('part', (p) => {
          const part = {
            body: '',
            headers: new Map(),
          };

          p.on('header', (headers) => {
            for (const h in headers) {
              part.headers.set(h, headers[h][0]);
            }
          });
          p.on('data', (data) => {
            part.body += data.toString();
          });
          p.on('end', () => {
            parts.push(part);
          });
        })
        .on('finish', () => {
          resolve(parts);
        })
        .on('error', (error) => {
          reject(error);
        })
    );
  });
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
      hash: '99b36e8b0afe02000087a91b220650e56106d1fa672bbc77f481aae9c21af3fb',
      key: 'dacaa233e4886477facc9d5ca16952ad',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/ios-dacaa233e4886477facc9d5ca16952ad.js&runtimeVersion=test&platform=ios`,
    },
  ],
  [
    'android',
    {
      hash: '3712b3a9c1e3bf7f383fe916a113d9937b5ec0ccfe5a5f4002b2ff8fb00fa681',
      key: 'f1539de9a8bd655e7346639e6a6c2d2a',
      fileExtension: '.bundle',
      contentType: 'application/javascript',
      url: `${process.env.HOSTNAME}/api/assets?asset=updates/test/bundles/android-f1539de9a8bd655e7346639e6a6c2d2a.js&runtimeVersion=test&platform=android`,
    },
  ],
])('returns latest %p manifest', async (platform, launchAssetExpectation) => {
  process.env.PRIVATE_KEY_PATH = 'updates/test/privatekey.pem';

  const firstAssetExpectation = {
    hash: 'cb65fafb5ed456fc3ed8a726cf4087d37b875184eba96f33f6d99104e6e2266d',
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
