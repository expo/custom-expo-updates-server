# Expo Updates HTTP conformance suite

This package sends black-box HTTP requests. It does not import the Next.js
handlers or storage implementation, so the same tests can run against another
backend.

## Local server

From the repository root:

```sh
npm run test:api
```

The runner allocates a port, starts the local server, runs the suite, and stops
the server.

## Another backend

Seed the target with the fixture contract described in `coverage.json`, then
run:

```sh
EXPO_UPDATES_CONFORMANCE_BASE_URL=https://service.example.com \
EXPO_UPDATES_CONFORMANCE_MANIFEST_PATH=/v1/expo-updates/manifest \
npm run test:api:remote
```

Optional environment:

| Variable | Purpose |
| --- | --- |
| `EXPO_UPDATES_CONFORMANCE_HEADERS_JSON` | JSON object merged into every request, such as test authorization |
| `EXPO_UPDATES_CONFORMANCE_CERTIFICATE_PATH` | Certificate used to verify signatures |
| `EXPO_UPDATES_CONFORMANCE_EXPECT_SIGNING` | Require signature tests |
| `EXPO_UPDATES_CONFORMANCE_EXPECT_BSDIFF_PATCH` | Require `226 IM Used` instead of accepting full-asset fallback |
| `EXPO_UPDATES_CONFORMANCE_*_RUNTIME` | Override seeded fixture runtime versions |
| `EXPO_UPDATES_CONFORMANCE_*_UPDATE_ID` | Override seeded fixture update IDs |
| `EXPO_UPDATES_CONFORMANCE_CHANNEL` | Seeded matching channel |
| `EXPO_UPDATES_CONFORMANCE_UNMATCHED_CHANNEL` | Channel expected not to match |

Asset tests follow URLs returned by the manifest. They do not assume the asset
endpoint uses the same path as this Next.js implementation.

When `EXPO_UPDATES_CONFORMANCE_EXPECT_BSDIFF_PATCH=true`, the suite downloads
the prior launch bundle and returned BSDIFF40 payload, applies the patch
locally, and requires the reconstructed bytes to exactly equal the target
launch bundle. It also checks patch `HEAD`/ETag behavior and safe full-asset
fallback for unknown bases and mismatched requested update IDs.

## Fingerprint behavior

Expo fingerprint policy resolves to a platform runtime-version string before a
build or update is published. The HTTP server does not recalculate a device
fingerprint. Its responsibility is exact matching of the
`Expo-Runtime-Version` header.

The suite seeds a fingerprint-shaped hexadecimal runtime and verifies:

- exact matches receive the update;
- a one-character change does not match; and
- case changes do not match.

The publishing scripts separately call Expo's
`expo-updates runtimeversion:resolve` command for each platform, allowing iOS
and Android to resolve to different fingerprints.
