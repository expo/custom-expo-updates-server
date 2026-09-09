import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  getLatestUpdateAsync,
  getUpdatesForRuntimeAsync,
  UpdateStorageError,
  type Platform,
} from '../common/storage';

let updatesDirectory: string;

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function writeUpdate({
  runtimeVersion,
  directoryName,
  id,
  createdAt,
  channel,
  platforms = ['android', 'ios'],
  rollback = false,
}: {
  runtimeVersion: string;
  directoryName: string;
  id?: string;
  createdAt: string;
  channel: string;
  platforms?: Platform[];
  rollback?: boolean;
}) {
  const directory = path.join(updatesDirectory, runtimeVersion, directoryName);
  await fs.mkdir(directory, { recursive: true });
  await writeJson(path.join(directory, 'server.json'), {
    id,
    createdAt,
    runtimeVersion,
    channel,
  });
  if (rollback) {
    await fs.writeFile(path.join(directory, 'rollback'), '', 'utf8');
    return;
  }

  const fileMetadata = Object.fromEntries(
    platforms.map((platform) => [
      platform,
      {
        bundle: `bundles/${platform}.js`,
        assets: [],
      },
    ]),
  );
  await writeJson(path.join(directory, 'metadata.json'), {
    version: 0,
    bundler: 'metro',
    fileMetadata,
  });
  await writeJson(path.join(directory, 'expoConfig.json'), {
    name: 'storage-test',
    slug: 'storage-test',
    runtimeVersion,
  });
  for (const platform of platforms) {
    const bundlePath = path.join(directory, 'bundles', `${platform}.js`);
    await fs.mkdir(path.dirname(bundlePath), { recursive: true });
    await fs.writeFile(bundlePath, `globalThis.platform = '${platform}';\n`, 'utf8');
  }
}

async function writeCatalog(records: unknown[]) {
  await writeJson(path.join(updatesDirectory, 'catalog.json'), {
    schemaVersion: 1,
    records,
  });
}

beforeEach(async () => {
  updatesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-updates-storage-'));
  process.env.UPDATES_DIRECTORY = updatesDirectory;
});

afterEach(async () => {
  delete process.env.UPDATES_DIRECTORY;
  await fs.rm(updatesDirectory, { recursive: true, force: true });
});

test('selects the latest active build for a runtime and channel', async () => {
  await writeUpdate({
    runtimeVersion: 'fingerprint',
    directoryName: 'old',
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2025-01-01T00:00:00.000Z',
    channel: 'main',
  });
  await writeUpdate({
    runtimeVersion: 'fingerprint',
    directoryName: 'new',
    id: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-01-01T00:00:00.000Z',
    channel: 'main',
  });
  await writeCatalog([
    {
      kind: 'update',
      state: 'active',
      directory: 'fingerprint/old',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2025-01-01T00:00:00.000Z',
      runtimeVersion: 'fingerprint',
      channel: 'main',
    },
    {
      kind: 'update',
      state: 'active',
      directory: 'fingerprint/new',
      id: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'fingerprint',
      channel: 'main',
    },
    {
      kind: 'update',
      state: 'disabled',
      directory: 'fingerprint/not-present',
      id: '33333333-3333-4333-8333-333333333333',
      createdAt: '2030-01-01T00:00:00.000Z',
      runtimeVersion: 'fingerprint',
      channel: 'main',
    },
  ]);

  const selected = await getLatestUpdateAsync({
    runtimeVersion: 'fingerprint',
    platform: 'ios',
    channel: 'main',
  });
  expect(selected.id).toBe('22222222-2222-4222-8222-222222222222');
});

test('keeps channels and platform-specific builds isolated', async () => {
  await writeUpdate({
    runtimeVersion: 'runtime',
    directoryName: 'ios-main',
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    channel: 'main',
    platforms: ['ios'],
  });
  await writeUpdate({
    runtimeVersion: 'runtime',
    directoryName: 'android-preview',
    id: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-01-02T00:00:00.000Z',
    channel: 'preview',
    platforms: ['android'],
  });
  await writeCatalog([
    {
      kind: 'update',
      state: 'active',
      directory: 'runtime/ios-main',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'runtime',
      platform: 'ios',
      channel: 'main',
    },
    {
      kind: 'update',
      state: 'active',
      directory: 'runtime/android-preview',
      id: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-01-02T00:00:00.000Z',
      runtimeVersion: 'runtime',
      platform: 'android',
      channel: 'preview',
    },
  ]);

  const ios = await getLatestUpdateAsync({
    runtimeVersion: 'runtime',
    platform: 'ios',
    channel: 'main',
  });
  const android = await getLatestUpdateAsync({
    runtimeVersion: 'runtime',
    platform: 'android',
    channel: 'preview',
  });
  expect(ios.id).toBe('11111111-1111-4111-8111-111111111111');
  expect(android.id).toBe('22222222-2222-4222-8222-222222222222');
  await expect(
    getLatestUpdateAsync({
      runtimeVersion: 'runtime',
      platform: 'ios',
      channel: 'preview',
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
});

test('selects a newer rollback record through the same state model', async () => {
  await writeUpdate({
    runtimeVersion: 'runtime',
    directoryName: 'update',
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    channel: 'main',
  });
  await writeUpdate({
    runtimeVersion: 'runtime',
    directoryName: 'rollback',
    createdAt: '2026-01-02T00:00:00.000Z',
    channel: 'main',
    rollback: true,
  });
  await writeCatalog([
    {
      kind: 'update',
      state: 'active',
      directory: 'runtime/update',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'runtime',
      channel: 'main',
    },
    {
      kind: 'rollback',
      state: 'active',
      directory: 'runtime/rollback',
      createdAt: '2026-01-02T00:00:00.000Z',
      runtimeVersion: 'runtime',
      channel: 'main',
    },
  ]);

  const selected = await getLatestUpdateAsync({
    runtimeVersion: 'runtime',
    platform: 'android',
    channel: 'main',
  });
  expect(selected.type).toBe('rollback');
});

test.each([
  [
    'path traversal',
    {
      kind: 'update',
      state: 'active',
      directory: '../outside',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'runtime',
    },
  ],
  [
    'invalid date',
    {
      kind: 'update',
      state: 'active',
      directory: 'runtime/update',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: 'not-a-date',
      runtimeVersion: 'runtime',
    },
  ],
])('rejects catalog records with %s', async (_name, record) => {
  await writeCatalog([record]);
  await expect(getUpdatesForRuntimeAsync('runtime')).rejects.toBeInstanceOf(
    UpdateStorageError,
  );
  await expect(getUpdatesForRuntimeAsync('runtime')).rejects.toMatchObject({
    statusCode: 500,
  });
});

test('rejects duplicate active update IDs', async () => {
  const record = {
    kind: 'update',
    state: 'active',
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    runtimeVersion: 'runtime',
  };
  await writeCatalog([
    { ...record, directory: 'runtime/one' },
    { ...record, directory: 'runtime/two' },
  ]);

  await expect(getUpdatesForRuntimeAsync('runtime')).rejects.toMatchObject({
    statusCode: 500,
  });
});

test('does not fall back to unlisted directories for a catalog-owned runtime', async () => {
  await writeUpdate({
    runtimeVersion: 'runtime',
    directoryName: 'unlisted',
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    channel: 'main',
  });
  await writeCatalog([
    {
      kind: 'update',
      state: 'disabled',
      directory: 'runtime/unlisted',
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'runtime',
      channel: 'main',
    },
  ]);

  await expect(getUpdatesForRuntimeAsync('runtime')).rejects.toMatchObject({
    statusCode: 404,
  });
});
