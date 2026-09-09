# Self-hosted channel and build state model

The local server uses `expo-updates-server/updates/catalog.json` as a small,
file-backed control plane. It is intentionally shaped so the same model can
later move to a database without changing the Expo Updates HTTP contract.

## Record model

Every catalog record has:

| Field | Purpose |
| --- | --- |
| `kind` | `update` or `rollback` |
| `state` | `active` or `disabled` |
| `directory` | `<runtimeVersion>/<record>` storage location |
| `id` | Update UUID; required for normal updates |
| `groupId` | Groups platform updates published together |
| `createdAt` | Ordering and rollback commit time |
| `runtimeVersion` | Exact native compatibility identifier/fingerprint |
| `platform` | Optional `android` or `ios` restriction |
| `channel` | Direct self-hosted channel selector |

For a runtime present in the catalog, unlisted directories are not eligible.
Runtimes absent from the catalog retain directory-scan compatibility for old
fixtures and previously exported local updates.

## Selection trace

For each manifest request:

```text
Expo-Runtime-Version
  -> catalog records with exact runtimeVersion
  -> state == active
  -> matching platform or platform-independent
  -> matching channel
  -> matching Expo-Extra-Params
  -> newest createdAt
  -> normal manifest or rollback directive
```

Fingerprint values are opaque and case-sensitive. The server does not
recalculate a device fingerprint. Expo resolves each platform's fingerprint
before publishing and sends it as `Expo-Runtime-Version`.

## Rollback behavior

A rollback is an ordered catalog record rather than a mutable flag:

```text
main:    update A -> update B -> rollback
preview: update C
```

`main` clients receive `rollBackToEmbedded`, while `preview` clients on the
same runtime continue receiving update C. Publishing another newer update to
`main` resumes normal updates.

This mirrors the useful parts of EAS's ordered update history without requiring
EAS, a branch service, or hosted infrastructure.

## Publication consistency

Publishing:

1. resolves the runtime version independently for Android and iOS;
2. exports each platform;
3. stages files under `.tmp` directories;
4. finds configurable prior active builds in the same
   runtime/platform/channel;
5. generates BSDIFF40 launch-bundle patches and retains only efficient ones;
6. records patch, base, and target SHA-256 hashes in `server.json`;
7. renames all platform exports into place;
8. acquires an exclusive catalog lock;
9. writes a complete temporary catalog; and
10. atomically renames the catalog.

If publication or catalog insertion fails, newly published directories are
removed. A shared `groupId` connects Android and iOS records even when
fingerprint policy resolves different runtime versions.

Patch delivery never changes update selection. After a target update is
selected, the asset request may identify its current/base update. The server
serves a patch only when the base update is known, the target matches, every
recorded hash and size matches the stored bytes, and the patch remains smaller
than the full target. Otherwise it serves the immutable full bundle.

Precomputed patches are preferred. A missing eligible pair can be generated on
demand under a deterministic key derived from runtime, platform, update IDs,
and base/target hashes. Generation uses bounded concurrency, per-process
single-flight work, cross-process lock files, atomic cache writes, a maximum
asset size, and a timeout. The generated patch is applied once and compared
byte-for-byte with the target before it becomes cacheable. Inefficient results
are represented by negative cache metadata.

## Future database mapping

A DynamoDB implementation can use:

```text
partition key: channel#runtimeVersion#platform
sort key:      createdAt#recordId
```

An additional update-ID index supports immutable asset lookup. Disabled records
remain auditable but are excluded from selection. Conditional writes can
replace the local lock and atomic rename.

The HTTP conformance suite does not depend on this storage choice. It only
observes the manifest, directive, and asset APIs.
