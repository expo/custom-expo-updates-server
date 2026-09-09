import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import * as zlib from 'node:zlib';

import {
  getAssetContentTypeForResponse,
  getRequestHeader,
  getSingleQueryValue,
  negotiateContentEncoding,
  ProtocolError,
} from '../../common/helpers';
import {
  getStoredAsset,
  getStoredLaunchAssetPatch,
  getUpdateByIdAsync,
  type Platform,
  UpdateStorageError,
} from '../../common/storage';

const FULL_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const PATCH_CACHE_CONTROL = 'private, max-age=31536000, immutable';
const ASSET_VARY = 'Accept-Encoding, A-IM, Expo-Current-Update-ID, Expo-Requested-Update-ID';

function parseRequiredQuery(req: NextApiRequest, name: string): string {
  const value = getSingleQueryValue(req, name);
  if (!value) {
    throw new ProtocolError(`No ${name} was provided.`);
  }
  return value;
}

function parsePlatform(req: NextApiRequest): Platform {
  const platform = parseRequiredQuery(req, 'platform');
  if (platform !== 'ios' && platform !== 'android') {
    throw new ProtocolError('Expected platform to be ios or android.');
  }
  return platform;
}

function isCompressible(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('javascript') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('svg')
  );
}

function compressBody(body: Buffer, encoding: string | undefined): Buffer {
  switch (encoding) {
    case 'zstd': {
      const zstdCompressSync = (
        zlib as typeof zlib & {
          zstdCompressSync?: (buffer: Buffer) => Buffer;
        }
      ).zstdCompressSync;
      return zstdCompressSync ? zstdCompressSync(body) : body;
    }
    case 'br':
      return zlib.brotliCompressSync(body);
    case 'gzip':
      return zlib.gzipSync(body);
    default:
      return body;
  }
}

function sha256Base64Url(body: Buffer): string {
  return crypto.createHash('sha256').update(body).digest('base64url');
}

function acceptsBsdiff(value: string | undefined): boolean {
  return (
    value
      ?.split(',')
      .map((entry) => entry.trim().toLowerCase())
      .includes('bsdiff') ?? false
  );
}

export default async function assetsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      throw new ProtocolError('Expected GET or HEAD.', 405);
    }

    const runtimeVersion = parseRequiredQuery(req, 'runtimeVersion');
    const updateId = parseRequiredQuery(req, 'updateId');
    const platform = parsePlatform(req);
    const assetPath = parseRequiredQuery(req, 'asset');
    const update = await getUpdateByIdAsync(runtimeVersion, updateId);
    const asset = getStoredAsset(update, platform, assetPath);
    const rawBody = await fs.readFile(asset.absolutePath);
    const contentType = getAssetContentTypeForResponse(asset);
    const hash = sha256Base64Url(rawBody);
    const etag = `"sha256-${hash}"`;

    if (asset.isLaunchAsset && acceptsBsdiff(getRequestHeader(req, 'a-im'))) {
      const baseUpdateId = getRequestHeader(req, 'expo-current-update-id')?.toLowerCase();
      const requestedUpdateId = getRequestHeader(req, 'expo-requested-update-id')?.toLowerCase();
      if (
        baseUpdateId &&
        baseUpdateId !== update.id &&
        (!requestedUpdateId || requestedUpdateId === update.id)
      ) {
        let baseUpdate;
        try {
          baseUpdate = await getUpdateByIdAsync(runtimeVersion, baseUpdateId);
        } catch (error) {
          if (!(error instanceof UpdateStorageError) || error.statusCode !== 404) {
            throw error;
          }
        }
        const baseBundle = baseUpdate?.exportMetadata?.fileMetadata[platform]?.bundle;
        if (baseUpdate && baseBundle) {
          const baseAsset = getStoredAsset(baseUpdate, platform, baseBundle);
          const configuredPatch = getStoredLaunchAssetPatch(update, platform, baseUpdateId);
          if (configuredPatch) {
            const baseBody = await fs.readFile(baseAsset.absolutePath);
            const patchBody = await fs.readFile(configuredPatch.absolutePath);
            if (
              configuredPatch.size !== patchBody.length ||
              configuredPatch.patchHash !== sha256Base64Url(patchBody) ||
              configuredPatch.baseAssetHash !== sha256Base64Url(baseBody) ||
              configuredPatch.targetAssetHash !== hash
            ) {
              throw new UpdateStorageError(
                `Launch asset patch metadata is stale for update ${update.id}.`,
                500,
              );
            }
            if (patchBody.length < rawBody.length) {
              const patchEtag = `"sha256-${configuredPatch.patchHash}"`;
              res.setHeader('cache-control', PATCH_CACHE_CONTROL);
              res.setHeader('content-type', 'application/vnd.bsdiff');
              res.setHeader('etag', patchEtag);
              res.setHeader('vary', ASSET_VARY);
              res.setHeader('x-content-type-options', 'nosniff');
              res.setHeader('im', 'bsdiff');
              res.setHeader('expo-base-update-id', baseUpdateId);
              if (getRequestHeader(req, 'if-none-match') === patchEtag) {
                res.status(304).end();
                return;
              }
              res.setHeader('content-length', patchBody.length);
              res.statusCode = 226;
              if (req.method === 'HEAD') {
                res.end();
                return;
              }
              res.end(patchBody);
              return;
            }
          }
        }
      }
    }

    res.setHeader('cache-control', FULL_ASSET_CACHE_CONTROL);
    res.setHeader('content-type', contentType);
    res.setHeader('etag', etag);
    res.setHeader('vary', ASSET_VARY);
    res.setHeader('x-content-type-options', 'nosniff');

    if (getRequestHeader(req, 'if-none-match') === etag) {
      res.status(304).end();
      return;
    }

    const zstdAvailable =
      typeof (
        zlib as typeof zlib & {
          zstdCompressSync?: (buffer: Buffer) => Buffer;
        }
      ).zstdCompressSync === 'function';
    const availableEncodings = [...(zstdAvailable ? ['zstd'] : []), 'br', 'gzip'];
    const encoding =
      rawBody.length >= 1024 && isCompressible(contentType)
        ? negotiateContentEncoding(getRequestHeader(req, 'accept-encoding'), availableEncodings)
        : undefined;
    const body = compressBody(rawBody, encoding);

    if (encoding && body !== rawBody) {
      res.setHeader('content-encoding', encoding);
    }
    res.setHeader('content-length', body.length);
    res.statusCode = 200;

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(body);
  } catch (error) {
    const knownError =
      error instanceof ProtocolError || error instanceof UpdateStorageError ? error : undefined;
    if (!knownError) {
      console.error(error);
    }
    if (!res.headersSent) {
      res.status(knownError?.statusCode ?? 500).json({
        error: knownError?.message ?? 'Internal server error.',
      });
    } else {
      res.end();
    }
  }
}
