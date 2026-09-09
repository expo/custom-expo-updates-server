import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import type { Platform, StoredAsset, StoredLaunchAssetPatch, StoredUpdate } from './storage';

type CacheMetadata = {
  schemaVersion: 1;
  state: 'ready' | 'inefficient';
  cacheKey: string;
  runtimeVersion: string;
  platform: Platform;
  baseUpdateId: string;
  targetUpdateId: string;
  baseAssetHash: string;
  targetAssetHash: string;
  targetSize: number;
  maxPatchRatio: number;
  patchSize?: number;
  patchHash?: string;
  createdAt: string;
};

export type ResolvedLaunchAssetPatch = StoredLaunchAssetPatch & {
  source: 'on-demand-generated' | 'on-demand-cache';
};

type PatchRequest = {
  runtimeVersion: string;
  platform: Platform;
  baseUpdate: StoredUpdate;
  targetUpdate: StoredUpdate;
  baseAsset: StoredAsset;
  targetAsset: StoredAsset;
  baseBody: Buffer;
  targetBody: Buffer;
};

type CachePaths = {
  directory: string;
  metadata: string;
  patch: string;
  lock: string;
};

const inFlight = new Map<string, Promise<ResolvedLaunchAssetPatch | undefined>>();
let activeWorkers = 0;
const workerWaiters: (() => void)[] = [];

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value.trim().toLowerCase() === 'true';
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parsePatchRatio(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : 0.9;
}

export function getOnDemandPatchCacheRoot(): string {
  const configured = process.env.BSDIFF_ON_DEMAND_CACHE_DIRECTORY?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  let updatesDirectory = process.env.UPDATES_DIRECTORY?.trim();
  updatesDirectory ??= 'updates';
  if (updatesDirectory.length === 0) {
    updatesDirectory = 'updates';
  }
  const updatesRoot = path.resolve(updatesDirectory);
  return path.join(updatesRoot, '.cache', 'bsdiff');
}

function sha256Base64Url(body: Buffer): string {
  return crypto.createHash('sha256').update(body).digest('base64url');
}

function cacheKey(
  request: PatchRequest,
  baseAssetHash: string,
  targetAssetHash: string,
  maxPatchRatio: number,
): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        runtimeVersion: request.runtimeVersion,
        platform: request.platform,
        baseUpdateId: request.baseUpdate.id,
        targetUpdateId: request.targetUpdate.id,
        baseAssetHash,
        targetAssetHash,
        maxPatchRatio,
      }),
    )
    .digest('hex');
}

function cachePaths(key: string): CachePaths {
  const directory = path.join(getOnDemandPatchCacheRoot(), key.slice(0, 2));
  return {
    directory,
    metadata: path.join(directory, `${key}.json`),
    patch: path.join(directory, `${key}.bsdiff`),
    lock: path.join(directory, `${key}.lock`),
  };
}

async function removeCacheEntry(paths: CachePaths): Promise<void> {
  await Promise.all([fs.rm(paths.metadata, { force: true }), fs.rm(paths.patch, { force: true })]);
}

async function loadCachedPatch(
  paths: CachePaths,
  expected: Omit<
    CacheMetadata,
    'schemaVersion' | 'state' | 'createdAt' | 'patchSize' | 'patchHash'
  >,
  maxPatchRatio: number,
): Promise<{ hit: boolean; patch?: ResolvedLaunchAssetPatch }> {
  let metadata: CacheMetadata;
  try {
    metadata = JSON.parse(await fs.readFile(paths.metadata, 'utf8')) as CacheMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { hit: false };
    }
    await removeCacheEntry(paths);
    return { hit: false };
  }

  const validIdentity =
    metadata.schemaVersion === 1 &&
    metadata.cacheKey === expected.cacheKey &&
    metadata.runtimeVersion === expected.runtimeVersion &&
    metadata.platform === expected.platform &&
    metadata.baseUpdateId === expected.baseUpdateId &&
    metadata.targetUpdateId === expected.targetUpdateId &&
    metadata.baseAssetHash === expected.baseAssetHash &&
    metadata.targetAssetHash === expected.targetAssetHash &&
    metadata.targetSize === expected.targetSize &&
    metadata.maxPatchRatio === expected.maxPatchRatio;
  if (!validIdentity) {
    await removeCacheEntry(paths);
    return { hit: false };
  }
  if (metadata.state === 'inefficient') {
    return { hit: true };
  }

  try {
    const patchBody = await fs.readFile(paths.patch);
    if (
      metadata.patchSize !== patchBody.length ||
      metadata.patchHash !== sha256Base64Url(patchBody) ||
      patchBody.length >= Math.floor(expected.targetSize * maxPatchRatio)
    ) {
      await removeCacheEntry(paths);
      return { hit: false };
    }
    return {
      hit: true,
      patch: {
        absolutePath: paths.patch,
        relativePath: path.relative(getOnDemandPatchCacheRoot(), paths.patch),
        size: patchBody.length,
        patchHash: metadata.patchHash,
        baseAssetHash: metadata.baseAssetHash,
        targetAssetHash: metadata.targetAssetHash,
        source: 'on-demand-cache',
      },
    };
  } catch {
    await removeCacheEntry(paths);
    return { hit: false };
  }
}

