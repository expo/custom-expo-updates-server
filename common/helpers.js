import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime';

export function createHash(file, hashingAlgorithm) {
  return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
}

export function getAssetMetadataSync({
  updateBundlePath,
  filePath,
  ext,
  isLaunchAsset,
  runtimeVersion,
  platform,
}) {
  const assetFilePath = `${updateBundlePath}/${filePath}`;
  const asset = fs.readFileSync(assetFilePath, null);
  const assetHash = createHash(asset, 'sha256');
  const keyHash = createHash(asset, 'md5');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const contentType = isLaunchAsset
    ? 'application/javascript'
    : mime.getType(ext);

  return {
    hash: assetHash,
    key: `${keyHash}.${keyExtensionSuffix}`,
    contentType,
    url: `${process.env.HOSTNAME}/api/assets?asset=${assetFilePath}&runtimeVersion=${runtimeVersion}&platform=${platform}`,
  };
}

export function getMetadataSync({ updateBundlePath, runtimeVersion }) {
  try {
    const metadataPath = `${updateBundlePath}/metadata.json`;
    const updateMetadataBuffer = fs.readFileSync(metadataPath, null);
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    const metadataStat = fs.statSync(metadataPath);

    return {
      metadataJson,
      createdAt: new Date(metadataStat.birthtime).toISOString(),
      id: createHash(updateMetadataBuffer, 'sha256'),
    };
  } catch (error) {
    throw new Error(
      `No update found with runtime version: ${runtimeVersion}. Error: ${error}`
    );
  }
}

export function convertSHA256HashToUUID(value) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}
