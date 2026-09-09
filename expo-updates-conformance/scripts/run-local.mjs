import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDirectory = path.resolve(packageDirectory, '..');
const serverDirectory = path.join(repositoryDirectory, 'expo-updates-server');
const clientCertificate = path.join(
  repositoryDirectory,
  'expo-updates-client',
  '.local',
  'code-signing',
  'certificate.pem',
);

async function availablePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : undefined;
  server.close();
  await once(server, 'close');
  if (!port) {
    throw new Error('Could not allocate a local conformance-test port.');
  }
  return port;
}

function terminateProcessGroup(child, signal) {
  if (!child.pid) {
    return;
  }
  if (process.platform === 'win32') {
    child.kill(signal);
  } else {
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The local update server exited with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const requireFromServer = createRequire(path.join(serverDirectory, 'package.json'));
const nextBinary = requireFromServer.resolve('next/dist/bin/next');
const server = spawn(
  process.execPath,
  [nextBinary, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    cwd: serverDirectory,
    detached: process.platform !== 'win32',
    env: process.env,
    stdio: 'inherit',
  },
);

let exitCode = 1;
try {
  await waitForServer(baseUrl, server);
  const tests = spawn(
    process.execPath,
    ['--test', '--test-concurrency=1', 'test/protocol.test.mjs'],
    {
      cwd: packageDirectory,
      env: {
        ...process.env,
        EXPO_UPDATES_CONFORMANCE_BASE_URL: baseUrl,
        EXPO_UPDATES_CONFORMANCE_CERTIFICATE_PATH: clientCertificate,
        EXPO_UPDATES_CONFORMANCE_EXPECT_SIGNING: 'true',
      },
      stdio: 'inherit',
    },
  );
  const [testExitCode] = await once(tests, 'exit');
  exitCode = testExitCode ?? 1;
} finally {
  terminateProcessGroup(server, 'SIGTERM');
  const stopped = Promise.race([
    once(server, 'exit'),
    new Promise((resolve) => setTimeout(() => resolve(undefined), 5_000)),
  ]);
  const result = await stopped;
  if (result === undefined && server.exitCode === null) {
    terminateProcessGroup(server, 'SIGKILL');
    await once(server, 'exit');
  }
}

process.exitCode = exitCode;