async function acquireWorkerSlot(): Promise<void> {
  const maxConcurrency = parsePositiveInteger(process.env.BSDIFF_ON_DEMAND_MAX_CONCURRENCY, 2);
  if (activeWorkers < maxConcurrency) {
    activeWorkers += 1;
    return;
  }
  await new Promise<void>((resolve) => workerWaiters.push(resolve));
  activeWorkers += 1;
}

function releaseWorkerSlot(): void {
  activeWorkers -= 1;
  workerWaiters.shift()?.();
}

async function runBsdiffWorker(basePath: string, targetPath: string, patchPath: string) {
  await acquireWorkerSlot();
  try {
    const timeoutMs = parsePositiveInteger(process.env.BSDIFF_ON_DEMAND_TIMEOUT_MS, 30_000);
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(
        `
          const { parentPort, workerData } = require('node:worker_threads');
          try {
            require('bsdiff-node').diffSync(
              workerData.basePath,
              workerData.targetPath,
              workerData.patchPath
            );
            parentPort.postMessage({ ok: true });
          } catch (error) {
            parentPort.postMessage({
              ok: false,
              message: error && error.message ? error.message : String(error)
            });
          }
        `,
        {
          eval: true,
          workerData: { basePath, targetPath, patchPath },
        },
      );
      const timeout = setTimeout(() => {
        worker.terminate().catch(() => undefined);
        reject(new Error(`BSDIFF generation exceeded ${timeoutMs}ms.`));
      }, timeoutMs);
      worker.once('message', (message: { ok: boolean; message?: string }) => {
        clearTimeout(timeout);
        worker.terminate().catch(() => undefined);
        if (message.ok) {
          resolve();
        } else {
          reject(new Error(message.message ?? 'BSDIFF worker failed.'));
        }
      });
      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      worker.once('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`BSDIFF worker exited with status ${code}.`));
        }
      });
    });
  } finally {
    releaseWorkerSlot();
  }
}

async function writeMetadataAtomically(paths: CachePaths, metadata: CacheMetadata): Promise<void> {
  const temporary = `${paths.metadata}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`);
  await fs.rename(temporary, paths.metadata);
}

async function waitForLockOwner(
  paths: CachePaths,
  expected: Omit<
    CacheMetadata,
    'schemaVersion' | 'state' | 'createdAt' | 'patchSize' | 'patchHash'
  >,
  maxPatchRatio: number,
): Promise<ResolvedLaunchAssetPatch | undefined> {
  const timeoutMs = parsePositiveInteger(process.env.BSDIFF_ON_DEMAND_TIMEOUT_MS, 30_000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const cached = await loadCachedPatch(paths, expected, maxPatchRatio);
    if (cached.hit) {
      return cached.patch;
    }
    if (!fsSync.existsSync(paths.lock)) {
      return undefined;
    }
  }
  return undefined;
}

