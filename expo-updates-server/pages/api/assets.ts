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
  getUpdateByIdAsync,
  type Platform,
  UpdateStorageError,
} from '../../common/storage';

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
    const hash = crypto.createHash('sha256').update(rawBody).digest('base64url');
    const etag = `"sha256-${hash}"`;

    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.setHeader('content-type', contentType);
    res.setHeader('etag', etag);
    res.setHeader('vary', 'Accept-Encoding');
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
