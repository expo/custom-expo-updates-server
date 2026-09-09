import fs from 'node:fs/promises';
import path from 'node:path';

import { getOnDemandPatchCacheReportAsync } from './onDemandPatches';

type CatalogRecord = {
  kind: 'update' | 'rollback';
  state: 'active' | 'disabled';
  directory: string;
  id?: string;
  groupId?: string;
  createdAt: string;
  runtimeVersion: string;
  platform?: 'android' | 'ios';
  channel?: string;
};

type Catalog = {
  schemaVersion: number;
  records: CatalogRecord[];
};

type LaunchAssetPatch = {
  path: string;
  size: number;
};

type ServerMetadata = {
  launchAssetPatches?: Record<string, Record<string, LaunchAssetPatch>>;
};

type ExportMetadata = {
  fileMetadata?: Record<string, { bundle: string; assets: unknown[] }>;
};

type PlatformArtifact = {
  launchAsset: string;
  launchAssetBytes: number;
  assetCount: number;
  patches: {
    baseUpdateId: string;
    path: string;
    bytes: number;
    savingsBytes: number;
    savingsPercent: number;
  }[];
};

type Artifact = {
  operation: 'update' | 'rollBackToEmbedded';
  state: CatalogRecord['state'];
  runtimeVersion: string;
  channel: string | null;
  platform: string;
  updateId: string | null;
  groupId: string | null;
  createdAt: string;
  directory: string;
  available: boolean;
  codeSigning: {
    available: boolean;
    keyId: string;
  };
  platforms: Record<string, PlatformArtifact>;
};

export function artifactViewEnabled(): boolean {
  return process.env.EXPO_UPDATES_ARTIFACT_VIEW_ENABLED === 'true';
}

export async function getArtifactReportAsync() {
  const configuredUpdatesRoot = process.env.UPDATES_DIRECTORY?.trim();
  const updatesRoot = path.resolve(
    configuredUpdatesRoot?.length ? configuredUpdatesRoot : 'updates',
  );
  const catalog = JSON.parse(
    await fs.readFile(path.join(updatesRoot, 'catalog.json'), 'utf8'),
  ) as Catalog;
  const artifacts: Artifact[] = [];

  for (const record of catalog.records) {
    const directory = path.resolve(updatesRoot, record.directory);
    if (!directory.startsWith(`${updatesRoot}${path.sep}`)) {
      throw new Error('Artifact directory escapes the updates root.');
    }
    const serverMetadata = JSON.parse(
      await fs.readFile(path.join(directory, 'server.json'), 'utf8').catch(() => '{}'),
    ) as ServerMetadata;
    let metadata: ExportMetadata | undefined;
    try {
      metadata =
        record.kind === 'update'
          ? (JSON.parse(
              await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'),
            ) as ExportMetadata)
          : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || record.state !== 'disabled') {
        throw error;
      }
    }
    const platforms: Record<string, PlatformArtifact> = {};

    for (const [platform, platformMetadata] of Object.entries(metadata?.fileMetadata ?? {})) {
      const launchAssetBytes = (await fs.stat(path.join(directory, platformMetadata.bundle))).size;
      platforms[platform] = {
        launchAsset: platformMetadata.bundle,
        launchAssetBytes,
        assetCount: platformMetadata.assets.length,
        patches: Object.entries(serverMetadata.launchAssetPatches?.[platform] ?? {}).map(
          ([baseUpdateId, patch]) => ({
            baseUpdateId,
            path: patch.path,
            bytes: patch.size,
            savingsBytes: launchAssetBytes - patch.size,
            savingsPercent: Number((100 - (patch.size / launchAssetBytes) * 100).toFixed(2)),
          }),
        ),
      };
    }

    const configuredKeyId = process.env.CODE_SIGNING_KEY_ID?.trim();
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
      codeSigning: {
        available: Boolean(process.env.PRIVATE_KEY_PATH),
        keyId: configuredKeyId?.length ? configuredKeyId : 'main',
      },
      platforms,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    onDemandPatchCache: await getOnDemandPatchCacheReportAsync(),
    operations: [
      'resolve fingerprint runtime',
      'export real Expo bundle',
      'publish update to channel catalog',
      'precompute BSDIFF40 launch-asset deltas',
      'generate and cache missing eligible BSDIFF40 deltas on demand',
      'sign manifest or directive on request',
      'serve full immutable asset or validated 226 bsdiff variant',
      'publish rollBackToEmbedded directive',
    ],
    artifacts,
  };
}
