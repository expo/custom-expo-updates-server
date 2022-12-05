import crypto, { BinaryToTextEncoding } from 'crypto';
import fs from 'fs';
import mime from 'mime';
import path from 'path';
import { Dictionary } from 'structured-headers';

function createHash(file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
}

function getBase64URLEncoding(base64EncodedString: string): string {
  return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  const assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'));
  const key = createHash(asset, 'md5', 'hex');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext);

  return {
    hash: assetHash,
    key,
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
      id: createHash(updateMetadataBuffer, 'sha256', 'hex'),
    };
  } catch (error) {
    throw new Error(`No update found with runtime version: ${runtimeVersion}. Error: ${error}`);
  }
}

/**
 * This adds the `@expo/config`-exported config to `extra.expoConfig`, which is a common thing
 * done by implementors of the expo-updates specification since a lot of Expo modules use it.
 * It is not required by the specification, but is included here in the example client and server
 * for demonstration purposes. EAS Update does something conceptually very similar.
 */
export function getExpoConfigSync({ updateBundlePath, runtimeVersion }) {
  try {
    const expoConfigPath = `${updateBundlePath}/expoConfig.json`;
    const expoConfigBuffer = fs.readFileSync(path.resolve(expoConfigPath), null);
    const expoConfigJson = JSON.parse(expoConfigBuffer.toString('utf-8'));
    return expoConfigJson;
  } catch (error) {
    throw new Error(
      `No expo config json found with runtime version: ${runtimeVersion}. Error: ${error}`
    );
  }
}

export function convertSHA256HashToUUID(value: string) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20
  )}-${value.slice(20, 32)}`;
}
