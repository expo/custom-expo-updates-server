# Expo SDK 54 to SDK 57

The upstream example's latest commit targeted Expo SDK 54:

| Dependency | Upstream example | This branch |
| --- | --- | --- |
| `expo` | `^54.0.0` | `~57.0.21` |
| `expo-updates` | `~29.0.10` | `~57.0.21` |
| React Native | `0.81.4` | `0.86.3` |
| React | `19.1.0` | `19.2.3` |
| `expo-build-properties` | `~1.0.8` | `~57.0.17` |
| `expo-constants` | `~18.0.9` | `~57.0.17` |
| `expo-status-bar` | `~3.0.8` | `~57.0.1` |
| Next.js server | `15.5.3` | `16.3.4` |

The final `expo-updates` package versions on Expo's SDK branches are
`29.0.20` for SDK 54, `55.0.30` for SDK 55, `56.0.26` for SDK 56, and
`57.0.21` for SDK 57. Expo aligned the package's major number with the SDK
starting in SDK 55; the jump from 29 to 55 is not 26 missing public API
generations.

## What changed in the client API

The public JavaScript surface is largely compatible between SDK 54 and SDK 57.
The core constants, `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`,
extra parameters, logs, runtime overrides, and `useUpdates` remain.

The important migration work is native/runtime and protocol behavior rather
than a broad JavaScript rewrite:

- the app must be rebuilt against React Native 0.86 and SDK 57 native modules;
- runtime compatibility was moved from the old example value `1` to `57`;
- generated manifests/assets must reflect the current Expo exporter;
- the asset server must handle SDK 57 compression and patch-negotiation
  headers; and
- selection, signing, directives, and immutable asset identity need to follow
  the current protocol behavior.

## SDK 55

Notable `expo-updates` changes after SDK 54 include:

- patch content-negotiation headers for launch asset requests;
- broader native interface/state-machine context availability;
- React Native 0.82 support;
- removal of the old iOS requirement for an application delegate to inherit
  from Expo's app delegate; and
- startup update download-progress fixes.

For this server, the material effect is that launch-asset requests may express
patch capabilities and the state exposed by `useUpdates()` must remain
consistent during startup/check/download transitions.

## SDK 56

Notable changes include:

- minimum Apple deployment targets moved to iOS/tvOS 16.4 and macOS 13.4;
- typed Expo config-plugin support;
- asset requests include the runtime version;
- `bsdiff` bundle patch downloads are enabled by default;
- Android can decompress Zstandard responses; and
- startup, restart, and brownfield integration received reliability fixes.

The local asset endpoint therefore:

- keeps assets immutable and scoped to a runtime/update/platform;
- sends `Content-Length`, which improves `downloadProgress`;
- negotiates Zstandard when Node supports it, then Brotli and gzip; and
- returns a validated status-`226` BSDIFF40 patch when a known prior launch
  bundle is available and the patch is smaller than the target.

Unknown bases, mismatched requested updates, absent patches, and inefficient
patches use the compatible full-asset fallback.

## SDK 57

SDK 57 is primarily a hardening release for `expo-updates`. Relevant fixes
include:

- more accurate `isUpdatePending` state;
- rejection of path separators in asset keys/file extensions;
- atomic embedded-update registration;
- recovery when launch assets are missing on iOS or Android;
- more robust persisted-log parsing/retention;
- corrected iOS scale-variant packager hashes; and
- Android ABI filtering and packaging fixes.

The server-side path validation in this branch independently rejects absolute
paths, backslashes, null bytes, normalization changes, and traversal. It also
checks that an asset appears in the exact update/platform export metadata
before reading it.

## Server changes from the SDK 54 example

### Workspace and tooling

- Added an npm workspace at the repository root.
- Replaced separate Yarn locks with one npm lock.
- Added root setup, publish, validation, and release-client commands.
- Upgraded Next.js and TypeScript-era tooling.
- Uses Next's Webpack path for compatibility with hosts where native
  Turbopack/SWC bindings cannot load.
- Replaced `next/jest` with a Babel TypeScript transform so tests do not depend
  on native SWC.

### Signing and secrets

The upstream example tracked private keys and a test private key. This branch
removes them. `npm run setup` generates a local RSA key pair and client
certificate under ignored `.local` directories, with the private key readable
only by the local user.

Manifest and directive signatures are emitted only when the client sends
`Expo-Expect-Signature`. Missing signing configuration is reported as an
explicit error instead of silently returning unsigned content.

### Manifest protocol

The old example selected the latest directory and assembled a demonstration
manifest. The updated endpoint adds:

- protocol 1 and protocol 0 behavior;
- `Accept` negotiation with quality values;
- multipart manifests, extensions, and directives;
- `application/expo+json` and JSON responses;
- no-update and rollback directives;
- channel and extra-parameter selection;
- structured `Expo-Manifest-Filters` and
  `Expo-Server-Defined-Headers`;
- per-asset request headers;
- explicit method/header/query validation; and
- stable error status codes.

### Asset protocol

The old asset URL identified a mutable path under whichever update happened to
be latest. This can make a cached manifest resolve to assets from a different
update.

Asset URLs now include runtime version, update UUID, platform, and exact export
path. The endpoint verifies all four dimensions, making URLs immutable and safe
to cache for one year.

It also adds:

- `HEAD`
- ETags and `304`
- MIME types and content lengths
- Zstandard/Brotli/gzip negotiation
- `nosniff`
- precomputed BSDIFF40 launch-bundle patches with hash validation and
  full-asset fallback
- path traversal prevention

### Publishing

The old shell script copied export output directly into its final directory.
The new Node publisher:

- reads the SDK 57 app config;
- runs the real `expo export --platform all`;
- computes a UUID for the update;
- writes exported config plus server metadata;
- precomputes efficient launch-bundle patches from configurable prior active
  updates in the same runtime/platform/channel;
- stages the complete update under a `.tmp` directory; and
- atomically renames it into the update store.

A separate publisher creates rollback records with the same atomic pattern.
The demo workflow produces two real Expo exports from a controlled JavaScript
change and exposes an artifact report/browser view showing update, patch, and
rollback state.

### Diagnostic app

The former app only displayed sample content. The SDK 57 app now exposes:

- current update constants and manifest;
- live `useUpdates()` state;
- check/fetch/reload controls;
- extra-parameter read/write/clear;
- native update logs;
- experimental request-header and update-URL overrides; and
- reload-screen test controls.

This makes the repository usable as a local API/protocol test harness rather
than only a minimal visual demo.

## Compatibility and operational notes

- Update methods must be tested in release builds.
- A native rebuild is required when changing SDK/native dependencies,
  runtime version, signing certificate, or embedded update configuration.
- Ordinary JavaScript/content changes only require `npm run publish:update`.
- Keep runtime versions separate whenever native compatibility changes.
- `disableAntiBrickingMeasures` is enabled only for the local override
  diagnostic UI.
- Current npm audit output contains moderate advisories in Expo's development
  configuration dependency chain. npm's proposed forced remediation would
  replace SDK 57 with an obsolete Expo version, so it is not applied.

Primary references:

- Expo Updates v1 specification:
  https://docs.expo.dev/technical-specs/expo-updates-1/
- Custom Expo Updates server guide:
  https://docs.expo.dev/versions/latest/sdk/updates/#custom-expo-updates-server
- Expo SDK 55 changelog:
  https://expo.dev/changelog/sdk-55
- Expo SDK 56 changelog:
  https://expo.dev/changelog/sdk-56
- Expo SDK 57 changelog:
  https://expo.dev/changelog/sdk-57
