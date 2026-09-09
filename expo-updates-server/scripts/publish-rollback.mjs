import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appendCatalogRecordsAsync } from './catalog.mjs';
import {
  option,
  resolveRuntimeVersionAsync,
  safeSegment,
  selectedPlatforms,
} from './runtime-version.mjs';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDirectory = path.resolve(
  process.env.EXPO_UPDATES_CLIENT_DIRECTORY?.trim() ||
    path.resolve(serverDirectory, '..', 'expo-updates-client'),
);
const updatesDirectory = path.resolve(
  serverDirectory,
  process.env.UPDATES_DIRECTORY?.trim() || 'updates',
);
const runtimeVersionOverride = option('--runtime-version', undefined);
const channel = safeSegment(option('--channel', 'main'), 'channel');
const platforms = selectedPlatforms(option('--platform', 'all'));
const createdAt = new Date().toISOString();
const directoryPrefix = String(Date.now());
const groupId = crypto.randomUUID();
const preparedRollbacks = [];
const publishedDirectories = [];

try {
  for (const platform of platforms) {
    const runtimeVersion = await resolveRuntimeVersionAsync({
      clientDirectory,
      platform,
      override: runtimeVersionOverride,
    });
    const runtimeDirectory = path.join(updatesDirectory, runtimeVersion);
    const directoryName = `${directoryPrefix}-${platform}-rollback`;
    const targetDirectory = path.join(
      runtimeDirectory,
      directoryName,
    );
    const stagingDirectory = `${targetDirectory}.tmp`;

    if (existsSync(targetDirectory) || existsSync(stagingDirectory)) {
      throw new Error(`Rollback directory already exists: ${targetDirectory}`);
    }

    await mkdir(stagingDirectory, { recursive: true });
    await writeFile(path.join(stagingDirectory, 'rollback'), '', 'utf8');
    await writeFile(
      path.join(stagingDirectory, 'server.json'),
      `${JSON.stringify(
        {
          groupId,
          createdAt,
          runtimeVersion,
          platform,
          channel,
          metadata: { channel, groupId, platform },
          manifestFilters: { channel },
          serverDefinedHeaders: { 'expo-channel-name': channel },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    preparedRollbacks.push({
      platform,
      runtimeVersion,
      groupId,
      createdAt,
      channel,
      directory: `${runtimeVersion}/${directoryName}`,
      targetDirectory,
      stagingDirectory,
    });
  }

  for (const rollback of preparedRollbacks) {
    await rename(rollback.stagingDirectory, rollback.targetDirectory);
    publishedDirectories.push(rollback.targetDirectory);
  }
  await appendCatalogRecordsAsync(
    updatesDirectory,
    preparedRollbacks.map((rollback) => ({
      kind: 'rollback',
      state: 'active',
      directory: rollback.directory,
      groupId: rollback.groupId,
      createdAt: rollback.createdAt,
      runtimeVersion: rollback.runtimeVersion,
      platform: rollback.platform,
      channel: rollback.channel,
    })),
  );

  console.log(`Published rollback group ${groupId}`);
  for (const rollback of preparedRollbacks) {
    console.log(`${rollback.platform}: runtime ${rollback.runtimeVersion}`);
    console.log(`Directory: ${rollback.targetDirectory}`);
  }
} catch (error) {
  await Promise.all(
    publishedDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  throw error;
} finally {
  await Promise.all(
    preparedRollbacks.map((rollback) =>
      rm(rollback.stagingDirectory, { recursive: true, force: true }),
    ),
  );
}
