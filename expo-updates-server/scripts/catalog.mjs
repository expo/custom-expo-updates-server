import crypto from 'node:crypto';
import { open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCK_RETRY_COUNT = 100;
const LOCK_RETRY_DELAY_MS = 50;

async function readCatalogAsync(catalogPath) {
  try {
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.records)) {
      throw new Error('Invalid updates catalog schema.');
    }
    return catalog;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { schemaVersion: 1, records: [] };
    }
    throw error;
  }
}

async function acquireLockAsync(lockPath) {
  for (let attempt = 0; attempt < LOCK_RETRY_COUNT; attempt += 1) {
    try {
      return await open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    }
  }
  throw new Error(`Timed out waiting for updates catalog lock: ${lockPath}`);
}

export async function appendCatalogRecordsAsync(updatesDirectory, records) {
  const catalogPath = path.join(updatesDirectory, 'catalog.json');
  const lockPath = `${catalogPath}.lock`;
  const temporaryPath = `${catalogPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const lock = await acquireLockAsync(lockPath);

  try {
    const catalog = await readCatalogAsync(catalogPath);
    const activeIds = new Set(
      catalog.records
        .filter((record) => record.state === 'active' && record.id)
        .map((record) => record.id.toLowerCase()),
    );
    for (const record of records) {
      if (record.id && activeIds.has(record.id.toLowerCase())) {
        throw new Error(`Duplicate active update ID: ${record.id}`);
      }
      if (record.id) {
        activeIds.add(record.id.toLowerCase());
      }
    }
    catalog.records.push(...records);
    await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, catalogPath);
  } finally {
    await lock.close();
    await rm(temporaryPath, { force: true });
    await rm(lockPath, { force: true });
  }
}
