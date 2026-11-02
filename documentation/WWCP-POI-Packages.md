# Shared POI and Core package delivery

Status: 2 November 2026. ChargyWebApp consumes the published npm releases:

| Package | Declared dependency | Locked release |
| --- | --- | --- |
| `@open-charging-cloud/wwcp-poi` | `^0.2.0` | `0.2.0` |
| `@open-charging-cloud/chargy-core` | `^0.18.0` | `0.18.0` |

`package-lock.json` records the registry archive URLs and SHA-512 integrity
hashes. `npm ci` installs those exact releases without sibling repositories or
repository-contained development archives. The production build includes both
packages in `sbom.json`.

## Migration from development archives

These releases replace the unpublished POI `0.1.2-dev.0` and Core
`0.17.1-dev.0` archives previously delivered in `vendor/`. The registry archives
have the same integrity hashes as the locally verified release archives. All
installed JavaScript and declaration files also match the previous development
packages: 60 files for POI and 41 for Core. The delivery changes; the shared
verification code and public types are identical.

The old tarballs, source patches, manifest and `dev:pack:trust` helper are no
longer needed. Their original provenance remains in Git history. The current
package sources and release notes are available in
[WWCP_POI.TS](https://github.com/OpenChargingCloud/WWCP_POI.TS) and
[ChargyCore.TS](https://github.com/OpenChargingCloud/ChargyCore.TS).

COSE and Metrological CBOR remain aligned on `^0.12.0` in the app and both
libraries; the lockfile resolves one instance of each. Core has no dependency
on POI: the app supplies locally authorized keys and historical bindings through
the shared public APIs.

## Verification and scope

```sh
npm ci
npm ls @open-charging-cloud/wwcp-poi @open-charging-cloud/chargy-core @vanaheimr/cose @vanaheimr/metrological-cbor --all
npm run verify
```

Publishing these packages does not standardize the experimental session-price,
compact-delegation or publication-receipt profiles, add production trust roots,
or establish an independent witness service. Existing evidence and authorization
boundaries continue to apply. The package-source migration changes no UI flow;
documentation captures remain subject to the usual UI/UX maintenance rules.
