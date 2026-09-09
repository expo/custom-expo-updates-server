import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as zlib from "node:zlib";
import bsdiff from "bsdiff-node";

import { config } from "../src/config.mjs";
import { request } from "../src/http.mjs";
import {
  manifestHeaders,
  multipartPart,
  requestManifest,
  verifySignature,
} from "../src/protocol.mjs";

async function jsonManifest({
  platform = "ios",
  runtime = config.fixtures.runtime,
  headers = {},
} = {}) {
  const response = await requestManifest({
    headers: {
      Accept: "application/expo+json",
      "Expo-Platform": platform,
      "Expo-Runtime-Version": runtime,
      ...headers,
    },
  });
  assert.equal(response.status, 200);
  return { response, manifest: response.json() };
}

test("MANIFEST-001 returns a protocol 1 Expo manifest", async () => {
  const { response, manifest } = await jsonManifest();

  assert.match(response.headers["content-type"], /^application\/expo\+json/);
  assert.equal(response.headers["expo-protocol-version"], "1");
  assert.equal(response.headers["expo-sfv-version"], "0");
  assert.equal(manifest.id, config.fixtures.updateId);
  assert.equal(manifest.runtimeVersion, config.fixtures.runtime);
  assert.match(manifest.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof manifest.launchAsset.key, "string");
  assert.equal(typeof manifest.launchAsset.hash, "string");
  assert.equal(typeof manifest.launchAsset.url, "string");
  assert.ok(Array.isArray(manifest.assets));
});

