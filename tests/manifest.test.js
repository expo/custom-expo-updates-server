import { createMocks } from 'node-mocks-http';
import handleManifest, { getManifestRowFromDB } from '../pages/api/manifest';

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

test.each([['ios'], ['android']])(
  'returns latest %p manifest',
  async (platform) => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        'expo-runtime-version': '1',
        'expo-platform': platform,
        'expo-channel-name': 'main',
      },
    });

    const row = await getManifestRowFromDB({
      runtimeVersion: '1',
      platform,
    });
    const manifestFragment = JSON.parse(row.manifest_fragment);

    await handleManifest(req, res);
    const data = JSON.parse(res._getData());
    const firstAsset = data.assets[0];

    expect(res._getStatusCode()).toBe(200);
    expect(data.createdAt).toBe(row.created_at);
    expect(data.runtimeVersion).toBe(row.rtv);

    expect(data.launchAsset.hash).toBe(manifestFragment.launchAsset.hash);
    expect(data.launchAsset.key).toBe(manifestFragment.launchAsset.key);
    expect(data.launchAsset.contentType).toBe(
      manifestFragment.launchAsset.contentType
    );
    expect(data.launchAsset.url).toBe(manifestFragment.launchAsset.url);

    expect(firstAsset.hash).toBe(manifestFragment.assets[0].hash);
    expect(firstAsset.key).toBe(manifestFragment.assets[0].key);
    expect(firstAsset.contentType).toBe(manifestFragment.assets[0].contentType);
    expect(firstAsset.url).toBe(manifestFragment.assets[0].url);

    expect(data.updateMetadata.updateGroup).toBe(
      '750ba667-477f-4d4d-8a7a-75cbcaff89ce'
    );
    expect(data.updateMetadata.branchName).toBe('main');
  }
);
