import mime from 'mime';
import type { NextApiRequest } from 'next';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDictionary, serializeDictionary, type Dictionary } from 'structured-headers';

import { getStoredAsset, type Platform, type StoredAsset, type StoredUpdate } from './storage';

export type ExpoManifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ExpoAsset;
  assets: ExpoAsset[];
  metadata: Record<string, string>;
  extra: Record<string, unknown>;
};

export type ExpoAsset = {
  hash: string;
  key: string;
  contentType: string;
  fileExtension?: string;
  url: string;
};

export type ResponseContentType = 'application/expo+json' | 'application/json' | 'multipart/mixed';

export class ProtocolError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function createHash(
  data: crypto.BinaryLike,
  algorithm: string,
  encoding: crypto.BinaryToTextEncoding,
) {
  return crypto.createHash(algorithm).update(data).digest(encoding);
}

function toDictionary(input: Record<string, string>): Dictionary {
  return new Map(
    Object.entries(input).map(([key, value]) => [key.toLowerCase(), [value, new Map()]]),
  );
}

export function serializeExpoDictionary(input?: Record<string, string>): string | undefined {
  if (!input || Object.keys(input).length === 0) {
    return undefined;
  }
  return serializeDictionary(toDictionary(input));
}

export function parseExpoDictionary(value?: string): Record<string, string> {
  if (!value) {
    return {};
  }
  try {
    return Object.fromEntries(
      [...parseDictionary(value).entries()].map(([key, [item]]) => [key, String(item)]),
    );
  } catch {
    throw new ProtocolError('Expo-Extra-Params must be a valid Expo SFV dictionary.');
  }
}

export function signRSASHA256(data: string, privateKey: string): string {
  return crypto.sign('RSA-SHA256', Buffer.from(data, 'utf8'), privateKey).toString('base64');
}

export async function getPrivateKeyAsync(): Promise<string | null> {
  const configuredPath = process.env.PRIVATE_KEY_PATH;
  if (!configuredPath) {
    return null;
  }
  return await fs.readFile(path.resolve(configuredPath), 'utf8');
}

export async function getSignatureAsync(
  body: string,
  signatureRequested: boolean,
): Promise<string | undefined> {
  if (!signatureRequested) {
    return undefined;
  }
  const privateKey = await getPrivateKeyAsync();
  if (!privateKey) {
    throw new ProtocolError(
      'Code signing was requested, but PRIVATE_KEY_PATH is not configured.',
      400,
    );
  }
  const configuredKeyId = process.env.CODE_SIGNING_KEY_ID;
  return serializeExpoDictionary({
    sig: signRSASHA256(body, privateKey),
    keyid: configuredKeyId?.trim() ? configuredKeyId : 'main',
    alg: 'rsa-v1_5-sha256',
  });
}

export function getRequestHeader(req: NextApiRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    throw new ProtocolError(`Header ${name} must be provided once.`);
  }
  return value;
}

export function getSingleQueryValue(req: NextApiRequest, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) {
    throw new ProtocolError(`Query parameter ${name} must be provided once.`);
  }
  return value;
}

