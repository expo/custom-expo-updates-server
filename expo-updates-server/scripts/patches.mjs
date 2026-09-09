import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import bsdiff from 'bsdiff-node';

import { getPatchBaseRecordsAsync } from './catalog.mjs';

export async function sha256File(filePath) {
  return crypto.createHash('sha256').update(await readFile(filePath)).digest('base64url');
}

export async function generateLaunchAssetPatchesAsync({
  updatesDirectory,
  runtimeVersion,
  platform,
  channel,
  targetDirectory,
  exportMetadata,
  patchBaseCount,
  maxPatchRatio,
  excludeUpdateId,
  beforeCreatedAt,
}) {
  if (patchBaseCount === 0) {
    return {};
  }
  const targetBundle = exportMetadata.fileMetadata?.[platform]?.bundle;
  if (!targetBundle) {
    return {};
  }
  const targetPath = path.join(targetDirectory, targetBundle);
  const targetSize = (await stat(targetPath)).size;
  const targetAssetHash = await sha256File(targetPath);
  const baseRecords = await getPatchBaseRecordsAsync({
    updatesDirectory,
    runtimeVersion,
    platform,
    channel,
    limit: patchBaseCount,
    excludeUpdateId,
    beforeCreatedAt,
  });
  const patches = {};

  for (const baseRecord of baseRecords) {
    const baseDirectory = path.join(updatesDirectory, baseRecord.directory);
    const baseMetadata = JSON.parse(
      await readFile(path.join(baseDirectory, 'metadata.json'), 'utf8'),
    );
    const baseBundle = baseMetadata.fileMetadata?.[platform]?.bundle;
    if (!baseBundle) {
      continue;
    }
    const basePath = path.join(baseDirectory, baseBundle);
    if (!existsSync(basePath)) {
      continue;
    }
    const patchDirectory = path.join(targetDirectory, 'patches');
    await mkdir(patchDirectory, { recursive: true });
    const patchRelativePath = `patches/${platform}-from-${baseRecord.id.toLowerCase()}.bsdiff`;
    const patchPath = path.join(targetDirectory, patchRelativePath);
    bsdiff.diffSync(basePath, targetPath, patchPath);
    const patchSize = (await stat(patchPath)).size;
    if (patchSize >= Math.floor(targetSize * maxPatchRatio)) {
      await rm(patchPath, { force: true });
      continue;
    }
    patches[baseRecord.id.toLowerCase()] = {
      path: patchRelativePath,
      size: patchSize,
      patchHash: await sha256File(patchPath),
      baseAssetHash: await sha256File(basePath),
      targetAssetHash,
    };
  }

  return Object.keys(patches).length > 0 ? { [platform]: patches } : {};
}
