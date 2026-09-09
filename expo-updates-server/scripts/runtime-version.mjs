import { spawn } from 'node:child_process';

export const SUPPORTED_PLATFORMS = ['android', 'ios'];

export function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

export function safeSegment(value, label) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value === '.' ||
    value === '..'
  ) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value;
}

export function selectedPlatforms(value = 'all') {
  if (value === 'all') {
    return SUPPORTED_PLATFORMS;
  }
  if (!SUPPORTED_PLATFORMS.includes(value)) {
    throw new Error(`Invalid platform: ${value}. Expected android, ios, or all.`);
  }
  return [value];
}

export function run(command, args, cwd, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let stdout = '';
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

export async function resolveRuntimeVersionAsync({
  clientDirectory,
  platform,
  override,
}) {
  if (override) {
    return safeSegment(override, 'runtime version');
  }
  const output = await run(
    'npx',
    [
      '--no-install',
      'expo-updates',
      'runtimeversion:resolve',
      '--platform',
      platform,
    ],
    clientDirectory,
    { capture: true },
  );
  const result = JSON.parse(output);
  return safeSegment(result.runtimeVersion, `${platform} runtime version`);
}
