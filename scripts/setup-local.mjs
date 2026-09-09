import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDirectory = path.join(rootDirectory, 'expo-updates-client');
const serverDirectory = path.join(rootDirectory, 'expo-updates-server');
const keyDirectory = path.join(serverDirectory, '.local', 'code-signing');
const certificateDirectory = path.join(clientDirectory, '.local', 'code-signing');
const privateKeyPath = path.join(keyDirectory, 'private-key.pem');
const publicKeyPath = path.join(keyDirectory, 'public-key.pem');
const certificatePath = path.join(certificateDirectory, 'certificate.pem');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

const generatedFiles = [privateKeyPath, publicKeyPath, certificatePath];
const generatedFileCount = generatedFiles.filter(existsSync).length;

if (generatedFileCount !== 0 && generatedFileCount !== generatedFiles.length) {
  throw new Error(
    'The local signing setup is incomplete. Remove the client and server .local/code-signing directories, then rerun npm run setup.',
  );
}

if (generatedFileCount === 0) {
  await mkdir(keyDirectory, { recursive: true });
  await mkdir(certificateDirectory, { recursive: true });
  await run(
    'npx',
    [
      '--no-install',
      'expo-updates',
      'codesigning:generate',
      '--key-output-directory',
      keyDirectory,
      '--certificate-output-directory',
      certificateDirectory,
      '--certificate-validity-duration-years',
      '10',
      '--certificate-common-name',
      'Custom Expo Updates Local Development',
    ],
    clientDirectory,
  );
}

const environmentPath = path.join(serverDirectory, '.env.local');
if (!existsSync(environmentPath)) {
  await writeFile(
    environmentPath,
    [
      'PRIVATE_KEY_PATH=.local/code-signing/private-key.pem',
      'CODE_SIGNING_KEY_ID=main',
      '',
    ].join('\n'),
    'utf8',
  );
}

console.log('Local signing material and server environment are ready.');
console.log('Private keys are stored under expo-updates-server/.local and are ignored by Git.');
