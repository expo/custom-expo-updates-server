# API surface and protocol coverage

This document describes both sides of the local setup:

- the HTTP contract implemented by `expo-updates-server`
- the Expo SDK 57 JavaScript surface exercised by `expo-updates-client`

## HTTP endpoints

### `GET /api/manifest`

Selects the newest matching update or rollback and returns an Expo Updates
manifest or directive.

#### Request inputs

| Input | Required | Behavior |
| --- | --- | --- |
| `Expo-Protocol-Version` | No | Supports `1`; omitted or `0` uses protocol 0 compatibility |
| `Expo-Platform` | Yes for normal clients | Must be `ios` or `android`; protocol 0 may use `?platform=` |
| `Expo-Runtime-Version` | Yes for normal clients | Selects `updates/<runtimeVersion>`; protocol 0 may use `?runtime-version=` |
| `Expo-Channel-Name` | No | Matches `server.json.channel` |
| `Expo-Extra-Params` | No | Expo structured-field dictionary matched against `server.json.extraParams` |
| `Expo-Current-Update-ID` | No | Produces `noUpdateAvailable` when it equals the selected update |
| `Expo-Embedded-Update-ID` | Rollback only | Required before serving `rollBackToEmbedded` |
| `Expo-Expect-Signature` | No | Requests an RSA SHA-256 signature |
| `Accept` | No | Negotiates multipart, `application/expo+json`, or `application/json` |

Repeated single-value headers/query values, invalid structured fields,
unsupported protocols/platforms, and missing required values receive a `4xx`
JSON error.

#### Update selection

For runtimes represented in `updates/catalog.json`, the server:

1. reads the runtime's catalog records;
2. ignores disabled records and incomplete `.tmp` directories;
3. matches platform and channel;
4. requires every declared `extraParams` value to match the request;
5. orders eligible records newest first by `createdAt`; and
6. serves the latest update or rollback.

This provides deterministic runtime, channel, and cohort selection. It does not
implement percentages, actor bucketing, staged rollout state, or database
transactions.

#### Protocol 1 response forms

`Accept` quality values and wildcards are honored.

| Content type | Contents |
| --- | --- |
| `multipart/mixed` | `manifest`, optional `extensions`, or `directive` parts |
| `application/expo+json` | A manifest JSON document |
| `application/json` | A manifest JSON document |

Directives require multipart protocol 1 responses.

Supported directives:

- `noUpdateAvailable`
- `rollBackToEmbedded` with `parameters.commitTime`

Multipart extensions currently support:

- `assetRequestHeaders`, keyed by each manifest asset key

#### Manifest fields

| Field | Source |
| --- | --- |
| `id` | `server.json.id`, or a stable hash-derived UUID fallback |
| `createdAt` | `server.json.createdAt`, or update file modification time |
| `runtimeVersion` | selected runtime directory |
| `launchAsset` | platform bundle from Expo export metadata |
| `assets` | platform assets from Expo export metadata |
| `metadata` | `server.json.metadata` |
| `extra.expoClient` | exported public Expo config |
| `extra.*` | `server.json.extra` |

Each asset includes:

- SHA-256 `hash` encoded as base64url
- content-derived MD5 `key`
- MIME `contentType`
- `fileExtension` for non-launch assets
- immutable URL containing runtime version, update ID, platform, and asset path

#### Common response headers

| Header | Behavior |
| --- | --- |
| `Expo-Protocol-Version` | `0` or `1` |
| `Expo-SFV-Version` | `0` |
| `Expo-Manifest-Filters` | Serialized from `server.json.manifestFilters` |
| `Expo-Server-Defined-Headers` | Serialized from `server.json.serverDefinedHeaders` |
| `Expo-Signature` | Manifest/directive signature when requested; part header for multipart |
| `Cache-Control` | `private, max-age=0` |

Signature dictionaries contain `sig`, `keyid`, and
`alg="rsa-v1_5-sha256"`. A signature request fails if
`PRIVATE_KEY_PATH` is not configured.

#### Protocol 0 compatibility

Protocol 0 returns a plain JSON manifest and supports the legacy
`platform`/`runtime-version` query parameters. Protocol 0 does not support
rollback directives.

