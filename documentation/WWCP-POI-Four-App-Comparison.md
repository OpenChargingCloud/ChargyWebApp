# Four-app WWCP/POI trust comparison

Audit date: **3 November 2026**. This repeats the comparison after the OCCApp
trust-chain port. The shared verification contracts agree across ChargyWebApp,
ChargyDesktopApp, ChargyMobileApp and OCCApp. Application integration still needs
separate acceptance; the open differences below prevent a blanket parity claim.

## Checkouts and full test suites

| Application | Checked commit | Passed | Existing skips | Build |
| --- | --- | ---: | ---: | --- |
| ChargyWebApp | `d5284ad633f5f9cfaadd8fb0948e085529006299` | 600 | 3 | ✅ Production Webpack bundle |
| ChargyDesktopApp | `a8acd8254f37c38020bcf414ed07362d41007591` | 773 | 5 | ✅ Electron renderer bundle |
| ChargyMobileApp | `5dc1b3df50d276cb176a17206fddf39e2f5858d4` | 602 | 3 | ✅ Cordova browser production build |
| OCCApp | `775409a025b58479089cd5011aea27739bd95f1c` | 444 | 3 | ✅ TypeScript and Vite production build |

All suites ran afresh, sequentially, with Vitest **5.1.0**, at most two workers
and their unchanged test deadlines. No failing case was skipped or modified.
The app TypeScript source snapshots remained unchanged. The sibling checkouts
were clean; this change only extends the WebApp comparison tool and documentation.
Existing bundle-size warnings remain. This run did not build native installers.

All four installations have identical registry integrity and installed
JavaScript/declaration hashes for:

| Package | Installed version |
| --- | --- |
| `@open-charging-cloud/wwcp-poi` | `0.2.0` |
| `@open-charging-cloud/chargy-core` | `0.18.0` |
| `@vanaheimr/cose` | `0.12.0` |
| `@vanaheimr/metrological-cbor` | `0.12.0` |

COSE and metrological CBOR are transitive in OCCApp and direct dependencies in
the three Chargy apps. This difference does not change the installed code.

## Shared evidence and source adaptations

**265 cases in 20 selected common test files have matching names and outcomes
in all four apps.** Desktop's explicit test-name alias describes its process-start
transport switch instead of the Web build switch. The selection includes the
existing ChargePoint compatibility cases; these are not additional POI claims.

All **105 reference input files** in the eight fixture families are byte-identical
in Desktop, Mobile and OCCApp. The seven available `provenance.json` files are
also byte-identical. TrustAnchors has no reference `provenance.json`. Signed input
bytes are never normalized. This count covers JSON, CHARGY, TXT and PNG inputs;
it is not an inventory of every image or README in those directories.

| Reference fixture family | Matching input files per app |
| --- | ---: |
| TrustAnchors | 11 |
| POISession | 8 |
| POIHistory | 8 |
| POIPrices | 21 |
| POILive | 16 |
| POIObservedVersions | 6 |
| POITrustTransitions | 16 |
| POIPublication | 19 |

Of the 32 selected Web trust modules, Desktop has 27 identical and 5 differing
files; Mobile has 24 identical and 8 differing files. Their application sources
match the earlier audit snapshots. Differences include bounded Electron IPC
fetching, Cordova resource imports and page navigation, and transport switches.

OCCApp has 26 identical modules, 5 differing modules and its own
`src/trust-management.ts` instead of `src/ts/trustManagement.ts`. Its differences
include separate IndexedDB names, one-time migration of prior explicit OCCApp
policy approvals, explicit trust recovery, a smaller bundled-key adapter, a
trailing newline, and cross-document journal notifications. Source equality is
supporting evidence, not a substitute for checking those integration paths.

## Rendered application and persistence checks

The Browser plugin was not available; the existing Playwright runtime was used.
Web and Mobile ran against loopback servers serving their freshly built output;
Desktop ran as the real Windows Electron app with its preload/IPC and an isolated
user-data directory. OCCApp's eight owned browser suites ran against its local
Vite server at `http://127.0.0.1:5197/`.

