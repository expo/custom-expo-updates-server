import FormData from 'form-data';
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  createAssetRequestHeaders,
  createManifestAsync,
  createNoUpdateAvailableDirective,
  createRollBackDirective,
  getRequestHeader,
  getServerBaseUrl,
  getSignatureAsync,
  getSingleQueryValue,
  negotiateResponseContentType,
  parseExpoDictionary,
  ProtocolError,
  serializeExpoDictionary,
  type ExpoManifest,
} from '../../common/helpers';
import {
  getLatestUpdateAsync,
  type Platform,
  type StoredUpdate,
  UpdateStorageError,
} from '../../common/storage';

function setCommonHeaders(res: NextApiResponse, update: StoredUpdate, protocolVersion: number) {
  res.setHeader('expo-protocol-version', protocolVersion);
  res.setHeader('expo-sfv-version', 0);
  res.setHeader('cache-control', 'private, max-age=0');

  const manifestFilters = serializeExpoDictionary(update.serverMetadata.manifestFilters);
  if (manifestFilters) {
    res.setHeader('expo-manifest-filters', manifestFilters);
  }
  const serverDefinedHeaders = serializeExpoDictionary(update.serverMetadata.serverDefinedHeaders);
  if (serverDefinedHeaders) {
    res.setHeader('expo-server-defined-headers', serverDefinedHeaders);
  }
}

function appendJsonPart(
  form: FormData,
  name: 'directive' | 'extensions' | 'manifest',
  value: unknown,
  signature?: string,
) {
  form.append(name, JSON.stringify(value), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });
}

function sendMultipartResponse(
  res: NextApiResponse,
  update: StoredUpdate,
  {
    manifest,
    directive,
    extensions,
    signature,
  }: {
    manifest?: ExpoManifest;
    directive?: unknown;
    extensions?: unknown;
    signature?: string;
  },
) {
  const form = new FormData();
  if (manifest) {
    appendJsonPart(form, 'manifest', manifest, signature);
  }
  if (extensions) {
    appendJsonPart(form, 'extensions', extensions);
  }
  if (directive) {
    appendJsonPart(form, 'directive', directive, signature);
  }
  const body = form.getBuffer();

  setCommonHeaders(res, update, 1);
  res.statusCode = 200;
  res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
  res.setHeader('content-length', body.length);
  res.write(body);
  res.end();
}

function parseProtocolVersion(req: NextApiRequest): 0 | 1 {
  const raw = getRequestHeader(req, 'expo-protocol-version') ?? '0';
  if (raw !== '0' && raw !== '1') {
    throw new ProtocolError('Unsupported protocol version. Expected 0 or 1.');
  }
  return Number(raw) as 0 | 1;
}

function parsePlatform(req: NextApiRequest): Platform {
  const platform = getRequestHeader(req, 'expo-platform') ?? getSingleQueryValue(req, 'platform');
  if (platform !== 'ios' && platform !== 'android') {
    throw new ProtocolError('Unsupported platform. Expected ios or android.');
  }
  return platform;
}

function parseRuntimeVersion(req: NextApiRequest): string {
  const runtimeVersion =
    getRequestHeader(req, 'expo-runtime-version') ?? getSingleQueryValue(req, 'runtime-version');
  if (!runtimeVersion) {
    throw new ProtocolError('No runtime version was provided.');
  }
  return runtimeVersion;
}

async function respondWithDirective(
  req: NextApiRequest,
  res: NextApiResponse,
  update: StoredUpdate,
  directive: unknown,
) {
  negotiateResponseContentType(getRequestHeader(req, 'accept'), ['multipart/mixed']);
  const body = JSON.stringify(directive);
  const signature = await getSignatureAsync(
    body,
    getRequestHeader(req, 'expo-expect-signature') !== undefined,
  );
  sendMultipartResponse(res, update, { directive, signature });
}

export default async function manifestEndpoint(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      throw new ProtocolError('Expected GET.', 405);
    }

    const protocolVersion = parseProtocolVersion(req);
    const platform = parsePlatform(req);
    const runtimeVersion = parseRuntimeVersion(req);
    const channel = getRequestHeader(req, 'expo-channel-name');
    const extraParams = parseExpoDictionary(getRequestHeader(req, 'expo-extra-params'));
    const update = await getLatestUpdateAsync({
      runtimeVersion,
      platform,
      channel,
      extraParams,
    });

    if (update.type === 'rollback') {
      if (protocolVersion === 0) {
        throw new ProtocolError('Rollback directives require protocol version 1.', 406);
      }
      const embeddedUpdateId = getRequestHeader(req, 'expo-embedded-update-id');
      if (!embeddedUpdateId) {
        throw new ProtocolError('Expo-Embedded-Update-ID is required for a rollback response.');
      }
      const currentUpdateId = getRequestHeader(req, 'expo-current-update-id');
      const directive =
        currentUpdateId?.toLowerCase() === embeddedUpdateId.toLowerCase()
          ? createNoUpdateAvailableDirective()
          : createRollBackDirective(update);
      await respondWithDirective(req, res, update, directive);
      return;
    }

    const currentUpdateId = getRequestHeader(req, 'expo-current-update-id');
    if (protocolVersion === 1 && currentUpdateId?.toLowerCase() === update.id) {
      await respondWithDirective(req, res, update, createNoUpdateAvailableDirective());
      return;
    }

    const manifest = await createManifestAsync({
      update,
      platform,
      baseUrl: getServerBaseUrl(req),
    });
    const manifestBody = JSON.stringify(manifest);
    const signature = await getSignatureAsync(
      manifestBody,
      getRequestHeader(req, 'expo-expect-signature') !== undefined,
    );

    if (protocolVersion === 0) {
      setCommonHeaders(res, update, 0);
      if (signature) {
        res.setHeader('expo-signature', signature);
      }
      res.status(200).json(manifest);
      return;
    }

    const responseContentType = negotiateResponseContentType(getRequestHeader(req, 'accept'), [
      'multipart/mixed',
      'application/expo+json',
      'application/json',
    ]);
    if (responseContentType === 'multipart/mixed') {
      const assetRequestHeaders = createAssetRequestHeaders(manifest, update);
      sendMultipartResponse(res, update, {
        manifest,
        signature,
        ...(Object.keys(assetRequestHeaders).length > 0
          ? { extensions: { assetRequestHeaders } }
          : {}),
      });
      return;
    }

    setCommonHeaders(res, update, 1);
    if (signature) {
      res.setHeader('expo-signature', signature);
    }
    res.statusCode = 200;
    res.setHeader('content-type', `${responseContentType}; charset=utf-8`);
    res.send(manifestBody);
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
