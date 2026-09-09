import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  isMultipartPartWithName,
  parseMultipartMixedResponseAsync,
} from '@expo/multipart-body-parser';
import { parseDictionary } from 'structured-headers';

import { config, manifestUrl } from './config.mjs';
import { request } from './http.mjs';

export function manifestHeaders(overrides = {}) {
  return {
    Accept: 'application/expo+json',
    'Expo-Channel-Name': config.fixtures.channel,
    'Expo-Platform': 'ios',
    'Expo-Protocol-Version': '1',
    'Expo-Runtime-Version': config.fixtures.runtime,
    ...overrides,
  };
}

export function requestManifest({
  headers,
  method,
  query,
  body,
} = {}) {
  return request(manifestUrl(query), {
    method,
    body,
    headers: manifestHeaders(headers),
  });
}

export async function multipartParts(response) {
  const contentType = response.headers['content-type'];
  return await parseMultipartMixedResponseAsync(contentType, response.body);
}

export async function multipartPart(response, name) {
  const parts = await multipartParts(response);
  const part = parts.find((candidate) => isMultipartPartWithName(candidate, name));
  if (!part) {
    throw new Error(`Multipart response has no ${name} part.`);
  }
  return part;
}

export function verifySignature({ body, signature, certificatePath }) {
  const dictionary = parseDictionary(signature);
  const signatureValue = dictionary.get('sig')?.[0];
  if (typeof signatureValue !== 'string') {
    return false;
  }
  const certificate = fs.readFileSync(certificatePath);
  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(body, 'utf8'),
    certificate,
    Buffer.from(signatureValue, 'base64'),
  );
}
