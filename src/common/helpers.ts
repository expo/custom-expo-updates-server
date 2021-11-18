import crypto from 'crypto';
import fs from 'fs/promises';
import mime from 'mime';

export function createHash(file: crypto.BinaryLike, hashingAlgorithm: string) {
  return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
}

export function signRSASHA256(data: string | crypto.BinaryLike, privateKey: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  if (typeof data === 'string') {
    sign.update(data, 'utf8');
  } else {
    sign.update(data);
  }
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export async function getPrivateKeyAsync(): Promise<string | null> {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return null;
  }

  const pemBuffer = await fs.readFile(privateKeyPath);
  return pemBuffer.toString('utf8');
}

export async function getAssetMetadataAsync({
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
    fileExtension: `.${keyExtensionSuffix}`,
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
