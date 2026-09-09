# Custom Expo Updates Server — Expo SDK 57

This fork turns Expo's custom updates server example into a complete local
development setup for Expo SDK 57.

It includes:

- Expo `57.0.21`, `expo-updates` `57.0.21`, React Native `0.86.3`, and React
  `19.2.3`
- Expo Updates protocol 1 responses and protocol 0 compatibility
- signed manifests and directives
- update, no-update, and rollback responses
- immutable, update-scoped assets with caching and compression
- a file-backed channel/build catalog with active and disabled records
- exact fingerprint, platform, channel, and extra-parameter update selection
- a release client that exercises the public `expo-updates` JavaScript API
- local publishing, signing-key generation, tests, linting, type checking, and
  production builds

This remains an example server intended for local development and as a
reference implementation. Before using it as a public production service, add
the authentication, authorization, durable storage, observability, rate
limiting, rollout controls, and operational safeguards required by your
environment.

## Requirements

- Node.js 20.9 or newer
- npm 10
- Xcode and CocoaPods for iOS builds
- Android Studio and an Android SDK for Android builds

## Quick start

Install dependencies and generate local code-signing material:

```sh
npm install
npm run setup
```

Export the SDK 57 app and publish it to the local update store:

```sh
npm run publish:update
```

Start the server:

```sh
npm run dev
```

The status page is available at `http://localhost:3000`. The update endpoint is
`http://localhost:3000/api/manifest`.

In another terminal, build a release client:

```sh
# iOS simulator
npm run client:ios

# Android emulator
npm run client:android
```

`expo-updates` update checks are disabled in ordinary development mode, so use
these release builds when testing `checkForUpdateAsync`, `fetchUpdateAsync`, or
`reloadAsync`.

The Android emulator uses `http://10.0.2.2:3000/api/manifest`; the iOS simulator
uses `http://localhost:3000/api/manifest`.

For a physical device, use the development machine's reachable LAN address
when building the client:

```sh
EXPO_UPDATES_URL=http://192.168.1.20:3000/api/manifest npm run client:ios
```

Replace the example IP with the host's actual address. By default, the server
builds asset URLs from the manifest request's host, so the same setup works for
iOS, Android emulators, and LAN devices. Set `UPDATES_SERVER_URL` only when a
reverse proxy or public deployment needs to advertise a different canonical
origin.

## Publish and test an update

1. Build and launch a release client.
2. Change `expo-updates-client/App.js`.
3. Publish a new update:

   ```sh
   npm run publish:update
   ```

4. Use the client's **Check**, **Fetch**, and **Reload** actions, or cold-start
   the app.

Updates are written under
`expo-updates-server/updates/<runtimeVersion>/<timestamp>-<platform>`.
Publishing resolves Android and iOS runtime versions separately, stages each
export, and then atomically appends both records to `updates/catalog.json`.

The default runtime is `57` and the default channel is `main`. Override them
when publishing:

```sh
npm run publish:update -- --runtime-version 57 --channel preview
```

Use Expo's fingerprint runtime policy with:

```sh
EXPO_RUNTIME_VERSION_POLICY=fingerprint npm run publish:update
```

Android and iOS may resolve to different fingerprints. They retain a shared
update-group ID while being stored under their exact platform runtime.

Build a client for a different channel with:

```sh
EXPO_UPDATES_CHANNEL=preview npm run client:ios
```

## Publish a rollback

```sh
npm run publish:rollback
```

The latest matching record becomes a `rollBackToEmbedded` directive. If the
client already runs its embedded update, the server returns
`noUpdateAvailable`. Publish a newer normal update to resume serving updates.

## Configuration

`npm run setup` creates ignored local signing files:

- `expo-updates-server/.local/code-signing/private-key.pem`
- `expo-updates-server/.local/code-signing/public-key.pem`
- `expo-updates-client/.local/code-signing/certificate.pem`

It also creates `expo-updates-server/.env.local` from the local defaults. No
private key is tracked by Git.

Server variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `UPDATES_SERVER_URL` | Public base URL written into asset URLs | Request host |
| `PRIVATE_KEY_PATH` | RSA private key used when a client requests signing | Signing disabled |
| `CODE_SIGNING_KEY_ID` | `keyid` in the `expo-signature` dictionary | `main` |
| `UPDATES_DIRECTORY` | Update storage root | `expo-updates-server/updates` |

