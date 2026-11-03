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

## Four-app comparison

The application team consists of **ChargyWebApp, ChargyDesktopApp,
ChargyMobileApp and OCCApp**. OCCApp is a charging application with its own
station-discovery, session and trust workflows; a shared package version does
not imply that it implements every Chargy verification path.

`npm run compare:trust-ports -- --output <comparison.json>` inventories all four
local checkouts, including uncommitted source, installed package integrity and
runtime/type hashes. It also compares the shared Chargy trust modules and exact
fixture bytes without normalizing signed input. Paths can be supplied with
`--web`, `--desktop`, `--mobile` and `--occ`.

To compare actual Vitest results, pass `--test-results <directory>` containing
`web-tests.json`, `desktop-tests.json`, `mobile-tests.json` and `occ-tests.json`.
`--test-suffix serial-tests.json` selects correspondingly named sequential-run
reports. The inventory does not run tests, authorize keys, or infer UI/native
scanner equivalence. Review platform adaptations and OCCApp-specific behavior
separately; run app suites sequentially to avoid cross-app cryptography and
image-decoding timeouts under load.

### Comparison on 2 November 2026

The checked TypeScript source snapshots remained unchanged throughout the audit.
All four apps resolved POI 0.2.0 and Core 0.18.0 with identical registry
integrity and installed JavaScript/declaration hashes.

| App / checked revision | Passing tests | Skipped | Build |
| --- | ---: | ---: | --- |
| ChargyWebApp / `fc513cd` | 600 | 3 | Passed |
| ChargyDesktopApp / `6100217` | 773 | 5 | Passed |
| ChargyMobileApp / `bdc6881` | 602 | 3 | Passed |
| OCCApp / `b36a345` | 164 | 3 | Passed |

Web, Desktop and Mobile shared **105 byte-identical input files** across the
eight TrustAnchor/POI fixture families and **265 cases in 20 shared test files**
with matching results. Desktop's one explicitly recorded test-name change
describes its process-start transport switch rather than Web's build switch.
Source differences were reviewed separately: Electron's bounded IPC fetch,
Mobile's resource imports and settings page, and platform-specific transport
configuration. Initial concurrent runs hit timeouts; the unchanged suites all
passed sequentially under their original timeout limits.

The Web and Cordova-browser completed-session captures exercised actual Drag &
Drop, explicit local key decisions, station and meter checks, signature details,
responsive layout, source-key conflicts and a foreign meter key. A native
Electron run also checked the original completed session under explicitly
accepted fixture keys. Its three trust checks, station verdict, meter-key
association and two original reading signatures passed. Native Android/iOS
camera plugins were not exercised on physical devices.

OCCApp's rendered Chromium flow passed content-only TrustAnchor review, explicit
approval, persistence after reload, withdrawal, and parsing the same completed
session with two valid meter signatures. Its station-directory tests also check
genuine station and CPO price signatures. This is **not full Chargy workflow
parity**: OCCApp currently lacks the KeyStatement review with three separate
validation states and raster fingerprints, the embedded POI-to-meter handoff and
historical per-reading association, session-bound fixed prices/publication
receipts, the persistent rollback/fork journal and verified trust succession,
and the strict POI-authorized CPO live-update admission path. Its archive checks
at the saved check time and its explicit association of transparency snapshots
are separate from those stronger claims. Recheck these integration points when
the OCCApp port advances; passing its own tests does not establish them.

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
