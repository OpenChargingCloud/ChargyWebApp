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
POI-to-Core meter-key handoff or dynamic/publication verification before implemented.
