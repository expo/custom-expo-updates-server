import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export type Platform = 'android' | 'ios';

export type ExportedAsset = {
  path: string;
  ext: string;
};

export type ExportMetadata = {
  version: number;
  bundler: string;
  fileMetadata: Record<
    Platform,
    {
      bundle: string;
      assets: ExportedAsset[];
    }
  >;
};

export type UpdateServerMetadata = {
  id?: string;
  groupId?: string;
  createdAt?: string;
  runtimeVersion?: string;
  platform?: Platform;
  channel?: string;
  metadata?: Record<string, string>;
  manifestFilters?: Record<string, string>;
  serverDefinedHeaders?: Record<string, string>;
  assetRequestHeaders?: Record<string, string>;
  extraParams?: Record<string, string>;
  extra?: Record<string, unknown>;
};

export type StoredUpdate = {
  directory: string;
  directoryName: string;
  runtimeVersion: string;
  id: string;
  createdAt: string;
  type: 'normal' | 'rollback';
  exportMetadata?: ExportMetadata;
  expoConfig?: Record<string, unknown>;
  serverMetadata: UpdateServerMetadata;
};

export type StoredAsset = {
  relativePath: string;
  absolutePath: string;
  extension: string | null;
  isLaunchAsset: boolean;
};

type BuildCatalogRecord = {
  kind: 'update' | 'rollback';
  state: 'active' | 'disabled';
  directory: string;
  id?: string;
  groupId?: string;
  createdAt: string;
  runtimeVersion: string;
  platform?: Platform;
  channel?: string;
};

type BuildCatalog = {
  schemaVersion: 1;
  records: BuildCatalogRecord[];
};

export class UpdateStorageError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 404,
  ) {
    super(message);
  }
}

function getUpdatesRoot(): string {
  const configuredUpdatesDirectory = process.env.UPDATES_DIRECTORY;
  return path.resolve(configuredUpdatesDirectory?.trim() ? configuredUpdatesDirectory : 'updates');
}

function ensureSafeSegment(value: string, label: string): string {
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new UpdateStorageError(`Invalid ${label}.`, 400);
  }
  return value;
}

function resolveWithin(root: string, ...segments: string[]): string {
  const result = path.resolve(root, ...segments);
  const relative = path.relative(root, result);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UpdateStorageError('Resolved path escapes the updates directory.', 400);
  }
  return result;
}