test("MANIFEST-002 supports application/json", async () => {
  const response = await requestManifest({
    headers: { Accept: "application/json" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /^application\/json/);
  assert.equal(response.json().id, config.fixtures.updateId);
});

test("MANIFEST-003 supports multipart manifests and extensions", async () => {
  const response = await requestManifest({
    headers: { Accept: "multipart/mixed" },
  });
  assert.equal(response.status, 200);

  const manifestPart = await multipartPart(response, "manifest");
  const manifest = JSON.parse(manifestPart.body);
  assert.equal(manifest.id, config.fixtures.updateId);

  const extensionsPart = await multipartPart(response, "extensions");
  const extensions = JSON.parse(extensionsPart.body);
  assert.deepEqual(extensions.assetRequestHeaders[manifest.launchAsset.key], {
    "x-expo-update-id": config.fixtures.updateId,
  });
});

test("MANIFEST-004 honors Accept quality values and wildcards", async (t) => {
  await t.test("quality values", async () => {
    const response = await requestManifest({
      headers: {
        Accept: "multipart/mixed;q=0.1, application/json;q=0.9",
      },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /^application\/json/);
  });

  await t.test("wildcard", async () => {
    const response = await requestManifest({ headers: { Accept: "*/*" } });
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /^multipart\/mixed/);
  });
});

test("MANIFEST-005 rejects unsupported representations", async () => {
  const response = await requestManifest({ headers: { Accept: "text/plain" } });
  assert.equal(response.status, 406);
  assert.match(response.json().error, /content type/i);
});

test("MANIFEST-006 validates method, protocol, platform, and runtime", async (t) => {
  const cases = [
    [
      "method",
      {
        method: "POST",
      },
      405,
    ],
    [
      "protocol",
      {
        headers: { "Expo-Protocol-Version": "2" },
      },
      400,
    ],
    [
      "platform",
      {
        headers: { "Expo-Platform": "web" },
      },
      400,
    ],
    [
      "platform case",
      {
        headers: { "Expo-Platform": "IOS" },
      },
      400,
    ],
    [
      "missing platform",
      {
        headers: { "Expo-Platform": null },
      },
      400,
    ],
    [
      "missing runtime",
      {
        headers: { "Expo-Runtime-Version": null },
      },
      400,
    ],
    [
      "unknown runtime",
      {
        headers: { "Expo-Runtime-Version": "unknown-runtime" },
      },
      404,
    ],
  ];

  for (const [name, options, expectedStatus] of cases) {
    await t.test(name, async () => {
      const response = await requestManifest(options);
      assert.equal(response.status, expectedStatus);
      assert.equal(typeof response.json().error, "string");
    });
  }
});

test("MANIFEST-007 reads the channel build list and selects the latest active match", async (t) => {
  await t.test("latest main build", async () => {
    const response = await requestManifest();
    assert.equal(response.status, 200);
    assert.equal(response.json().id, config.fixtures.updateId);
  });

  await t.test("older current update still receives latest build", async () => {
    const response = await requestManifest({
      headers: { "Expo-Current-Update-ID": config.fixtures.oldUpdateId },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json().id, config.fixtures.updateId);
  });

  await t.test("newer disabled build is ignored", async () => {
    const response = await requestManifest({
      headers: { "Expo-Current-Update-ID": config.fixtures.disabledUpdateId },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json().id, config.fixtures.updateId);
  });

  await t.test("preview channel has an independent latest build", async () => {
    const response = await requestManifest({
      headers: { "Expo-Channel-Name": config.fixtures.previewChannel },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json().id, config.fixtures.previewUpdateId);
  });

  await t.test("unknown channel", async () => {
    const response = await requestManifest({
      headers: { "Expo-Channel-Name": config.fixtures.unmatchedChannel },
    });
    assert.equal(response.status, 404);
  });
});

test("MANIFEST-008 matches fingerprint runtime versions exactly", async (t) => {
  assert.match(config.fixtures.fingerprintRuntime, /^[a-f0-9]{32,128}$/);

  await t.test("exact fingerprint", async () => {
    const { manifest } = await jsonManifest({
      runtime: config.fixtures.fingerprintRuntime,
    });
    assert.equal(manifest.id, config.fixtures.fingerprintUpdateId);
    assert.equal(manifest.runtimeVersion, config.fixtures.fingerprintRuntime);
  });

  await t.test("one-character mismatch", async () => {
    const finalCharacter = config.fixtures.fingerprintRuntime.endsWith("0")
      ? "1"
      : "0";
    const nearMatch =
      config.fixtures.fingerprintRuntime.slice(0, -1) + finalCharacter;
    const response = await requestManifest({
      headers: { "Expo-Runtime-Version": nearMatch },
    });
    assert.equal(response.status, 404);
  });

  await t.test("case mismatch", async () => {
    const response = await requestManifest({
      headers: {
        "Expo-Runtime-Version":
          config.fixtures.fingerprintRuntime.toUpperCase(),
      },
    });
    assert.equal(response.status, 404);
  });
});

test("MANIFEST-009 supports Expo-Extra-Params targeting", async (t) => {
  const runtimeHeaders = {
    "Expo-Runtime-Version": config.fixtures.cohortRuntime,
  };

  await t.test("matching cohort", async () => {
    const response = await requestManifest({
      headers: {
        ...runtimeHeaders,
        "Expo-Extra-Params": `${config.fixtures.cohortKey}="${config.fixtures.cohortValue}"`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json().id, config.fixtures.cohortUpdateId);
  });

  await t.test("missing cohort", async () => {
    const response = await requestManifest({ headers: runtimeHeaders });
    assert.equal(response.status, 404);
  });

  await t.test("wrong cohort", async () => {
    const response = await requestManifest({
      headers: {
        ...runtimeHeaders,
        "Expo-Extra-Params": `${config.fixtures.cohortKey}="wrong"`,
      },
    });
    assert.equal(response.status, 404);
  });

  await t.test("malformed structured field", async () => {
    const response = await requestManifest({
      headers: {
        ...runtimeHeaders,
        "Expo-Extra-Params": `${config.fixtures.cohortKey}=(`,
      },
    });
    assert.equal(response.status, 400);
  });
});

test("MANIFEST-010 emits manifest filters and server-defined headers", async () => {
  const response = await requestManifest();
  assert.match(response.headers["expo-manifest-filters"], /channel/);
  assert.match(
    response.headers["expo-server-defined-headers"],
    /expo-channel-name/,
  );
});

test(
  "MANIFEST-011 signs manifest bodies when requested",
  { skip: !config.expectSigning },
  async () => {
    assert.ok(config.certificatePath);
    assert.ok(fs.existsSync(config.certificatePath));

    const response = await requestManifest({
      headers: {
        Accept: "application/expo+json",
        "Expo-Expect-Signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(
      verifySignature({
        body: response.text(),
        signature: response.headers["expo-signature"],
        certificatePath: config.certificatePath,
      }),
      true,
    );
  },
);

test("DIRECTIVE-001 returns noUpdateAvailable for the current update", async () => {
  const response = await requestManifest({
    headers: {
      Accept: "multipart/mixed",
      "Expo-Current-Update-ID": config.fixtures.updateId.toUpperCase(),
    },
  });
  assert.equal(response.status, 200);
  const part = await multipartPart(response, "directive");
  assert.deepEqual(JSON.parse(part.body), { type: "noUpdateAvailable" });
});

test("DIRECTIVE-002 requires multipart support for directives", async () => {
  const response = await requestManifest({
    headers: {
      Accept: "application/json",
      "Expo-Current-Update-ID": config.fixtures.updateId,
    },
  });
  assert.equal(response.status, 406);
});

test("DIRECTIVE-003 returns rollBackToEmbedded", async () => {
  const response = await requestManifest({
    headers: {
      Accept: "multipart/mixed",
      "Expo-Embedded-Update-ID": config.fixtures.embeddedUpdateId,
      "Expo-Runtime-Version": config.fixtures.rollbackRuntime,
    },
  });
  assert.equal(response.status, 200);
  const part = await multipartPart(response, "directive");
  assert.deepEqual(JSON.parse(part.body), {
    type: "rollBackToEmbedded",
    parameters: { commitTime: "2022-10-20T21:00:00.000Z" },
  });
});

test(
  "DIRECTIVE-005 signs directive parts when requested",
  { skip: !config.expectSigning },
  async () => {
    assert.ok(config.certificatePath);
    const response = await requestManifest({
      headers: {
        Accept: "multipart/mixed",
        "Expo-Current-Update-ID": config.fixtures.updateId,
        "Expo-Expect-Signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"',
      },
    });
    assert.equal(response.status, 200);
    const part = await multipartPart(response, "directive");
    assert.equal(
      verifySignature({
        body: part.body,
        signature: part.headers.get("expo-signature"),
        certificatePath: config.certificatePath,
      }),
      true,
    );
  },
);

test("DIRECTIVE-004 handles rollback edge cases", async (t) => {
  await t.test("embedded update ID is required", async () => {
    const response = await requestManifest({
      headers: {
        "Expo-Runtime-Version": config.fixtures.rollbackRuntime,
      },
    });
    assert.equal(response.status, 400);
  });

  await t.test("already running embedded update", async () => {
    const response = await requestManifest({
      headers: {
        Accept: "multipart/mixed",
        "Expo-Current-Update-ID": config.fixtures.embeddedUpdateId,
        "Expo-Embedded-Update-ID": config.fixtures.embeddedUpdateId,
        "Expo-Runtime-Version": config.fixtures.rollbackRuntime,
      },
    });
    assert.equal(response.status, 200);
    const part = await multipartPart(response, "directive");
    assert.deepEqual(JSON.parse(part.body), { type: "noUpdateAvailable" });
  });

  await t.test("protocol 0 cannot receive rollback directives", async () => {
    const response = await requestManifest({
      headers: {
        "Expo-Embedded-Update-ID": config.fixtures.embeddedUpdateId,
        "Expo-Protocol-Version": "0",
        "Expo-Runtime-Version": config.fixtures.rollbackRuntime,
      },
    });
    assert.equal(response.status, 406);
  });

  await t.test(
    "another channel on the same runtime continues serving updates",
    async () => {
      const response = await requestManifest({
        headers: {
          Accept: "application/expo+json",
          "Expo-Channel-Name": config.fixtures.previewChannel,
          "Expo-Runtime-Version": config.fixtures.rollbackRuntime,
        },
      });
      assert.equal(response.status, 200);
      assert.equal(response.json().id, config.fixtures.rollbackPreviewUpdateId);
    },
  );
});

test("COMPAT-001 supports protocol 0 query parameters", async () => {
  const response = await requestManifest({
    headers: {
      Accept: "application/json",
      "Expo-Platform": null,
      "Expo-Protocol-Version": "0",
      "Expo-Runtime-Version": null,
    },
    query: {
      platform: "ios",
      "runtime-version": config.fixtures.runtime,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["expo-protocol-version"], "0");
  assert.equal(response.json().id, config.fixtures.updateId);
});

test("ASSET-001 serves immutable update-scoped assets", async () => {
  const { manifest } = await jsonManifest();
  const response = await request(manifest.assets[0].url);

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(
    response.headers["cache-control"],
    "public, max-age=31536000, immutable",
  );
  assert.match(response.headers.etag, /^"sha256-/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(
    Number(response.headers["content-length"]),
    response.body.length,
  );
  assert.ok(response.body.length > 0);
});

test("ASSET-002 supports HEAD and conditional requests", async (t) => {
  const { manifest } = await jsonManifest();
  const url = manifest.assets[0].url;
  const initial = await request(url);

  await t.test("HEAD", async () => {
    const response = await request(url, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.ok(Number(response.headers["content-length"]) > 0);
    assert.equal(response.body.length, 0);
  });

  await t.test("If-None-Match", async () => {
    const response = await request(url, {
      headers: { "If-None-Match": initial.headers.etag },
    });
    assert.equal(response.status, 304);
    assert.equal(response.body.length, 0);
  });
});

test("ASSET-003 negotiates gzip and Brotli compression", async (t) => {
  const { manifest } = await jsonManifest();
  const url = manifest.launchAsset.url;
  const original = await request(url);

  await t.test("gzip", async () => {
    const response = await request(url, {
      headers: { "Accept-Encoding": "gzip" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-encoding"], "gzip");
    assert.deepEqual(zlib.gunzipSync(response.body), original.body);
  });

  await t.test("br", async () => {
    const response = await request(url, {
      headers: { "Accept-Encoding": "br" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-encoding"], "br");
    assert.deepEqual(zlib.brotliDecompressSync(response.body), original.body);
  });

  if (typeof zlib.zstdDecompressSync === "function") {
    await t.test("zstd", async () => {
      const response = await request(url, {
        headers: { "Accept-Encoding": "zstd, br, gzip" },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers["content-encoding"], "zstd");
      assert.deepEqual(zlib.zstdDecompressSync(response.body), original.body);
    });
  }
});

test("ASSET-004 handles bsdiff negotiation", async () => {
  const { manifest } = await jsonManifest();
  const target = await request(manifest.launchAsset.url);
  const response = await request(manifest.launchAsset.url, {
    headers: {
      "A-IM": "bsdiff",
      "Expo-Current-Update-ID": config.fixtures.oldUpdateId,
      "Expo-Requested-Update-ID": config.fixtures.updateId,
    },
  });

  if (config.expectBsdiffPatch) {
    assert.equal(response.status, 226);
  }
  if (response.status === 226) {
    assert.equal(response.headers.im, "bsdiff");
    assert.equal(
      response.headers["expo-base-update-id"],
      config.fixtures.oldUpdateId,
    );
    assert.equal(response.headers["content-type"], "application/vnd.bsdiff");
    assert.equal(response.headers["content-encoding"], undefined);
    assert.match(response.headers.etag, /^"sha256-/);
    assert.match(response.headers.vary, /A-IM/i);
    assert.match(response.headers["cache-control"], /^private,/);
    assert.ok(response.body.length < target.body.length);

    const baseUrl = new URL(manifest.launchAsset.url);
    baseUrl.searchParams.set("updateId", config.fixtures.oldUpdateId);
    baseUrl.searchParams.set("asset", config.fixtures.oldIosLaunchAssetPath);
    const base = await request(baseUrl);
    assert.equal(base.status, 200);
    const tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "expo-bsdiff-test-"),
    );
    try {
      const basePath = path.join(tempDirectory, "base");
      const patchPath = path.join(tempDirectory, "update.bsdiff");
      const resultPath = path.join(tempDirectory, "result");
      fs.writeFileSync(basePath, base.body);
      fs.writeFileSync(patchPath, response.body);
      bsdiff.patchSync(basePath, resultPath, patchPath);
      assert.deepEqual(fs.readFileSync(resultPath), target.body);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }

    const head = await request(manifest.launchAsset.url, {
      method: "HEAD",
      headers: {
        "A-IM": "bsdiff",
        "Expo-Current-Update-ID": config.fixtures.oldUpdateId,
        "Expo-Requested-Update-ID": config.fixtures.updateId,
      },
    });
    assert.equal(head.status, 226);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers["content-length"]), response.body.length);

    const notModified = await request(manifest.launchAsset.url, {
      headers: {
        "A-IM": "bsdiff",
        "Expo-Current-Update-ID": config.fixtures.oldUpdateId,
        "Expo-Requested-Update-ID": config.fixtures.updateId,
        "If-None-Match": response.headers.etag,
      },
    });
    assert.equal(notModified.status, 304);
    assert.equal(notModified.body.length, 0);
  } else {
    assert.equal(response.status, 200);
    assert.equal(response.headers.im, undefined);
  }

  const unknownBase = await request(manifest.launchAsset.url, {
    headers: {
      "A-IM": "bsdiff",
      "Expo-Current-Update-ID": "22222222-2222-4222-8222-222222222222",
      "Expo-Requested-Update-ID": config.fixtures.updateId,
    },
  });
  assert.equal(unknownBase.status, 200);
  assert.equal(unknownBase.headers.im, undefined);

  const wrongTarget = await request(manifest.launchAsset.url, {
    headers: {
      "A-IM": "bsdiff",
      "Expo-Current-Update-ID": config.fixtures.oldUpdateId,
      "Expo-Requested-Update-ID": config.fixtures.previewUpdateId,
    },
  });
  assert.equal(wrongTarget.status, 200);
  assert.equal(wrongTarget.headers.im, undefined);
});

test("ASSET-004B generates and reuses eligible bsdiff patches on demand", async () => {
  const { manifest } = await jsonManifest();
  const target = await request(manifest.launchAsset.url);
  const headers = {
    "A-IM": "bsdiff",
    "Expo-Current-Update-ID": config.fixtures.previewUpdateId,
    "Expo-Requested-Update-ID": config.fixtures.updateId,
  };
  const first = await request(manifest.launchAsset.url, { headers });
  if (!config.expectOnDemandBsdiffPatch) {
    assert.equal(first.status, 200);
    return;
  }

  assert.equal(first.status, 226);
  assert.match(
    first.headers["expo-patch-source"],
    /^on-demand-(generated|cache)$/,
  );
  assert.ok(first.body.length < target.body.length);

  const baseUrl = new URL(manifest.launchAsset.url);
  baseUrl.searchParams.set("updateId", config.fixtures.previewUpdateId);
  baseUrl.searchParams.set(
    "asset",
    config.fixtures.previewIosLaunchAssetPath,
  );
  const base = await request(baseUrl);
  assert.equal(base.status, 200);
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "expo-bsdiff-on-demand-test-"),
  );
  try {
    const basePath = path.join(tempDirectory, "base");
    const patchPath = path.join(tempDirectory, "update.bsdiff");
    const resultPath = path.join(tempDirectory, "result");
    fs.writeFileSync(basePath, base.body);
    fs.writeFileSync(patchPath, first.body);
    bsdiff.patchSync(basePath, resultPath, patchPath);
    assert.deepEqual(fs.readFileSync(resultPath), target.body);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }

  const second = await request(manifest.launchAsset.url, { headers });
  assert.equal(second.status, 226);
  assert.equal(second.headers["expo-patch-source"], "on-demand-cache");
  assert.equal(second.headers.etag, first.headers.etag);
  assert.deepEqual(second.body, first.body);
});

test("ASSET-005 enforces update, platform, and path isolation", async (t) => {
  const { manifest } = await jsonManifest();
  const launchUrl = new URL(manifest.launchAsset.url);

  const cases = [
    [
      "unknown update",
      (url) =>
        url.searchParams.set(
          "updateId",
          "22222222-2222-4222-8222-222222222222",
        ),
      404,
    ],
    [
      "unknown asset",
      (url) => url.searchParams.set("asset", "assets/not-in-the-update"),
      404,
    ],
    [
      "path traversal",
      (url) => url.searchParams.set("asset", "../package.json"),
      400,
    ],
    [
      "unsupported platform",
      (url) => url.searchParams.set("platform", "web"),
      400,
    ],
    [
      "cross-platform asset",
      (url) => url.searchParams.set("platform", "android"),
      404,
    ],
    [
      "missing runtime",
      (url) => url.searchParams.delete("runtimeVersion"),
      400,
    ],
    ["missing update ID", (url) => url.searchParams.delete("updateId"), 400],
    ["missing asset", (url) => url.searchParams.delete("asset"), 400],
    [
      "duplicate runtime",
      (url) =>
        url.searchParams.append("runtimeVersion", config.fixtures.runtime),
      400,
    ],
  ];

  for (const [name, mutate, expectedStatus] of cases) {
    await t.test(name, async () => {
      const url = new URL(launchUrl);
      mutate(url);
      const response = await request(url);
      assert.equal(response.status, expectedStatus);
    });
  }
});

test("ASSET-006 rejects unsupported methods", async () => {
  const { manifest } = await jsonManifest();
  const response = await request(manifest.launchAsset.url, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, "GET, HEAD");
});

test("API-001 allows a configurable API path and authorization headers", () => {
  const headers = manifestHeaders();
  assert.equal(typeof config.baseUrl, "string");
  assert.equal(typeof config.manifestPath, "string");
  assert.equal(headers["Expo-Runtime-Version"], config.fixtures.runtime);
});
