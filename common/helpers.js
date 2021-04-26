import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime';

export function createHash(file, hashingAlgorithm) {
  return crypto.createHash(hashingAlgorithm).update(file).digest('hex');
}

export function saveFileAndGetAssetMetadata({
  updateBundlePath,
  filePath,
  ext,
  isLaunchAsset,
}) {
  const assetFilePath = `${updateBundlePath}/${filePath}`;
  const asset = fs.readFileSync(assetFilePath, null);
  const assetHash = createHash(asset, 'sha256');
  const keyHash = createHash(asset, 'md5');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const urlExtensionSuffix = ext ? `.${ext}` : '';
  const contentType = isLaunchAsset
    ? 'application/javascript'
    : mime.getType(ext);
  const assetNameHash = createHash(`${asset}${contentType}`, 'sha256');

  return {
    hash: assetHash,
    key: `${keyHash}.${keyExtensionSuffix}`,
    contentType,
    url: `http://localhost:3000/api/assets?asset=${assetFilePath}&contentType=${contentType}`,
  };
}

export function getMetadataSync(updateBundlePath) {
  try {
    const metadataPath = `${updateBundlePath}/metadata.json`;
    const updateMetadataBuffer = fs.readFileSync(metadataPath, null);
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    const metadataStat = fs.statSync(metadataPath);

    return {
      metadataJson,
      createdAt: metadataStat.birthtime,
      id: createHash(updateMetadataBuffer, 'sha256'),
    };
  } catch (error) {
    throw new Error(
      `No update found with runtime version: ${runtimeVersion}. Error: ${error}`
    );
  }
}