### `GET|HEAD /api/assets`

Serves an asset only when it belongs to the exact runtime, update, and platform
declared by the request.

Required query parameters:

| Parameter | Meaning |
| --- | --- |
| `runtimeVersion` | Runtime storage directory |
| `updateId` | Exact normal update UUID |
| `platform` | `ios` or `android` |
| `asset` | Exact path listed in that update's Expo export metadata |

Response behavior:

- `GET` and `HEAD`
- SHA-256 ETag and `If-None-Match`/`304`
- `Cache-Control: public, max-age=31536000, immutable`
- `Content-Type`, `Content-Length`, and `X-Content-Type-Options: nosniff`
- `Vary: Accept-Encoding, A-IM, Expo-Current-Update-ID, Expo-Requested-Update-ID`
- Zstandard when the running Node version exposes it, then Brotli or gzip
- no compression for small or non-compressible files
- path normalization, traversal rejection, and update membership checks

SDK 57 launch-asset requests can include:

- `A-IM: bsdiff`
- `Expo-Current-Update-ID`
- `Expo-Requested-Update-ID`
- `Accept-Encoding: zstd, br, gzip`

When the requested asset is a launch bundle and a smaller precomputed patch
exists from the current update, the server validates the patch size and the
SHA-256 hashes of the patch, base bundle, and target bundle. It then returns:

- status `226 IM Used`
- `Content-Type: application/vnd.bsdiff`
- `IM: bsdiff`
- `Expo-Base-Update-ID`
- a patch-specific ETag
- `Cache-Control: private, max-age=31536000, immutable`
- no content encoding

The server returns the normal full asset with status `200` when the base is
unknown, the requested update does not match the URL update, no patch exists,
or the patch is not smaller than the target. Stale or corrupt configured patch
metadata is a server error instead of an unsafe fallback.

### `GET /api/artifacts`

When `EXPO_UPDATES_ARTIFACT_VIEW_ENABLED=true`, returns the local catalog,
ordered update/rollback operations, launch-bundle sizes, generated patch sizes,
and code-signing availability. `/artifacts` renders the same report as a
minimal browser view. Both routes are disabled by default.

## Server metadata/store API

`updates/catalog.json` records support:

| Property | Type | Purpose |
| --- | --- | --- |
| `kind` | `update` or `rollback` | Response state represented by the record |
| `state` | `active` or `disabled` | Selection eligibility |
| `directory` | string | `<runtimeVersion>/<record>` storage path |
| `id` | UUID | Required normal-update identifier |
| `groupId` | UUID | Connects platform updates published together |
| `createdAt` | ISO date | Deterministic ordering and rollback commit time |
| `runtimeVersion` | string | Exact runtime/fingerprint match |
| `platform` | `android` or `ios` | Optional platform restriction |
| `channel` | string | Direct channel selector |

`updates/<runtime>/<record>/server.json` supports:

| Property | Type | Purpose |
| --- | --- | --- |
| `id` | string | Explicit update UUID |
| `createdAt` | ISO date string | Selection ordering and manifest commit time |
| `runtimeVersion` | string | Informational copy of the runtime |
| `channel` | string | Channel selector |
| `metadata` | object of strings | Manifest metadata |
| `manifestFilters` | object of strings | `Expo-Manifest-Filters` |
| `serverDefinedHeaders` | object of strings | `Expo-Server-Defined-Headers` |
| `assetRequestHeaders` | object of strings | Multipart `assetRequestHeaders` extension |
| `launchAssetPatches` | platform/base-update map | Validated precomputed BSDIFF40 launch-bundle patches |
| `extraParams` | object of strings | Required client cohort/selector values |
| `extra` | JSON object | Additional manifest `extra` values |

A normal update contains `metadata.json`, `expoConfig.json`, bundles, and
assets. A rollback record contains a `rollback` marker.

## Expo SDK 57 JavaScript API

The diagnostic client renders values and controls for the supported public
runtime APIs. These calls require a release build; Expo Go and ordinary
development mode reject update lifecycle methods.

### Constants

