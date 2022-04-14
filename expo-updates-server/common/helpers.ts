import crypto from 'crypto';
import fs from 'fs';
import mime from 'mime';
import path from 'path';
import { Dictionary } from 'structured-headers';

export function createHash(file: Buffer, hashingAlgorithm: string) {
  return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
}

export function convertToDictionaryItemsRepresentation(obj: { [key: string]: string }): Dictionary {
  return new Map(
    Object.entries(obj).map(([k, v]) => {
      return [k, [v, new Map()]];
    })
  );
}

export function signRSASHA256(data: string, privateKey: string) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export async function getPrivateKeyAsync() {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return null;
  }

  const pemBuffer = fs.readFileSync(path.resolve(privateKeyPath));
  return pemBuffer.toString('utf8');
}

export function getAssetMetadataSync({
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
  const asset = fs.readFileSync(path.resolve(assetFilePath), null);
  const assetHash = createHash(asset, 'sha256');
  const keyHash = createHash(asset, 'md5');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext);

  return {
    hash: assetHash,
    key: keyHash,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url: `${process.env.HOSTNAME}/api/assets?asset=${assetFilePath}&runtimeVersion=${runtimeVersion}&platform=${platform}`,
  };
}

export function getMetadataSync({ updateBundlePath, runtimeVersion }) {
  try {
    const metadataPath = `${updateBundlePath}/metadata.json`;
    const updateMetadataBuffer = fs.readFileSync(path.resolve(metadataPath), null);
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    const metadataStat = fs.statSync(metadataPath);

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