function hashToUuid(value: string): string {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20,
  )}-${value.slice(20, 32)}`;
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function validateCatalog(catalog: BuildCatalog): void {
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.records)) {
    throw new UpdateStorageError('Invalid updates catalog schema.', 500);
  }

  const activeIds = new Set<string>();
  for (const record of catalog.records) {
    if (record.kind !== 'update' && record.kind !== 'rollback') {
      throw new UpdateStorageError('Invalid updates catalog record kind.', 500);
    }
    if (record.state !== 'active' && record.state !== 'disabled') {
      throw new UpdateStorageError('Invalid updates catalog record state.', 500);
    }
    ensureSafeSegment(record.runtimeVersion, 'catalog runtime');
    if (
      !record.directory ||
      path.posix.isAbsolute(record.directory) ||
      record.directory.includes('\\') ||
      record.directory.includes('\0') ||
      path.posix.normalize(record.directory) !== record.directory ||
      record.directory.split('/').includes('..')
    ) {
      throw new UpdateStorageError('Invalid updates catalog directory.', 500);
    }
    const [catalogRuntime, directoryName, ...remainingSegments] = record.directory.split('/');
    if (
      catalogRuntime !== record.runtimeVersion ||
      !directoryName ||
      remainingSegments.length > 0
    ) {
      throw new UpdateStorageError('Catalog directories must use <runtimeVersion>/<record>.', 500);
    }
    ensureSafeSegment(directoryName, 'catalog update directory');
    if (!Number.isFinite(Date.parse(record.createdAt))) {
      throw new UpdateStorageError('Invalid updates catalog creation date.', 500);
    }
    if (
      record.platform !== undefined &&
      record.platform !== 'android' &&
      record.platform !== 'ios'
    ) {
      throw new UpdateStorageError('Invalid updates catalog platform.', 500);
    }
    if (record.kind === 'update' && !record.id) {
      throw new UpdateStorageError('Catalog update records require an ID.', 500);
    }
    if (record.state === 'active' && record.id) {
      const id = record.id.toLowerCase();
      if (activeIds.has(id)) {
        throw new UpdateStorageError(`Duplicate active update ID: ${record.id}.`, 500);
      }
      activeIds.add(id);
    }
  }
}

async function readBuildCatalogAsync(updatesRoot: string): Promise<BuildCatalog | undefined> {
  let catalog: BuildCatalog | undefined;
  try {
    catalog = await readJsonIfPresent<BuildCatalog>(path.join(updatesRoot, 'catalog.json'));
  } catch {
    throw new UpdateStorageError('Could not parse updates/catalog.json.', 500);
  }
  if (catalog) {
    validateCatalog(catalog);
  }
  return catalog;
}

async function loadStoredUpdateAsync(
  updatesRoot: string,
  runtimeVersion: string,
  directoryName: string,
): Promise<StoredUpdate> {
  const runtimeDirectory = resolveWithin(updatesRoot, ensureSafeSegment(runtimeVersion, 'runtime'));
  const directory = resolveWithin(
    runtimeDirectory,
    ensureSafeSegment(directoryName, 'update directory'),
  );
  const serverMetadata =
    (await readJsonIfPresent<UpdateServerMetadata>(path.join(directory, 'server.json'))) ?? {};
  const rollbackPath = path.join(directory, 'rollback');
  const type = fsSync.existsSync(rollbackPath) ? 'rollback' : 'normal';

  let exportMetadata: ExportMetadata | undefined;
  let expoConfig: Record<string, unknown> | undefined;
  let fallbackIdSource = `${runtimeVersion}:${directoryName}:rollback`;
  let timestampPath = rollbackPath;

  if (type === 'normal') {
    const metadataPath = path.join(directory, 'metadata.json');
    const metadataBuffer = await fs.readFile(metadataPath);
    exportMetadata = JSON.parse(metadataBuffer.toString('utf8')) as ExportMetadata;
    expoConfig = await readJsonIfPresent<Record<string, unknown>>(
      path.join(directory, 'expoConfig.json'),
    );
    if (!expoConfig) {
      throw new UpdateStorageError(`Update ${directoryName} is missing expoConfig.json.`, 500);
    }
    fallbackIdSource = crypto.createHash('sha256').update(metadataBuffer).digest('hex');
    timestampPath = metadataPath;
  }

  const stat = await fs.stat(timestampPath);
  const createdAt = serverMetadata.createdAt ?? stat.mtime.toISOString();
  const id =
    serverMetadata.id ??
    hashToUuid(
      /^[a-f0-9]{64}$/i.test(fallbackIdSource)
        ? fallbackIdSource
        : crypto.createHash('sha256').update(fallbackIdSource).digest('hex'),
    );

  return {
    directory,
    directoryName,
    runtimeVersion,
    id: id.toLowerCase(),
    createdAt,
    type,
    exportMetadata,
    expoConfig,
    serverMetadata,
  };
}

export async function getUpdatesForRuntimeAsync(runtimeVersion: string): Promise<StoredUpdate[]> {
  const updatesRoot = getUpdatesRoot();
  const safeRuntimeVersion = ensureSafeSegment(runtimeVersion, 'runtime');
  const catalog = await readBuildCatalogAsync(updatesRoot);
  const catalogRecords = catalog?.records.filter(
    (record) => record.runtimeVersion === safeRuntimeVersion,
  );

  if (catalogRecords && catalogRecords.length > 0) {
    const activeRecords = catalogRecords.filter((record) => record.state === 'active');
    const updates = await Promise.all(
      activeRecords.map(async (record) => {
        const directoryName = record.directory.split('/')[1];
        const storedUpdate = await loadStoredUpdateAsync(
          updatesRoot,
          safeRuntimeVersion,
          directoryName,
        );
        if (
          (record.kind === 'rollback' && storedUpdate.type !== 'rollback') ||
          (record.kind === 'update' && storedUpdate.type !== 'normal')
        ) {
          throw new UpdateStorageError(`Catalog kind does not match ${record.directory}.`, 500);
        }
        const id = record.id?.toLowerCase() ?? storedUpdate.id;
        const serverMetadata = {
          ...storedUpdate.serverMetadata,
          id,
          groupId: record.groupId ?? storedUpdate.serverMetadata.groupId,
          createdAt: record.createdAt,
          runtimeVersion: record.runtimeVersion,
          platform: record.platform,
          channel: record.channel,
        };
        return {
          ...storedUpdate,
          id,
          createdAt: record.createdAt,
          serverMetadata,
        };
      }),
    );

    if (updates.length === 0) {
      throw new UpdateStorageError(
        `No active updates found for runtime version: ${runtimeVersion}.`,
      );
    }
    return updates.sort((left, right) => {
      const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return byDate || right.directoryName.localeCompare(left.directoryName);
    });
  }

  const runtimeDirectory = resolveWithin(updatesRoot, ensureSafeSegment(runtimeVersion, 'runtime'));
  let entries: fsSync.Dirent[];
  try {
    entries = await fs.readdir(runtimeDirectory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UpdateStorageError(`Unsupported runtime version: ${runtimeVersion}.`);
    }
    throw error;
  }

  const updates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.endsWith('.tmp'))
      .map((entry) => loadStoredUpdateAsync(updatesRoot, runtimeVersion, entry.name)),
  );

  if (updates.length === 0) {
    throw new UpdateStorageError(`No updates found for runtime version: ${runtimeVersion}.`);
  }

  return updates.sort((left, right) => {
    const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return byDate || right.directoryName.localeCompare(left.directoryName);
  });
}

export async function getLatestUpdateAsync({
  runtimeVersion,
  platform,
  channel,
  extraParams,
}: {
  runtimeVersion: string;
  platform: Platform;
  channel?: string;
  extraParams?: Record<string, string>;
}): Promise<StoredUpdate> {
  const updates = await getUpdatesForRuntimeAsync(runtimeVersion);
  const update = updates.find((candidate) => {
    const configuredPlatform = candidate.serverMetadata.platform;
    if (configuredPlatform && configuredPlatform !== platform) {
      return false;
    }
    if (candidate.type === 'normal' && !candidate.exportMetadata?.fileMetadata[platform]) {
      return false;
    }
    const configuredChannel = candidate.serverMetadata.channel;
    if (configuredChannel && configuredChannel !== channel) {
      return false;
    }
    return Object.entries(candidate.serverMetadata.extraParams ?? {}).every(
      ([key, value]) => extraParams?.[key] === value,
    );
  });

  if (!update) {
    throw new UpdateStorageError(
      `No update matches runtime ${runtimeVersion}${channel ? ` and channel ${channel}` : ''}.`,
    );
  }
  return update;
}

export async function getUpdateByIdAsync(
  runtimeVersion: string,
  updateId: string,
): Promise<StoredUpdate> {
  const normalizedId = updateId.toLowerCase();
  const update = (await getUpdatesForRuntimeAsync(runtimeVersion)).find(
    (candidate) => candidate.id === normalizedId,
  );
  if (!update) {
    throw new UpdateStorageError(`Unknown update ID: ${updateId}.`);
  }
  if (update.type !== 'normal') {
    throw new UpdateStorageError(`Update ${updateId} has no assets.`);
  }
  return update;
}

function validateRelativeAssetPath(assetPath: string): string {
  if (
    !assetPath ||
    path.posix.isAbsolute(assetPath) ||
    assetPath.includes('\\') ||
    assetPath.includes('\0') ||
    path.posix.normalize(assetPath) !== assetPath ||
    assetPath.split('/').includes('..')
  ) {
    throw new UpdateStorageError('Invalid asset path.', 400);
  }
  return assetPath;
}

export function getStoredAsset(
  update: StoredUpdate,
  platform: Platform,
  requestedPath: string,
): StoredAsset {
  if (!update.exportMetadata) {
    throw new UpdateStorageError(`Update ${update.id} has no export metadata.`, 500);
  }
  const relativePath = validateRelativeAssetPath(requestedPath);
  const platformMetadata = update.exportMetadata.fileMetadata[platform];
  if (!platformMetadata) {
    throw new UpdateStorageError(`Update ${update.id} does not support ${platform}.`);
  }

  const isLaunchAsset = platformMetadata.bundle === relativePath;
  const assetMetadata = platformMetadata.assets.find((asset) => asset.path === relativePath);
  if (!isLaunchAsset && !assetMetadata) {
    throw new UpdateStorageError(`Asset is not part of update ${update.id}.`);
  }

  const absolutePath = resolveWithin(update.directory, relativePath);
  if (!fsSync.existsSync(absolutePath)) {
    throw new UpdateStorageError(`Asset is missing from update ${update.id}.`, 500);
  }

  return {
    relativePath,
    absolutePath,
    extension: isLaunchAsset ? null : (assetMetadata?.ext ?? null),
    isLaunchAsset,
  };
}