Web and Cordova-browser session captures exercise genuine Drag & Drop, content-only
anchor review, explicit individual key confirmations, station validation,
P-256/OCMF meter-key handoff, original signature details, source-key conflicts and
a foreign meter key. Each produces seven captures, including a 390×844 viewport.
The native Electron smoke test independently checks the three trust statuses,
station verdict, meter association and two original reading signatures.

All eight OCCApp browser suites below passed. They use original signed fixtures,
explicit local trust decisions and actual IndexedDB. Separate fixture worlds
use separate browser contexts; exported/restored permissions originate in the
preceding real UI confirmations, never in production roots or injected verdicts.

| OCCApp browser suite | Exercised boundary |
| --- | --- |
| `trust` | Preview makes no request; explicit import; separate signature/signer/quorum checks; same-holder keys count once; withdrawal across tabs; QR image import; expiry, migration, quota failure and cancellation |
| `meter` | Original completed session; proven EVSE key; cryptographic details; source-key conflict, foreign key and tampered end reading; no evidence fetch for embedded proofs |
| `history` | Historical signed timestamps; exact archive export/reopen under current authorization; root deletion retains archives/journal; rollback after reload; concurrent signed forks; quota and corruption fail closed |
| `succession` | Missing quorum rejected; preview grants no authority; explicit old/new quorum acceptance; successor sources with bootstrap identity; historical old authority retained after reload |
| `prices` | Signed-start assignment and gross rates; separately accepted witness policy; cross-tab witness withdrawal; explicit bounded receipt retrieval; exact original archive and current authorization |
| `cpo-live` | Independent first-envelope CPO authority; old/new key bridge plus POI permission; explicit policy succession; withdrawal during an in-flight response |
| `live` | Waiting/start/intermediate/end; fixed offer retention; completion stops polling; offline archive replay; nine rejected update variants; durable fork quarantine; cancellation |
| `stations` | Bounded search/pagination; proof/prices only for the selected station; wrong station rejected; late responses suppressed; mobile layout; original archive retained after root withdrawal |

The fixture clocks are preserved, including each independent station example's
original check time. No signature validity was extended. Locale/timezone and
viewport details are in the capture metadata or suite setup; native Electron
uses the host timezone. Successful standalone meter signatures, current station
association, historical association, CPO assignment and witnessed publication
remain distinct claims.

## Open differences

### Already displayed results after a new authenticated fork (fixed in follow-up)

Reproduced in both Web and Cordova-browser Mobile with unchanged signed fixtures:

1. Open `POIObservedVersions/archive-1.chargy` in tab A. Import its supplied
   anchor and explicitly accept the holder keys through the UI.
2. Wait for the valid session-price result.
3. In tab B of the same installation, open
   `POIObservedVersions/checkpoint-fork-1.chargy`.
4. Tab B detects the signed checkpoint fork. Tab A still has
   `.sessionPriceResult[data-state="valid"]`, without an invalid consistency
   result, after cross-document delivery time.
5. Reload/reopen the original in A: the persistent journal correctly rejects
   the known fork. The gap concerns invalidation of an existing presentation,
   not loss of the negative journal or acceptance during a fresh check.

OCCApp adds notifications when observed heads/conflicts change and rebuilds its
active evidence views. Repeating the same two-tab case against the OCCApp
production build correctly changed tab A's price result to `invalid`, including
an invalid consistency result, without reopening. The three Chargy apps do not yet have this notification
and listener pair at the initial audit. Desktop's corresponding code had the same
gap by inspection; the native multi-window case had not yet been exercised then.

