import http from 'node:http';
import https from 'node:https';

import { config } from './config.mjs';

export function request(url, { method = 'GET', headers = {}, body } = {}) {
  const target = url instanceof URL ? url : new URL(url);
  const transport = target.protocol === 'https:' ? https : http;
  const finalHeaders = {
    ...config.commonHeaders,
    ...Object.fromEntries(
      Object.entries(headers).filter(([, value]) => value !== null && value !== undefined),
    ),
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method,
        headers: finalHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            rawHeaders: res.rawHeaders,
            body: Buffer.concat(chunks),
            text() {
              return this.body.toString('utf8');
            },
            json() {
              return JSON.parse(this.text());
            },
          });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}
