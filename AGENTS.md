# Documentation screenshots

When UI/UX changes affect TrustAnchor preview, import, fingerprint rendering,
KeyStatement validation or the dialog frame, regenerate the documentation
screenshots with `npm run docs:screenshots` and review the resulting images.
Include changed PNGs and `capture-info.json` in the same change as the UI.
Update captions and the architecture document if the flow or visible state changes.

The capture setup and image locations are documented in
`documentation/screenshots/trust-anchor/README.md`. Use the real app, the public
test fixtures and the fixed locale/time/viewport in the capture script. Never
hand-edit screenshots, set verification outcomes directly or add fixture keys
to the production trust roots. CI regenerates current captures as downloadable
artifacts; check the checked-in documentation images as well when changing UI.

For changes to the trust-ready state, live-link layout/consent, update processing
or first-reading presentation, also run `npm run docs:screenshots:poi-live` and
inspect all images in `documentation/screenshots/poi-live-use-case/`. Keep its
`capture-info.json` and the use-case captions current. Run
`npm run docs:validate:poi-live` when changing the accompanying POI examples.
Those screenshots show actual current behavior; proposed POI/witness integration
must stay clearly labeled and must not be represented by injected success states.

For station-proof retrieval, results, cache/storage, trust gating or station-detail
changes, run `npm run docs:screenshots:station-proof` and inspect every image in
`documentation/screenshots/station-proof/`. This also exercises migration,
persistence, cancellation and failure paths against genuine signed fixtures.
Keep capture metadata and `documentation/WWCP-POI-Station-Proof.md` current.
Preserve the fixed fixture clock; never edit signatures or production roots to
make an expired fixture pass. The green station verdict must not imply verified
meter readings, dynamic prices, publication or globally latest data.

For session/EVSE association, embedded POI evidence, offline bootstrap import,
the session evidence panel or responsive session-layout changes, run
`npm run docs:screenshots:poi-session` and inspect all captures in
`documentation/screenshots/poi-completed-session/`. Keep the fixture guide,
screenshots and capture metadata current. This script performs genuine Drag &
Drop and explicit trust decisions; it must never inject verification outcomes.
The fixture generator uses public test keys only. Never extend an attestation's
signed validity without regenerating and signing a new proof. Do not claim
dynamic/publication verification before implemented. The P-256/OCMF meter-key
handoff now has seven session captures, including source-key conflicts and a
valid station proof with a foreign meter key. Regenerate them for handoff changes.
Current association and valid signatures must never imply historical association.

For historical meter evidence, archive storage/management, per-reading key
selection or related trust/validity changes, also run
`npm run docs:screenshots:poi-history`. Review all five images in
`documentation/screenshots/poi-history/` and keep their captions and metadata
current. Historical claims are scoped to signed measurement timestamps. Never
infer independent actual time, sole/latest membership, continuous installation,
or independently trusted witnesses from inclusion alone. Archive policy snapshots
are audit data; opening an archive must reconstruct current authorization and
never restore those decisions. Deleting an anchor retains the separate evidence
archive and removes its authorization; deleting archived evidence is explicit.

For session prices, CPO assignments, price retrieval, rate comparisons or related
layout/trust changes, also run `npm run docs:screenshots:poi-prices`. Review all
six images in `documentation/screenshots/poi-prices/` and update their metadata,
captions and `documentation/WWCP-POI-Session-Prices.md`. The real signed fixtures
exercise Ed25519 and ML-DSA-65 CPO signatures; this does not widen the meter-key
pilot. Keep CPO assertions, customer consent, rate consistency and checkpoint
inclusion separate. Never infer pre-charge publication from a later checkpoint.
Embedded historical fixed-at-start evidence must not be overwritten with today's
price during a recheck. Archive audit metadata never restores local trust.

For live POI preparation, update admission, cumulative reading continuity, fixed
price retention or live archive changes, also run
`npm run docs:screenshots:poi-live-pilot` and review all seven images in
`documentation/screenshots/poi-live-pilot/`. Keep metadata, the fixture guide
and `documentation/WWCP-POI-Live-Pilot.md` current. Never overwrite an accepted
original reading or fixed price with a newer source response. The strict pilot
uses original JSON envelopes and cumulative P-256/OCMF readings; document-key
continuity alone does not authorize the initial envelope signer. The initial and
every subsequent envelope additionally require POI-authorized CPO document keys.

For observed-version storage, rollback/fork rules, historical/current selection,
live reopening or related management changes, also run
`npm run docs:screenshots:poi-observations` and inspect all eight images in
`documentation/screenshots/poi-observed-versions/`. Update the observed-versions
guide, fixture provenance and capture metadata. Never clear history automatically
on a source change or anchor deletion. Independent fixture scenarios that reuse
the same signed coordinates must explicitly reset through the real management UI;
persistence tests must not reset between related packets. A valid old fixed session
price remains historically checkable after newer current offers are known. No
stored success flag, self-signed replacement live key or in-memory production
fallback may replace current authorization and the persistent negative journal.

For CPO envelope authority or key/policy/epoch succession, run
`npm run docs:screenshots:poi-succession` and review all nine images in
`documentation/screenshots/poi-trust-succession/`. Keep the guide and provenance
current. Compact trust delegation is experimental and needs both old and new
holder quorums plus explicit local acceptance. It does not substitute for History
owner/change-set replay. Never clear old observations during succession, restore
manual trust from an archive, accept only a new self-signature, or conflate signed
timestamps with independent actual time. Independent sequence-0 policy and epoch
fixture worlds use separate installations; resetting observations retains accepted
policy decisions and is not a way to replace one certificate with another.

For publication-witness policy, receipt retrieval, pre-start timing or related
price/live UI changes, also run `npm run docs:screenshots:poi-publication` and
review all eight images in `documentation/screenshots/poi-publication/`. Keep
its guide, genuine fixture provenance and capture metadata current. No input
recommendation, RNO key or source response grants witness authority. Count
organizations under the current separately accepted local role/network/time
policy, not signatures or aliases. Apply the locally accepted clock uncertainty;
a later checkpoint or existence timestamp alone proves no earlier public
availability. Label the signed-start time basis and actual-time limitation.
Missing optional witness evidence must not invalidate valid independent meter
or CPO-signature checks. Receipts and archive data never restore witness trust.
Withdrawal and concurrent changes must prevent stale success across tabs.