| Export | Type | Meaning |
| --- | --- | --- |
| `isEnabled` | boolean | Whether native updates initialization succeeded and updates are configured |
| `updateId` | string or null | Lowercase UUID of the running update |
| `channel` | string or null | Build channel, when configured |
| `runtimeVersion` | string or null | Native runtime compatibility version |
| `checkAutomatically` | enum or null | Startup update-check policy |
| `isEmergencyLaunch` | boolean | Whether error recovery fell back to embedded code |
| `emergencyLaunchReason` | string or null | Emergency-launch reason |
| `launchDuration` | number | Native launch duration in milliseconds |
| `isEmbeddedLaunch` | boolean | Whether the running code is embedded |
| `manifest` | partial manifest | Running update manifest |
| `createdAt` | Date or null | Running update creation time |

Hidden constants exported by the package include `localAssets` and
`isUsingEmbeddedAssets`.

### Functions

| Export | Result | Purpose |
| --- | --- | --- |
| `checkForUpdateAsync()` | `UpdateCheckResult` | Checks without downloading |
| `fetchUpdateAsync()` | `UpdateFetchResult` | Downloads an update or prepares rollback |
| `reloadAsync(options?)` | `Promise<void>` | Restarts into the newest downloaded update |
| `getExtraParamsAsync()` | string map | Reads persisted request selectors |
| `setExtraParamAsync(key, value)` | `Promise<void>` | Adds/removes an `Expo-Extra-Params` value |
| `readLogEntriesAsync(maxAge?)` | log array | Reads recent native update logs |
| `clearLogEntriesAsync()` | `Promise<void>` | Requests log clearing |
| `setUpdateURLAndRequestHeadersOverride(config)` | void | Experimental runtime URL/header override |
| `setUpdateRequestHeadersOverride(headers)` | void | Experimental runtime header override |

The URL override requires `disableAntiBrickingMeasures: true`. This local
diagnostic app enables it so the API can be exercised.

Hidden testing exports present in SDK 57:

- `showReloadScreen(options?)`
- `hideReloadScreen()`
- `addUpdatesStateChangeListener(listener)`
- `emitTestStateChangeEvent(event)`
- `resetLatestContext()`

### `useUpdates()`

The hook returns:

| Field | Meaning |
| --- | --- |
| `currentlyRunning` | Running update ID, channel, runtime, manifest, date, launch flags, and duration |
| `isStartupProcedureRunning` | Native startup procedure has not completed |
| `availableUpdate` | New update or rollback discovered by a check |
| `downloadedUpdate` | New update or rollback ready to launch |
| `isUpdateAvailable` | A launchable update/rollback was found |
| `isUpdatePending` | The available result has downloaded and is ready |
| `isChecking` | An update check is active |
| `isDownloading` | An update download is active |
| `isRestarting` | A reload is active |
| `restartCount` | JavaScript restarts since cold start |
| `checkError` | Most recent check/startup-check error |
| `downloadError` | Most recent download/startup-download error |
| `lastCheckForUpdateTimeSinceRestart` | Last check time in this JS lifetime |
| `downloadProgress` | Download progress from `0` to `1` |

### Result unions

`UpdateCheckResult` distinguishes:

- an available normal update;
- a rollback to the embedded update; and
- no available update, with a reason such as no server update, selection-policy
  rejection, previous failure, rejected rollback, or missing embedded update.

`UpdateFetchResult` distinguishes:

- a newly fetched normal update;
- no newly fetched update; and
- a prepared rollback to embedded.

`UpdateInfoType` contains `NEW` and `ROLLBACK`.

Log entries contain `timestamp`, `message`, `code`, `level`, and optional
update ID, asset ID, and native stack trace. Levels range from `trace` through
`fatal`; codes distinguish network, signature, code-signing, asset, launch,
JavaScript runtime, and initialization failures.

## Coverage boundary

The local implementation covers the client/server protocol path needed by the
SDK 57 app, including signing and rollback behavior. The following are outside
this repository:

- user/project authentication and authorization
- update upload APIs
- database/object-store adapters
- staged rollout percentages and device bucketing
- dashboard/administration APIs
- metrics, tracing, audit history, retention, and garbage collection
- horizontal concurrency controls

Those are deployment/product concerns rather than fields required for a client
to consume a custom Expo Updates protocol server.
