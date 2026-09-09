import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '@expo/config';

import { appendCatalogRecordsAsync } from './catalog.mjs';
import {
  option,
  resolveRuntimeVersionAsync,
  run,
  safeSegment,
  selectedPlatforms,
} from './runtime-version.mjs';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDirectory = path.resolve(serverDirectory, '..', 'expo-updates-client');
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
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'expo-update-export-'));
const preparedUpdates = [];
const publishedDirectories = [];

const { exp } = getConfig(clientDirectory, {
  skipSDKVersionRequirement: true,
  isPublicConfig: true,
});

try {
  for (const platform of platforms) {
    const runtimeVersion = await resolveRuntimeVersionAsync({
      clientDirectory,
      platform,
      override: runtimeVersionOverride,
    });
    const exportDirectory = path.join(temporaryDirectory, platform);
    const runtimeDirectory = path.join(updatesDirectory, runtimeVersion);
    const directoryName = `${directoryPrefix}-${platform}`;
    const targetDirectory = path.join(runtimeDirectory, directoryName);
    const stagingDirectory = `${targetDirectory}.tmp`;

    if (existsSync(targetDirectory) || existsSync(stagingDirectory)) {
      throw new Error(`Update directory already exists: ${targetDirectory}`);
    }

    await run(
      'npx',
      [
        '--no-install',
        'expo',
        'export',
        '--platform',
        platform,
        '--output-dir',
        exportDirectory,
      ],
      clientDirectory,
    );

    const metadataBuffer = await readFile(path.join(exportDirectory, 'metadata.json'));
    const updateId = crypto.randomUUID();
    const resolvedExpoConfig = {
      ...exp,
      runtimeVersion,
      [platform]: {
        ...(exp[platform] ?? {}),
        runtimeVersion,
      },
    };

    await mkdir(runtimeDirectory, { recursive: true });
    await cp(exportDirectory, stagingDirectory, { recursive: true });
    await writeFile(
      path.join(stagingDirectory, 'expoConfig.json'),
      `${JSON.stringify(resolvedExpoConfig, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(stagingDirectory, 'server.json'),
      `${JSON.stringify(
        {
          id: updateId,
          groupId,
          createdAt,
          runtimeVersion,
          platform,
          channel,
          metadata: { channel, groupId, platform },
          manifestFilters: { channel },
          serverDefinedHeaders: { 'expo-channel-name': channel },
          assetRequestHeaders: {
            'x-expo-update-id': updateId,
            'x-expo-update-group-id': groupId,
          },
          exportHash: crypto.createHash('sha256').update(metadataBuffer).digest('hex'),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    preparedUpdates.push({
      platform,
      runtimeVersion,
      updateId,
      groupId,
      createdAt,
      channel,
      directory: `${runtimeVersion}/${directoryName}`,
      targetDirectory,
      stagingDirectory,
    });
  }

  for (const update of preparedUpdates) {
    await rename(update.stagingDirectory, update.targetDirectory);
    publishedDirectories.push(update.targetDirectory);
  }
  await appendCatalogRecordsAsync(
    updatesDirectory,
    preparedUpdates.map((update) => ({
      kind: 'update',
      state: 'active',
      directory: update.directory,
      id: update.updateId,
      groupId: update.groupId,
      createdAt: update.createdAt,
      runtimeVersion: update.runtimeVersion,
      platform: update.platform,
      channel: update.channel,
    })),
  );

  console.log(`Published update group ${groupId}`);
  for (const update of preparedUpdates) {
    console.log(
      `${update.platform}: ${update.updateId} (runtime ${update.runtimeVersion})`,
    );
    console.log(`Directory: ${update.targetDirectory}`);
  }
} catch (error) {
  await Promise.all(
    publishedDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  throw error;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
  await Promise.all(
    preparedUpdates.map((update) =>
      rm(update.stagingDirectory, { recursive: true, force: true }),
    ),
  );
}
