// Local development artifacts only. This command never publishes a package.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const app = fileURLToPath(new URL('../', import.meta.url));
const vendor = path.join(app, 'vendor');
const { values } = parseArgs({ options: {
    poi: { type: 'string', default: path.resolve(app, '../WWCP_POI.TS') },
    core: { type: 'string', default: path.resolve(app, '../ChargyCore.TS') }
} });
const npmCLI = process.env.npm_execpath;
assert.ok(npmCLI, 'Run with npm run dev:pack:trust so npm is invoked without shell interpolation');
function run(command, args, cwd, capture = false) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${command} ${args[0]} failed`);
    return result.stdout ?? '';
}
const specs = [
    { id: 'poi', name: '@open-charging-cloud/wwcp-poi', root: values.poi, repository: 'https://github.com/OpenChargingCloud/WWCP_POI.TS',
        files: ['package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md', 'src/index.ts', 'src/proofs/stationProof.ts',
            'src/verifier/chargingStation.ts', 'src/verifier/measurementKeys.ts', 'tests/measurementKeys.test.ts',
            'tests/vectors/meter-session.json', 'tests/vectors/meter-session-meta.json', 'src/verifier/historicalMeasurements.ts',
            'tests/historicalMeasurements.test.ts', 'tests/vectors/history-session.json', 'tests/vectors/history-witnesses.json', 'src/verifier/sessionPrices.ts', 'tests/sessionPrices.test.ts',
            'tests/vectors/session-price-ed.json', 'tests/vectors/session-price-pqc.json', 'tests/vectors/session-price-decimal.json', 'src/verifier/observedVersions.ts', 'tests/observedVersions.test.ts',
            'tests/partyKeys.test.ts','src/keys.ts','src/history/epoch.ts','src/proofs/trustContext.ts','src/verifier/documentKeys.ts','src/verifier/trustTransitions.ts','tests/trustTransitions.test.ts','tests/vectors/trust-transitions.json','tests/documentKeys.test.ts',
            'src/verifier/pricePublication.ts','tests/pricePublication.test.ts','tests/vectors/price-publication.json'] },
    { id: 'core', name: '@open-charging-cloud/chargy-core', root: values.core, repository: 'https://github.com/OpenChargingCloud/ChargyCore.TS',
        files: ['package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md', 'src/index.ts', 'src/MeterKeyVerification.ts', 'src/OCMF.ts',
            'tests/MeterKeyVerification.tests.ts', 'tests/fixtures/POISession/completed-session-with-evse-proof.chargy',
            'tests/fixtures/POISession/provenance.json', 'tests/fixtures/POISession/README.md', 'tests/fixtures/POISession/historical-session.chargy', 'src/SessionPriceContext.ts', 'src/DocumentSignatures.ts', 'src/LiveSessionContinuity.ts', 'tests/LiveSessionContinuity.tests.ts', 'tests/LiveCPOAuthority.tests.ts', 'tests/fixtures/POILive/00-waiting.json', 'tests/fixtures/POILive/01-start.json', 'tests/fixtures/POILive/02-intermediate.json', 'tests/fixtures/POILive/03-completed.json', 'tests/fixtures/POISession/price-session.chargy'] }
];
await mkdir(path.join(vendor, 'source'), { recursive: true });
const packages = [];
for (const spec of specs) {
    const root = path.resolve(spec.root);
    const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(metadata.name, spec.name, 'Verify the explicitly named checkout before its build cleans dist');
    assert.match(metadata.version, /-dev\./, 'Candidates must be clearly marked development versions');
    const tracked = run('git', ['diff', '--name-only', 'HEAD'], root, true).trim().split('\n').filter(Boolean);
    const added = run('git', ['ls-files', '--others', '--exclude-standard'], root, true).trim().split('\n').filter(Boolean);
    for (const file of [...tracked, ...added]) assert.ok(spec.files.includes(file), `Refusing unrelated source change: ${file}`);
    const baseCommit = run('git', ['rev-parse', 'HEAD'], root, true).trim();
    let patch = run('git', ['diff', '--binary', '--no-ext-diff', 'HEAD', '--', ...spec.files], root, true);
    for (const file of added) {
        const absolute = path.resolve(root, file);
        assert.ok(absolute.startsWith(root + path.sep));
        const text = (await readFile(absolute, 'utf8')).replace(/\r\n/g, '\n');
        const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
        patch += `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n`;
        patch += lines.map(line => '+' + line + '\n').join('');
        if (!text.endsWith('\n')) patch += '\\ No newline at end of file\n';
    }
    const patchName = `source/${spec.id}.patch`;
    await writeFile(path.join(vendor, patchName), patch);
    // The resolved checkout and package name above establish the intended dist directory.
    run(process.execPath, [npmCLI, 'run', 'build'], root);
    const output = run(process.execPath, [npmCLI, 'pack', '--ignore-scripts', '--json', '--pack-destination', vendor], root, true);
    const parsed = JSON.parse(output);
    const packed = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
    assert.equal(packed.name, spec.name);
    packages.push({ name: spec.name, version: packed.version, repository: spec.repository, baseCommit,
        sourcePatch: patchName, patchSHA256: createHash('sha256').update(patch).digest('hex'),
        filename: packed.filename, integrity: packed.integrity,
        sha256: createHash('sha256').update(await readFile(path.join(vendor, packed.filename))).digest('hex') });
}
await writeFile(path.join(vendor, 'manifest.json'), JSON.stringify({
    status: 'Unpublished local development candidates; no npm publication',
    regeneration: 'npm run dev:pack:trust -- --poi <POI checkout> --core <Core checkout>', packages
}, null, 2) + '\n');
console.log('Packed two local trust candidates with reviewable source patches. Nothing was published.');