The subsequent implementation adds post-commit invalidation hints and retained-
original rechecks in Web, Desktop and Mobile. It also covers new predecessor
links and succession, suppresses identical/audit-only writes, cancels pending
POI/live work and retains the selected policy, including an explicit empty
selection. See [open-view invalidation](WWCP-POI-Observed-Versions.md#invalidating-open-views-across-windows)
for the current behavior and genuine two-tab/late-crypto/live-response regressions.
The reproduction above records the initial audit finding; it is not the current
expected result. No stored green flag or cleared journal substitutes for a check.

The follow-up passes the full suites again (Web 600, Desktop 773, Mobile 602;
existing skips unchanged), typechecks, lint and builds. All nine affected Web
screenshot suites and nine Cordova-browser suites pass. Their observation suites
now contain nine captures, including automatic cross-tab invalidation, held real
crypto, an in-flight live response, duplicate/aborted writes and preservation of
an explicitly unselected policy. The actual Windows Electron app/preload also
passes the two-renderer signed-fork case and reload check in an isolated profile.
The common 265 contracts and 105 original fixture files still match. Physical
mobile lifecycle/camera acceptance remains separate. Raw follow-up evidence is
in `artifacts/observation-invalidation/audit-summary.json`; the initial audit
artifacts remain unchanged.

### Bundled-key management in OCCApp

OCCApp retains the shared exclusion store and filters excluded bundled keys in
verification, but its own Trust Management UI does not expose
`deleteBundledKey` / `restoreBundledKey`. Individual manual-key withdrawal and
anchor/network deletion are available and tested; they are separate operations.
The current production bundled-key list is empty in all four checkouts.

Follow-up: expose bundled-key inventory, exclusion and explicit restoration in
OCCApp, including cross-tab invalidation. Exercise it through a separate QA build
configuration; never add public fixture keys to production trust roots.

## Reproduction and retained evidence

Run each app's full suite sequentially and write its Vitest JSON to a common
temporary directory. For example, from each respective checkout:

```powershell
npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=C:/Temp/trust-comparison/web-tests.json
# Use desktop-tests.json, mobile-tests.json and occ-tests.json for the other apps.
```

Then, from ChargyWebApp:

```powershell
npm run compare:trust-ports -- --test-results C:/Temp/trust-comparison --output C:/Temp/trust-comparison/comparison.json
```

The comparison tool now includes OCCApp in fixture, provenance, source and common
case comparisons. It inventories actual results rather than running tests or
granting authority; missing/different cases must be reviewed, not inferred away.
Use fresh reports from the reviewed source snapshots. Path overrides are
documented in [package delivery](WWCP-POI-Packages.md#four-app-comparison).

Build commands used: Web `npm run bundle:production`, Desktop `npm run bundle`,
Mobile `npm run bundle:production`, OCCApp `npm run build`. Rendered checks use
Web/Mobile `build-tools/capturePOISessionScreenshots.mjs` with a temporary
`--output-dir`, and OCCApp `npm run test:browser`. OCCApp can use the existing
WebApp Playwright module through `OCCAPP_PLAYWRIGHT_PATH` and a temporary
`OCCAPP_QA_ARTIFACTS` directory; it installs no QA dependency automatically.

Local raw reports, logs, screenshots and exports from this run are retained in
the ignored `artifacts/cross-app-comparison-2026-11-03/` directory. The earlier
2 November evidence remains separate in `artifacts/cross-app-comparison/`.
No runtime UI changed in this audit, so checked-in documentation screenshots
were not overwritten with audit-only captures.

The first supplementary Mobile two-tab probe used the browser `File` name,
which Cordova replaces, and failed before importing input. It was rerun using
the same preserved native `File` constructor and `#startPage` drop target as the
existing Mobile capture helper. The original failure log is retained separately;
the corrected probe confirms the stale-view finding without changing app code,
deadlines, signed data or verification outcomes.

Physical Android/iOS cameras and permission lifecycles, native mobile storage,
macOS/Linux Electron packaging, other browser engines, and real POI/witness/live
providers remain outside this acceptance. Customer agreement to a concrete offer
remains an optional future OCCApp producer-format task. These are not established
by passing shared contracts or by an RNO/CPO signature.
