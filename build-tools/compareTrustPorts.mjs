// Compare actual app checkouts without changing their sources or trust decisions.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
    web: { type: 'string', default: webRoot },
    desktop: { type: 'string', default: path.resolve(webRoot, '../ChargyDesktopApp') },
    mobile: { type: 'string', default: path.resolve(webRoot, '../ChargyMobileApp') },
    occ: { type: 'string', default: path.resolve(webRoot, '../../OpenChargingCommunity/OCCApp') },
    output: { type: 'string' },
    'test-results': { type: 'string' },
    'test-suffix': { type: 'string', default: 'tests.json' }
} });
const roots = Object.fromEntries(['web', 'desktop', 'mobile', 'occ'].map(name => [name, path.resolve(values[name])]));
const json = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const relative = (root, file) => path.relative(root, file).replaceAll('\\', '/');
const walk = root => existsSync(root) ? readdirSync(root, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(root, entry.name)) : [path.join(root, entry.name)]) : [];
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const packages = ['@open-charging-cloud/wwcp-poi', '@open-charging-cloud/chargy-core', '@vanaheimr/cose', '@vanaheimr/metrological-cbor'];
const report = { capturedAt: new Date().toISOString(), apps: {}, sharedChargySources: {}, fixtures: {}, tests: {} };

for (const [name, root] of Object.entries(roots)) {
    const pkg = json(path.join(root, 'package.json'));
    const lock = json(path.join(root, 'package-lock.json'));
    const sourceFiles = walk(path.join(root, name === 'occ' ? 'src' : 'src/ts')).filter(file => file.endsWith('.ts'));
    report.apps[name] = {
        root, head: git(root, ['rev-parse', 'HEAD']), dirty: git(root, ['status', '--porcelain']),
        // Includes untracked source files, so an in-progress OCCApp port is not mistaken for its last commit.
        sourceSnapshot: sha256(JSON.stringify(sourceFiles.sort().map(file => [relative(root, file), sha256(readFileSync(file))]))),
        packages: Object.fromEntries(packages.map(packageName => {
            const entry = lock.packages[`node_modules/${packageName}`];
            const installed = path.join(root, 'node_modules', packageName);
            const files = walk(path.join(installed, 'dist')).filter(file => file.endsWith('.js') || file.endsWith('.d.ts'));
            return [packageName, {
                declared: pkg.dependencies?.[packageName] ?? null, locked: entry?.version ?? null,
                integrity: entry?.integrity ?? null,
                installed: existsSync(path.join(installed, 'package.json')) ? json(path.join(installed, 'package.json')).version : null,
                runtimeAndTypes: files.length ? sha256(JSON.stringify(files.sort().map(file => [relative(installed, file), sha256(readFileSync(file))]))) : null
            }];
        }))
    };
    if (values['test-results']) {
        const file = path.join(values['test-results'], `${name}-${values['test-suffix']}`);
        if (existsSync(file)) {
            const tests = json(file);
            report.tests[name] = {
                success: tests.success, passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests,
                suites: tests.testResults.map(suite => ({
                    file: relative(root, suite.name), status: suite.status,
                    cases: suite.assertionResults.map(result => ({ name: result.fullName, status: result.status }))
                }))
            };
        }
    }
}

const sharedFiles = walk(path.join(roots.web, 'src/ts')).filter(file =>
    /(?:trust|anchor|poi|stationProof|sessionMeter|sessionPrice|historical|securityFingerprint|pricePublication|sessionPOI)/i.test(path.basename(file)) && file.endsWith('.ts'));
for (const name of ['desktop', 'mobile']) {
    const result = { identical: [], different: [], missing: [] };
    for (const file of sharedFiles) {
        const filename = relative(roots.web, file);
        const other = path.join(roots[name], filename);
        if (!existsSync(other)) result.missing.push(filename);
        else {
            // Normalize source line endings only; signed fixture bytes below are never normalized.
            const same = readFileSync(file, 'utf8').replaceAll('\r\n', '\n') === readFileSync(other, 'utf8').replaceAll('\r\n', '\n');
            result[same ? 'identical' : 'different'].push(filename);
        }
    }
    report.sharedChargySources[name] = result;
}

const fixtureGroups = ['TrustAnchors', 'POISession', 'POIHistory', 'POIPrices', 'POILive', 'POIObservedVersions', 'POITrustTransitions', 'POIPublication'];
for (const group of fixtureGroups) {
    const base = path.join(roots.web, 'tests/fixtures', group);
    // Provenance and README differences are reported separately from original signed inputs.
    const files = walk(base).filter(file => /\.(?:json|chargy|txt|png)$/i.test(file) && path.basename(file) !== 'provenance.json');
    report.fixtures[group] = {};
    for (const name of ['desktop', 'mobile']) {
        const result = { identical: 0, different: [], missing: [] };
        for (const file of files) {
            const filename = relative(roots.web, file), other = path.join(roots[name], filename);
            if (!existsSync(other)) result.missing.push(filename);
            else if (!readFileSync(file).equals(readFileSync(other))) result.different.push(filename);
            else result.identical++;
        }
        report.fixtures[group][name] = result;
    }
}

const baselineSuites = report.tests.web?.suites.filter(suite =>
    /(?:trust|anchor|poi|stationProof|sessionMeter|sessionPrice|historical|securityFingerprint|pricePublication|roamingNetworks)/i.test(path.basename(suite.file))) ?? [];
for (const name of ['desktop', 'mobile']) {
    if (!report.tests[name]) continue;
    const results = new Map(report.tests[name].suites.map(suite => [path.basename(suite.file), suite]));
    report.tests[name].sharedContracts = baselineSuites.map(suite => {
        const other = results.get(path.basename(suite.file));
        const cases = new Map(other?.cases.map(test => [test.name, test.status]));
        // Desktop's transport switch is selected at process start, Web's at build time.
        // Keep the explicit rename visible; no outcome is inferred or overwritten.
        const renamedCases = name === 'desktop' && path.basename(suite.file) === 'liveLinkTrust.tests.ts'
            ? [{ reference: 'Live link trust refuses plaintext transports unless the build allows them',
                target: 'Live link trust refuses plaintext transports unless the run allows them' }] : [];
        const targetName = test => renamedCases.find(alias => alias.reference === test.name)?.target ?? test.name;
        return { file: suite.file, referenceCases: suite.cases.length,
            renamedCases,
            missing: suite.cases.filter(test => !cases.has(targetName(test))).map(test => test.name),
            differentResults: suite.cases.filter(test => cases.has(targetName(test)) && cases.get(targetName(test)) !== test.status).map(test => test.name) };
    });
}

const output = JSON.stringify(report, null, 2) + '\n';
if (values.output) writeFileSync(values.output, output);
else process.stdout.write(output);
