# Unpublished trust-integration development packages

The app uses local `file:` tarballs for **wwcp-poi 0.1.2-dev.0** and
**chargy-core 0.17.1-dev.0** while the shared meter-key, historical evidence and experimental session-price APIs are reviewed. These
are development candidates, not published npm releases. A clean checkout can
install/build the app without sibling repositories. Their normal dependencies
continue to come from the lockfile; no production trust keys are added.

`manifest.json` records tarball integrity, source repositories, base commits,
and hashes of complete, reviewable source patches in `source/`. To reconstruct
a source candidate, check out the recorded base and apply its patch with
`git apply`; it includes new source/tests and public fixtures. Package archives
include their licenses and source maps. No duplicated app-side cryptographic
adapter is compiled from these patches: the app calls the packaged libraries.
Use an LF checkout (`core.autocrlf=false`) to reproduce source bytes exactly.

After both library checkouts pass `npm run verify`, regenerate packages with:

```sh
npm run dev:pack:trust -- --poi ../WWCP_POI.TS --core ../ChargyCore.TS
```

The pack command verifies checkout names and refuses unrelated modified or
untracked files. It builds and packs locally, exports the allowed source changes
and never runs `npm publish`. Refresh the app's lockfile/installed packages after
repacking and run its verification and screenshot suites. `npm ci` verifies the
checked-in tarball integrity on CI.

Once the final library releases are explicitly approved and published, replace
these `file:` dependencies with the actual registry versions/integrity, verify a
fresh install, and remove this development delivery. Do not claim an unpublished
candidate is already on npm or substitute an old registry tarball with the same
version number.
