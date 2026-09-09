import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCatalogAsync } from './catalog.mjs';
import { option } from './runtime-version.mjs';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updatesDirectory = path.resolve(
  serverDirectory,
  process.env.UPDATES_DIRECTORY?.trim() || 'updates',
);
const outputPath = option('--output', undefined);
const catalog = await readCatalogAsync(path.join(updatesDirectory, 'catalog.json'));
const artifacts = [];

for (const record of catalog.records) {
  const directory = path.join(updatesDirectory, record.directory);
  const serverMetadata = JSON.parse(
    await readFile(path.join(directory, 'server.json'), 'utf8').catch(() => '{}'),
  );
  let metadata;
  try {
    metadata =
      record.kind === 'update'
        ? JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'))
        : undefined;
  } catch (error) {
    if (error.code !== 'ENOENT' || record.state !== 'disabled') {
      throw error;
    }
  }
  const platforms = {};

  for (const [platform, platformMetadata] of Object.entries(
    metadata?.fileMetadata ?? {},
  )) {
    const bundlePath = path.join(directory, platformMetadata.bundle);
    const launchAssetBytes = (await stat(bundlePath)).size;
    const patches = [];
    for (const [baseUpdateId, patch] of Object.entries(
      serverMetadata.launchAssetPatches?.[platform] ?? {},
    )) {
      patches.push({
        baseUpdateId,
        path: patch.path,
        bytes: patch.size,
        savingsBytes: launchAssetBytes - patch.size,
        savingsPercent: Number(
          (100 - (patch.size / launchAssetBytes) * 100).toFixed(2),
        ),
      });
    }
    platforms[platform] = {
      launchAsset: platformMetadata.bundle,
      launchAssetBytes,
      assetCount: platformMetadata.assets.length,
      patches,
    };
  }

  artifacts.push({
    operation: record.kind === 'rollback' ? 'rollBackToEmbedded' : 'update',
    state: record.state,
    runtimeVersion: record.runtimeVersion,
    channel: record.channel ?? null,
    platform: record.platform ?? 'all-exported-platforms',
    updateId: record.id ?? null,
    groupId: record.groupId ?? null,
    createdAt: record.createdAt,
    directory: record.directory,
    available: record.kind === 'rollback' || metadata !== undefined,
    platforms,
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  updatesDirectory,
  operations: [
    'resolve fingerprint runtime',
    'export real Expo bundle',
    'publish update to channel catalog',
    'precompute BSDIFF40 launch-asset deltas',
    'sign manifest or directive on request',
    'serve full immutable asset or validated 226 bsdiff variant',
    'publish rollBackToEmbedded directive',
  ],
  artifacts,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  await writeFile(path.resolve(outputPath), serialized, 'utf8');
}
process.stdout.write(serialized);
