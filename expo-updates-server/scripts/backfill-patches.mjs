import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCatalogAsync } from './catalog.mjs';
import { generateLaunchAssetPatchesAsync } from './patches.mjs';
import { option, selectedPlatforms } from './runtime-version.mjs';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updatesDirectory = path.resolve(
  serverDirectory,
  process.env.UPDATES_DIRECTORY?.trim() || 'updates',
);
const runtimeFilter = option('--runtime-version', undefined);
const channelFilter = option('--channel', undefined);
const platformFilter = selectedPlatforms(option('--platform', 'all'));
const patchBaseCount = Number.parseInt(option('--patch-base-count', '3'), 10);
const maxPatchRatio = Number.parseFloat(
  option('--max-patch-ratio', process.env.BSDIFF_MAX_PATCH_RATIO?.trim() || '0.9'),
);

if (!Number.isInteger(patchBaseCount) || patchBaseCount < 0) {
  throw new Error('--patch-base-count must be a non-negative integer.');
}
if (!(maxPatchRatio > 0 && maxPatchRatio <= 1)) {
  throw new Error('--max-patch-ratio must be greater than 0 and at most 1.');
}

const catalog = await readCatalogAsync(path.join(updatesDirectory, 'catalog.json'));
const targets = catalog.records
  .filter(
    (record) =>
      record.kind === 'update' &&
      record.state === 'active' &&
      (!runtimeFilter || record.runtimeVersion === runtimeFilter) &&
      (!channelFilter || record.channel === channelFilter),
  )
  .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

for (const target of targets) {
  const targetDirectory = path.join(updatesDirectory, target.directory);
  const metadata = JSON.parse(
    await readFile(path.join(targetDirectory, 'metadata.json'), 'utf8'),
  );
  const serverPath = path.join(targetDirectory, 'server.json');
  const serverMetadata = JSON.parse(await readFile(serverPath, 'utf8'));
  const supportedPlatforms = platformFilter.filter(
    (platform) =>
      (!target.platform || target.platform === platform) &&
      metadata.fileMetadata?.[platform]?.bundle,
  );
  const launchAssetPatches = {};
  await rm(path.join(targetDirectory, 'patches'), { recursive: true, force: true });

  for (const platform of supportedPlatforms) {
    Object.assign(
      launchAssetPatches,
      await generateLaunchAssetPatchesAsync({
        updatesDirectory,
        runtimeVersion: target.runtimeVersion,
        platform,
        channel: target.channel,
        targetDirectory,
        exportMetadata: metadata,
        patchBaseCount,
        maxPatchRatio,
        excludeUpdateId: target.id,
        beforeCreatedAt: target.createdAt,
      }),
    );
  }

  serverMetadata.launchAssetPatches = launchAssetPatches;
  await writeFile(serverPath, `${JSON.stringify(serverMetadata, null, 2)}\n`, 'utf8');
  const count = Object.values(launchAssetPatches).reduce(
    (total, platformPatches) => total + Object.keys(platformPatches).length,
    0,
  );
  console.log(`${target.id}: generated ${count} launch-asset patch(es)`);
}
