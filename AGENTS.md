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