function parseWeightedValues(value: string): {
  value: string;
  quality: number;
  index: number;
}[] {
  return value
    .split(',')
    .map((entry, index) => {
      const [rawValue, ...parameters] = entry.trim().toLowerCase().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number.parseFloat(qualityParameter.trim().slice(2)) : 1;
      return {
        value: rawValue,
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((entry) => entry.value && entry.quality > 0);
}

export function negotiateResponseContentType(
  acceptHeader: string | undefined,
  available: ResponseContentType[],
): ResponseContentType {
  if (!acceptHeader || acceptHeader.trim() === '*/*') {
    return available.includes('multipart/mixed') ? 'multipart/mixed' : available[0];
  }

  const accepted = parseWeightedValues(acceptHeader);
  const matches = available.flatMap((candidate, preference) => {
    const [candidateType] = candidate.split('/');
    return accepted
      .filter(
        (entry) =>
          entry.value === candidate ||
          entry.value === '*/*' ||
          entry.value === `${candidateType}/*`,
      )
      .map((entry) => ({
        candidate,
        quality: entry.quality,
        requestIndex: entry.index,
        preference,
      }));
  });

  matches.sort(
    (left, right) =>
      right.quality - left.quality ||
      left.requestIndex - right.requestIndex ||
      left.preference - right.preference,
  );
  if (!matches[0]) {
    throw new ProtocolError('No supported response content type was requested.', 406);
  }
  return matches[0].candidate;
}

export function negotiateContentEncoding(
  acceptEncodingHeader: string | undefined,
  available: string[],
): string | undefined {
  if (!acceptEncodingHeader) {
    return undefined;
  }
  const accepted = parseWeightedValues(acceptEncodingHeader);
  const matches = available.flatMap((candidate, preference) =>
    accepted
      .filter((entry) => entry.value === candidate || entry.value === '*')
      .map((entry) => ({
        candidate,
        quality: entry.quality,
        requestIndex: entry.index,
        preference,
      })),
  );
  matches.sort(
    (left, right) =>
      right.quality - left.quality ||
      left.requestIndex - right.requestIndex ||
      left.preference - right.preference,
  );
  return matches[0]?.candidate;
}

export function getServerBaseUrl(req: NextApiRequest): string {
  const configuredUrl = process.env.UPDATES_SERVER_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }
  const forwardedProtocol = getRequestHeader(req, 'x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol?.length ? forwardedProtocol : 'http';
  const host = getRequestHeader(req, 'x-forwarded-host') ?? getRequestHeader(req, 'host');
  if (!host) {
    throw new ProtocolError('Cannot determine the updates server base URL.', 500);
  }
  return `${protocol}://${host}`;
}

function getAssetContentType(asset: StoredAsset): string {
  if (asset.isLaunchAsset) {
    return 'application/javascript';
  }
  return mime.getType(asset.extension ?? asset.relativePath) ?? 'application/octet-stream';
}

async function createAssetMetadataAsync({
  update,
  platform,
  relativePath,
  baseUrl,
}: {
  update: StoredUpdate;
  platform: Platform;
  relativePath: string;
  baseUrl: string;
}): Promise<ExpoAsset> {
  const storedAsset = getStoredAsset(update, platform, relativePath);
  const contents = await fs.readFile(storedAsset.absolutePath);
  const hash = createHash(contents, 'sha256', 'base64url');
  const key = createHash(contents, 'md5', 'hex');
  const query = new URLSearchParams({
    runtimeVersion: update.runtimeVersion,
    updateId: update.id,
    platform,
    asset: relativePath,
  });
  return {
    hash,
    key,
    contentType: getAssetContentType(storedAsset),
    ...(storedAsset.isLaunchAsset ? {} : { fileExtension: `.${storedAsset.extension ?? ''}` }),
    url: `${baseUrl}/api/assets?${query.toString()}`,
  };
}

export async function createManifestAsync({
  update,
  platform,
  baseUrl,
}: {
  update: StoredUpdate;
  platform: Platform;
  baseUrl: string;
}): Promise<ExpoManifest> {
  if (!update.exportMetadata || !update.expoConfig) {
    throw new ProtocolError(`Update ${update.id} is missing export data.`, 500);
  }
  const platformMetadata = update.exportMetadata.fileMetadata[platform];
  if (!platformMetadata) {
    throw new ProtocolError(`Update ${update.id} does not support ${platform}.`, 404);
  }

  return {
    id: update.id,
    createdAt: update.createdAt,
    runtimeVersion: update.runtimeVersion,
    assets: await Promise.all(
      platformMetadata.assets.map((asset) =>
        createAssetMetadataAsync({
          update,
          platform,
          relativePath: asset.path,
          baseUrl,
        }),
      ),
    ),
    launchAsset: await createAssetMetadataAsync({
      update,
      platform,
      relativePath: platformMetadata.bundle,
      baseUrl,
    }),
    metadata: update.serverMetadata.metadata ?? {},
    extra: {
      expoClient: update.expoConfig,
      ...(update.serverMetadata.extra ?? {}),
    },
  };
}

export function createAssetRequestHeaders(
  manifest: ExpoManifest,
  update: StoredUpdate,
): Record<string, Record<string, string>> {
  const headers = update.serverMetadata.assetRequestHeaders;
  if (!headers || Object.keys(headers).length === 0) {
    return {};
  }
  return Object.fromEntries(
    [...manifest.assets, manifest.launchAsset].map((asset) => [asset.key, headers]),
  );
}

export function createRollBackDirective(update: StoredUpdate) {
  return {
    type: 'rollBackToEmbedded',
    parameters: {
      commitTime: update.createdAt,
    },
  };
}

export function createNoUpdateAvailableDirective() {
  return {
    type: 'noUpdateAvailable',
  };
}

export function getAssetContentTypeForResponse(asset: StoredAsset): string {
  return getAssetContentType(asset);
}
