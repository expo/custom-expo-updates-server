import crypto from 'crypto';
import fs from 'fs/promises';
import mime from 'mime';
import forge from 'node-forge';

export function createHash(file: crypto.BinaryLike, hashingAlgorithm: string) {
  return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
}

export function signRSASHA256(data: string, privateKey: forge.pki.rsa.PrivateKey): string {
  var md = forge.md.sha256.create();
  md.update(data, 'utf8');
  const encodedSignature = privateKey.sign(md);
  return Buffer.from(forge.util.binary.raw.decode(encodedSignature)).toString('base64');
}

export async function getPrivateKeyAsync(): Promise<forge.pki.rsa.PrivateKey | null> {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return null;
  }

  const pemBuffer = await fs.readFile(privateKeyPath);
  const pem = pemBuffer.toString('utf8');
  return forge.pki.privateKeyFromPem(pem);
}

export async function getAssetMetadataSync({
  updateBundlePath,
  filePath,
  ext,
  isLaunchAsset,
  runtimeVersion,
  platform,
}: {
  updateBundlePath: string;
  filePath: string;
  ext: string | null;
  isLaunchAsset: boolean;
  runtimeVersion: string;
  platform: string;
}) {
  const assetFilePath = `${updateBundlePath}/${filePath}`;
  const asset = await fs.readFile(assetFilePath);
  const assetHash = createHash(asset, 'sha256');
  const keyHash = createHash(asset, 'md5');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext);

  return {
    hash: assetHash,
    key: `${keyHash}.${keyExtensionSuffix}`,
    contentType,
    url: `${process.env.HOSTNAME}/api/assets?asset=${assetFilePath}&runtimeVersion=${runtimeVersion}&platform=${platform}`,
  };
}

export async function getMetadataAsync({
  updateBundlePath,
  runtimeVersion,
}: {
  updateBundlePath: string;
  runtimeVersion: string;
}) {
  try {
    const metadataPath = `${updateBundlePath}/metadata.json`;
    const updateMetadataBuffer = await fs.readFile(metadataPath);
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    const metadataStat = await fs.stat(metadataPath);

    return {
      metadataJson,
      createdAt: new Date(metadataStat.birthtime).toISOString(),
      id: createHash(updateMetadataBuffer, 'sha256'),
    };
  } catch (error) {
    throw new Error(`No update found with runtime version: ${runtimeVersion}. Error: ${error}`);
  }
}

export function convertSHA256HashToUUID(value: string) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20
  )}-${value.slice(20, 32)}`;
}