Client build variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_UPDATES_URL` | Manifest endpoint embedded in the native app | `http://localhost:3000/api/manifest` |
| `EXPO_UPDATES_CHANNEL` | `expo-channel-name` request header | `main` |
| `EXPO_RUNTIME_VERSION` | Explicit shared runtime version | `57` |
| `EXPO_RUNTIME_VERSION_POLICY` | `appVersion`, `nativeVersion`, `sdkVersion`, or `fingerprint` | unset |
| `EXPO_IOS_RUNTIME_VERSION` / `EXPO_ANDROID_RUNTIME_VERSION` | Platform runtime override | unset |
| `EXPO_UPDATES_ENABLED` | Enable native updates | `true` |
| `EXPO_UPDATES_CHECK_AUTOMATICALLY` | Startup policy | `ON_LOAD` |
| `EXPO_UPDATES_FALLBACK_TO_CACHE_TIMEOUT` | Startup wait in milliseconds | `0` |
| `EXPO_UPDATES_USE_EMBEDDED_UPDATE` | Permit the embedded update | `true` |
| `EXPO_UPDATES_ENABLE_BSDIFF_PATCH_SUPPORT` | Advertise/apply bundle patches | `true` |
| `EXPO_UPDATES_ASSET_PATTERNS_TO_BE_BUNDLED` | JSON array of update asset globs | `["**/*"]` |
| `EXPO_UPDATES_REQUEST_HEADERS` | JSON object merged into request headers | `{}` |
| `EXPO_UPDATES_CODE_SIGNING` | Include the local verification certificate | `true` |
| `EXPO_UPDATES_DISABLE_ANTI_BRICKING_MEASURES` | Permit runtime overrides | `true` for diagnostics |

The diagnostic client sets `disableAntiBrickingMeasures: true` so it can
exercise Expo's experimental runtime URL/header override functions. Do not copy
that setting into a production app unless those overrides are explicitly
required and secured.

## Build catalog and update metadata

`expo-updates-server/updates/catalog.json` is the authoritative build list for
every runtime it contains. Records are filtered by exact runtime/fingerprint,
platform, channel, state, and extra parameters, then ordered by `createdAt`.
The latest eligible record can be a normal update or rollback.

Catalog writes use an exclusive lock and atomic rename. Disabled records stay
in history but are never selected.

Each update can contain a `server.json` file:

```json
{
  "id": "7702c2db-236f-6f55-3667-0d0ff78c7094",
  "createdAt": "2026-09-09T07:35:39.602Z",
  "runtimeVersion": "57",
  "channel": "main",
  "metadata": {
    "channel": "main"
  },
  "manifestFilters": {
    "channel": "main"
  },
  "serverDefinedHeaders": {
    "expo-channel-name": "main"
  },
  "assetRequestHeaders": {
    "x-expo-update-id": "7702c2db-236f-6f55-3667-0d0ff78c7094"
  },
  "extraParams": {
    "cohort": "local"
  },
  "extra": {
    "releaseNotes": "Optional manifest extra data"
  }
}
```

`channel` must match `Expo-Channel-Name`. Every entry in `extraParams` must
match the client's `Expo-Extra-Params` structured-field dictionary. Omitted
selectors match any request.

## Validation

```sh
npm run client:doctor
npm run lint
npm run typecheck
npm run test:client-config
npm run test:unit
npm run test:api
npm run build
```

`npm test` runs the client configuration/fingerprint checks, unit tests, and
black-box API suite. The API suite can target another backend and API path:

```sh
EXPO_UPDATES_CONFORMANCE_BASE_URL=http://localhost:8080 \
EXPO_UPDATES_CONFORMANCE_MANIFEST_PATH=/v1/expo-updates/manifest \
npm run test:api:remote
```

The test suite covers manifest negotiation, signatures, protocol 0
compatibility, channel state, fingerprint near-misses, disabled records,
channel-isolated rollbacks, directives, immutable assets, conditional requests,
`HEAD`, compression, patch negotiation fallback, and path confinement.

## Protocol support

See [docs/api-surface.md](docs/api-surface.md) for the request/response
contract, client JavaScript API, and implementation coverage.

See [docs/sdk-54-to-57.md](docs/sdk-54-to-57.md) for the SDK 54 to SDK 57
migration and behavior changes.

See [docs/self-hosted-state-model.md](docs/self-hosted-state-model.md) for the
channel/build catalog, rollback state, publication consistency, and future
database mapping.

See
[expo-updates-conformance/README.md](expo-updates-conformance/README.md) for
running the same HTTP contract against another backend.

The SDK 57 client may request bundle patches with `A-IM: bsdiff`. This server
currently returns the complete immutable asset with status `200`, which is the
supported fallback. It does not generate `226 IM Used` binary patches.