async function generateAndCachePatch(
  request: PatchRequest,
  key: string,
  paths: CachePaths,
  expected: Omit<
    CacheMetadata,
    'schemaVersion' | 'state' | 'createdAt' | 'patchSize' | 'patchHash'
  >,
  maxPatchRatio: number,
): Promise<ResolvedLaunchAssetPatch | undefined> {
  await fs.mkdir(paths.directory, { recursive: true });
  let lock;
  try {
    lock = await fs.open(paths.lock, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return await waitForLockOwner(paths, expected, maxPatchRatio);
    }
    throw error;
  }

  const temporaryPatch = `${paths.patch}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const cached = await loadCachedPatch(paths, expected, maxPatchRatio);
    if (cached.hit) {
      return cached.patch;
    }
    await runBsdiffWorker(
      request.baseAsset.absolutePath,
      request.targetAsset.absolutePath,
      temporaryPatch,
    );
    const patchBody = await fs.readFile(temporaryPatch);
    if (patchBody.length >= Math.floor(request.targetBody.length * maxPatchRatio)) {
      await fs.rm(temporaryPatch, { force: true });
      await writeMetadataAtomically(paths, {
        schemaVersion: 1,
        state: 'inefficient',
        ...expected,
        createdAt: new Date().toISOString(),
      });
      return undefined;
    }

    const patchHash = sha256Base64Url(patchBody);
    await fs.rename(temporaryPatch, paths.patch);
    await writeMetadataAtomically(paths, {
      schemaVersion: 1,
      state: 'ready',
      ...expected,
      patchSize: patchBody.length,
      patchHash,
      createdAt: new Date().toISOString(),
    });
    return {
      absolutePath: paths.patch,
      relativePath: path.relative(getOnDemandPatchCacheRoot(), paths.patch),
      size: patchBody.length,
      patchHash,
      baseAssetHash: expected.baseAssetHash,
      targetAssetHash: expected.targetAssetHash,
      source: 'on-demand-generated',
    };
  } finally {
    await fs.rm(temporaryPatch, { force: true });
    await lock.close();
    await fs.rm(paths.lock, { force: true });
  }
}

export async function getOrCreateOnDemandLaunchAssetPatchAsync(
  request: PatchRequest,
): Promise<ResolvedLaunchAssetPatch | undefined> {
  if (!parseBoolean(process.env.BSDIFF_ON_DEMAND_ENABLED, true)) {
    return undefined;
  }
  const maxBytes = parsePositiveInteger(
    process.env.BSDIFF_ON_DEMAND_MAX_ASSET_BYTES,
    64 * 1024 * 1024,
  );
  if (request.baseBody.length > maxBytes || request.targetBody.length > maxBytes) {
    return undefined;
  }

  const baseAssetHash = sha256Base64Url(request.baseBody);
  const targetAssetHash = sha256Base64Url(request.targetBody);
  const maxPatchRatio = parsePatchRatio(process.env.BSDIFF_MAX_PATCH_RATIO);
  const key = cacheKey(request, baseAssetHash, targetAssetHash, maxPatchRatio);
  const paths = cachePaths(key);
  const expected = {
    cacheKey: key,
    runtimeVersion: request.runtimeVersion,
    platform: request.platform,
    baseUpdateId: request.baseUpdate.id,
    targetUpdateId: request.targetUpdate.id,
    baseAssetHash,
    targetAssetHash,
    targetSize: request.targetBody.length,
    maxPatchRatio,
  };
  const cached = await loadCachedPatch(paths, expected, maxPatchRatio);
  if (cached.hit) {
    return cached.patch;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return await existing;
  }
  const generated = generateAndCachePatch(request, key, paths, expected, maxPatchRatio).catch(
    (error) => {
      console.error(`On-demand BSDIFF generation failed for ${key}:`, error);
      return undefined;
    },
  );
  inFlight.set(key, generated);
  try {
    return await generated;
  } finally {
    inFlight.delete(key);
  }
}

export async function getOnDemandPatchCacheReportAsync() {
  const cacheRoot = getOnDemandPatchCacheRoot();
  const entries: CacheMetadata[] = [];
  async function walk(directory: string): Promise<void> {
    let children;
    try {
      children = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
    await Promise.all(
      children.map(async (child) => {
        const childPath = path.join(directory, child.name);
        if (child.isDirectory()) {
          await walk(childPath);
        } else if (child.name.endsWith('.json')) {
          try {
            const metadata = JSON.parse(await fs.readFile(childPath, 'utf8')) as CacheMetadata;
            if (metadata.schemaVersion === 1) {
              entries.push(metadata);
            }
          } catch {
            // A corrupt derived cache entry is ignored here and regenerated on request.
          }
        }
      }),
    );
  }
  await walk(cacheRoot);
  return {
    enabled: parseBoolean(process.env.BSDIFF_ON_DEMAND_ENABLED, true),
    directory: cacheRoot,
    readyEntries: entries.filter((entry) => entry.state === 'ready').length,
    inefficientEntries: entries.filter((entry) => entry.state === 'inefficient').length,
    patchBytes: entries.reduce((total, entry) => total + (entry.patchSize ?? 0), 0),
  };
}
