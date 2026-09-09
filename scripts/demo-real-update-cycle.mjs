import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../expo-updates-server/scripts/runtime-version.mjs';

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceClient = path.join(repositoryDirectory, 'expo-updates-client');
const serverDirectory = path.join(repositoryDirectory, 'expo-updates-server');
const demoRoot = path.join(serverDirectory, '.local', 'real-update-demo');
const demoClient = path.join(demoRoot, 'client');
const demoUpdates = path.join(demoRoot, 'updates');
const artifactReport = path.join(demoRoot, 'artifacts.json');
const publishScript = path.join(serverDirectory, 'scripts', 'publish-update.mjs');
const rollbackScript = path.join(serverDirectory, 'scripts', 'publish-rollback.mjs');
const inspectScript = path.join(serverDirectory, 'scripts', 'inspect-artifacts.mjs');
const includeRollback = process.argv.includes('--include-rollback');
const platformIndex = process.argv.indexOf('--platform');
const platform = platformIndex >= 0 ? process.argv[platformIndex + 1] : 'ios';

if (!['ios', 'android'].includes(platform)) {
  throw new Error('--platform must be ios or android.');
}

await rm(demoRoot, { recursive: true, force: true });
await mkdir(demoRoot, { recursive: true });
await cp(sourceClient, demoClient, {
  recursive: true,
  filter(source) {
    const relative = path.relative(sourceClient, source);
    return ![
      'node_modules',
      '.expo',
      'dist',
      'ios/build',
      'android/build',
      'android/.gradle',
    ].some((excluded) => relative === excluded || relative.startsWith(`${excluded}${path.sep}`));
  },
});

const environment = {
  ...process.env,
  EXPO_RUNTIME_VERSION_POLICY: 'fingerprint',
  EXPO_UPDATES_CLIENT_DIRECTORY: demoClient,
  UPDATES_DIRECTORY: demoUpdates,
};
const publishArguments = [
  publishScript,
  '--platform',
  platform,
  '--channel',
  'main',
  '--patch-base-count',
  '3',
];

console.log('Step 1/4: exporting and publishing the baseline Expo application');
await run(process.execPath, publishArguments, repositoryDirectory, { env: environment });

const appPath = path.join(demoClient, 'App.js');
const originalApp = await readFile(appPath, 'utf8');
const changedApp = originalApp.replace(
  'Custom protocol server and public API diagnostics',
  'Custom protocol server · real BSDIFF40 demo change',
);
if (changedApp === originalApp) {
  throw new Error('Could not apply the controlled demo change to App.js.');
}
await writeFile(appPath, changedApp, 'utf8');

console.log('Step 2/4: publishing a real JavaScript change with the same native fingerprint');
await run(process.execPath, publishArguments, repositoryDirectory, { env: environment });

if (includeRollback) {
  console.log('Step 3/4: publishing a rollBackToEmbedded record');
  await run(
    process.execPath,
    [rollbackScript, '--platform', platform, '--channel', 'main'],
    repositoryDirectory,
    { env: environment },
  );
} else {
  console.log('Step 3/4: rollback publication skipped (pass --include-rollback to include it)');
}

console.log('Step 4/4: writing the minimal artifact report');
const report = await run(
  process.execPath,
  [inspectScript, '--output', artifactReport],
  repositoryDirectory,
  { capture: true, env: environment },
);
process.stdout.write(report);
console.log(`Demo updates: ${demoUpdates}`);
console.log(`Artifact report: ${artifactReport}`);
console.log('Host with: npm run demo:serve');
