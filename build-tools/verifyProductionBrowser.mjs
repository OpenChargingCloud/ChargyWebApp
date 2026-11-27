/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
    options: {
        'build-dir': { type: 'string', default: path.join(repo, 'build') }
    }
});
const build = path.resolve(values['build-dir']);
const pdfFixture = path.join(repo, 'tests/fixtures/SAFE/SAFE-Testdata-02_withXMLNamespace.pdf');
const packageJson = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));

const mime = {
    '.html':  'text/html; charset=utf-8',
    '.js':    'text/javascript; charset=utf-8',
    '.mjs':   'text/javascript; charset=utf-8',
    '.css':   'text/css; charset=utf-8',
    '.json':  'application/json; charset=utf-8',
    '.png':   'image/png',
    '.svg':   'image/svg+xml',
    '.woff2': 'font/woff2',
    '.conf':  'text/plain; charset=utf-8'
};

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

// 1. Static production-build checks (CSP, content-hashed assets, no leaked files)
const indexHTML = await readFile(path.join(build, 'index.html'), 'utf8');
const cspMatch = indexHTML.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
assert.ok(cspMatch, 'Missing Content-Security-Policy meta tag in build/index.html');
const csp = cspMatch[1].replace(/\s+/g, ' ').trim();
assert.match(csp, /\bscript-src 'self';/, `Production CSP must pin script-src 'self', got: ${csp}`);
assert.ok(!csp.includes('unsafe-eval'), `Production CSP must not allow unsafe-eval, got: ${csp}`);
assert.match(csp, /\bobject-src 'none';/, `Production CSP must set object-src 'none', got: ${csp}`);
assert.match(csp, /\bbase-uri 'self';/, `Production CSP must set base-uri 'self', got: ${csp}`);

const jsLinks = [...indexHTML.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
const cssLinks = [...indexHTML.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(match => match[1]);
const entryBundles = jsLinks.filter(link => /^chargyWebApp-bundle\.[0-9a-f]{12}\.js$/.test(link));
const chargyStyles = cssLinks.filter(link => /chargy/.test(link));
assert.equal(entryBundles.length, 1, `Expected 1 content-hashed entry bundle, got: ${JSON.stringify(jsLinks)}`);
assert.equal(chargyStyles.length, 1, `Expected 1 chargy stylesheet link, got: ${JSON.stringify(chargyStyles)}`);
assert.match(chargyStyles[0], /^css\/chargy\.[0-9a-f]{12}\.css$/, `Expected content-hashed chargy CSS, got: ${chargyStyles[0]}`);

for (const forbidden of ['package.json', 'images/xss.png', 'images/ITnet_Thueringen.png', 'css/images/originals']) {
    assert.equal(await exists(path.join(build, forbidden)), false, `Unexpected file/directory emitted in build/: ${forbidden}`);
}

// Independently compute expected combined SHA-512 over index.html + hashed CSS + hashed JS
const sha512 = bytes => createHash('sha512').update(bytes).digest();
const expectedAppHash = sha512(Buffer.concat([
    sha512(await readFile(path.join(build, 'index.html'))),
    sha512(await readFile(path.join(build, chargyStyles[0]))),
    sha512(await readFile(path.join(build, entryBundles[0])))
])).toString('hex');

// 2. Serve build/ locally and verify in headless Chromium
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const file = path.resolve(build, '.' + relative);
        if (!file.startsWith(build + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        const bytes = await readFile(file);
        response.writeHead(200, {
            'Content-Type': mime[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(bytes);
    } catch {
        if (!response.headersSent)
            response.writeHead(404);
        response.end();
    }
});

await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;

const transparentPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64'
);

let browser;
try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: 'de-DE',
        timezoneId: 'UTC',
        deviceScaleFactor: 1,
        colorScheme: 'light',
        serviceWorkers: 'block'
    });

    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') {
            await route.continue();
        } else if (url.origin === 'https://chargy.charging.cloud') {
            await route.fulfill({ json: { versions: [] }, headers: { 'Access-Control-Allow-Origin': '*' } });
        } else if (request.resourceType() === 'image') {
            await route.fulfill({ body: transparentPNG, contentType: 'image/png' });
        } else {
            await route.abort();
        }
    });

    const page = await context.newPage();
    const cspConsoleViolations = [];
    const pageErrors = [];
    const localHttpErrors = [];

    await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', event => {
            window.__cspViolations.push({
                violatedDirective:  event.violatedDirective,
                effectiveDirective: event.effectiveDirective,
                blockedURI:         event.blockedURI,
                sourceFile:         event.sourceFile,
                lineNumber:         event.lineNumber
            });
        });
    });

    page.on('console', message => {
        const text = message.text();
        if (text.toLowerCase().includes('content security policy'))
            cspConsoleViolations.push(text);
    });
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('response', response => {
        if (response.url().startsWith(origin) && response.status() >= 400)
            localHttpErrors.push({ url: response.url(), status: response.status() });
    });

    await page.goto(origin + '/', { waitUntil: 'networkidle' });

    // 3. Structural HTML / WCAG 2.1 AA / BITV 2.0 audit
    const domAudit = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
        const seen = new Set();
        const duplicateIds = [];
        for (const id of ids) {
            if (seen.has(id)) duplicateIds.push(id);
            seen.add(id);
        }

        const unnamedButtons = [...document.querySelectorAll('button')].filter(button => {
            const name = (button.getAttribute('aria-label') || button.textContent || button.title || '').trim();
            return name === '';
        }).map(button => button.outerHTML.slice(0, 80));

        const unlabeledIssueControls = [...document.querySelectorAll('#newIssueForm input, #newIssueForm select, #newIssueForm textarea')].filter(control => {
            const id = control.getAttribute('id');
            const hasLabel = id !== null && document.querySelector(`label[for="${CSS.escape(id)}"]`) !== null;
            const hasAria = Boolean(control.getAttribute('aria-label') || control.getAttribute('aria-labelledby'));
            return !hasLabel && !hasAria;
        }).map(control => control.outerHTML.slice(0, 80));

        const invalidLinkButtons = document.querySelectorAll('button.linkButton[href]').length;
        const invalidDialogs = [...document.querySelectorAll('.overlay')].filter(overlay => {
            const labelledBy = overlay.getAttribute('aria-labelledby');
            return overlay.getAttribute('role') !== 'dialog' ||
                   overlay.getAttribute('aria-modal') !== 'true' ||
                   overlay.getAttribute('tabindex') !== '-1' ||
                   !labelledBy ||
                   document.getElementById(labelledBy) === null;
        }).map(overlay => overlay.id);

        const missingLandmarks = [
            ['banner',      '[role="banner"]'],
            ['main',        '[role="main"]'],
            ['contentinfo', '[role="contentinfo"]'],
            ['alert',       '#errorText[role="alert"]']
        ].filter(([, selector]) => document.querySelector(selector) === null).map(([name]) => name);

        return {
            lang: document.documentElement.lang,
            duplicateIds,
            unnamedButtons,
            unlabeledIssueControls,
            invalidLinkButtons,
            invalidDialogs,
            missingLandmarks
        };
    });

    assert.equal(domAudit.lang, 'de', 'Initial lang should match de-DE browser locale');
    assert.deepEqual(domAudit.duplicateIds, [], `Duplicate IDs in DOM: ${domAudit.duplicateIds.join(', ')}`);
    assert.deepEqual(domAudit.unnamedButtons, [], `Buttons without accessible name: ${domAudit.unnamedButtons.join(', ')}`);
    assert.deepEqual(domAudit.unlabeledIssueControls, [], `Unlabeled issue form controls: ${domAudit.unlabeledIssueControls.join(', ')}`);
    assert.equal(domAudit.invalidLinkButtons, 0, 'Found invalid <button class="linkButton" href> elements');
    assert.deepEqual(domAudit.invalidDialogs, [], `Overlays missing modal dialog ARIA attributes: ${domAudit.invalidDialogs.join(', ')}`);
    assert.deepEqual(domAudit.missingLandmarks, [], `Missing ARIA landmarks: ${domAudit.missingLandmarks.join(', ')}`);

    // 4. Language menu keyboard Escape handling
    await page.click('#languageButton');
    await page.waitForSelector('#languageMenu.open');
    await page.keyboard.press('Escape');
    const langState = await page.evaluate(() => ({
        isOpen:   document.getElementById('languageMenu').classList.contains('open'),
        expanded: document.getElementById('languageButton').getAttribute('aria-expanded'),
        activeId: document.activeElement?.id ?? ''
    }));
    assert.deepEqual(langState, { isOpen: false, expanded: 'false', activeId: 'languageButton' });

    // 5. Modal dialog focus placement, Tab trap, and Escape focus restore
    await page.click('#showIssueTracker');
    const issueFocusInside = await page.evaluate(() =>
        document.getElementById('issueTracker').style.display === 'block' &&
        document.getElementById('issueTracker').contains(document.activeElement)
    );
    assert.equal(issueFocusInside, true, 'Opening #issueTracker must place focus inside the dialog');

    await page.keyboard.press('Shift+Tab');
    const stillInsideAfterShiftTab = await page.evaluate(() =>
        document.getElementById('issueTracker').contains(document.activeElement)
    );
    assert.equal(stillInsideAfterShiftTab, true, 'Shift+Tab must stay trapped inside #issueTracker');

    await page.keyboard.press('Escape');
    const issueClosedState = await page.evaluate(() => ({
        hidden:     document.getElementById('issueTracker').style.display === 'none',
        restoredTo: document.activeElement?.id ?? ''
    }));
    assert.deepEqual(issueClosedState, { hidden: true, restoredTo: 'showIssueTracker' });

    // 6. About screen: build-time metadata and cross-checked dynamic SHA-512 hash
    await page.click('#aboutButton');
    await page.waitForFunction(() => {
        const value = document.querySelector('#applicationHash .hashValue')?.textContent?.replace(/\s+/g, '') ?? '';
        return /^[0-9a-f]{128}$/.test(value);
    }, { timeout: 10_000 });
    const aboutInfo = await page.evaluate(() => ({
        appVersion:        document.getElementById('appVersion')?.textContent?.trim(),
        chargyCoreVersion: document.getElementById('chargyCoreVersion')?.textContent?.trim(),
        webpackVersion:    document.getElementById('webpack')?.textContent?.trim(),
        appHash:           document.querySelector('#applicationHash .hashValue')?.textContent?.replace(/\s+/g, '') ?? '',
        externalLinks:     document.querySelectorAll('#aboutScreen a.linkButton[target="_blank"][rel="noopener noreferrer"]').length
    }));
    assert.equal(aboutInfo.appVersion, packageJson.version, 'About version must match package.json');
    assert.ok(aboutInfo.chargyCoreVersion && aboutInfo.webpackVersion, 'About dependency versions must be populated');
    assert.equal(aboutInfo.appHash, expectedAppHash, 'Computed application SHA-512 must match independent build hash');
    assert.ok(aboutInfo.externalLinks >= 35, `Expected semantic external links in #aboutScreen, got ${aboutInfo.externalLinks}`);
    await page.click('#backButton');

    // 7. Real PDF/A-3 verification under strict production script-src 'self' + keyboard measurement inspection
    await page.setInputFiles('#fileInput', pdfFixture);
    await page.locator('#chargingSessions .chargingSession').first().waitFor({ timeout: 15_000 });
    const sessionCheck = await page.evaluate(() => ({
        count:    document.querySelectorAll('#chargingSessions .chargingSession').length,
        status:   document.querySelector('#chargingSessions .chargingSession .verificationStatus')?.textContent?.trim(),
        role:     document.querySelector('#chargingSessions .chargingSession')?.getAttribute('role'),
        tabIndex: document.querySelector('#chargingSessions .chargingSession')?.getAttribute('tabindex')
    }));
    assert.equal(sessionCheck.count, 1);
    assert.equal(sessionCheck.status, 'Gültiger Ladevorgang');
    assert.equal(sessionCheck.role, 'button');
    assert.equal(sessionCheck.tabIndex, '0');

    const firstRow = page.locator('.measurementValueRows .measurementValue').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');
    await page.locator('#measurementsDetails').waitFor({ state: 'visible', timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.locator('#measurementsDetails').waitFor({ state: 'hidden', timeout: 5_000 });

    // 8. Live DE -> EN switching across title, core hash, modals, durations, and timestamps
    await page.click('#languageButton');
    await page.click('#languageMenu button[data-language="en"]');
    await page.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 5_000 });
    const enCheck = await page.evaluate(() => ({
        lang:               document.documentElement.lang,
        title:              document.title,
        coreHashLabel:      document.querySelector('#chargyCoreHash .hashLabel')?.textContent?.trim() ?? '',
        updateMessage:      document.querySelector('#updateAvailableScreen p')?.textContent?.trim() ?? '',
        bufferLabel:        document.querySelector('#measurementsDetails #buffer .description')?.textContent?.trim() ?? '',
        privacyHeading:     document.querySelector('#privacyStatement h1')?.textContent?.trim() ?? '',
        sessionProductText: document.querySelector('#chargingSessions .chargingSession .productInfos .text')?.textContent?.trim() ?? '',
        firstTimestampText: document.querySelector('.measurementValueRows .measurementValue .timestamp')?.textContent?.trim() ?? ''
    }));
    assert.equal(enCheck.lang, 'en');
    assert.match(enCheck.title, /Transparency software/i);
    assert.match(enCheck.coreHashLabel, /^SHA-512 hash of Chargy Core v\d+\.\d+\.\d+:$/);
    assert.equal(enCheck.updateMessage, 'An update for this software is available...');
    assert.equal(enCheck.bufferLabel, 'Buffer');
    assert.equal(enCheck.privacyHeading, 'Privacy notice for this issue reporter');
    assert.match(enCheck.sessionProductText, /Charging duration /);
    assert.ok(!enCheck.firstTimestampText.includes('Uhr'), `English timestamp should omit German Uhr: ${enCheck.firstTimestampText}`);

    // 9. XSS regression check: untrusted HTML in loaded transparency payload stays inert text
    await page.click('#backButton');
    const xssPayload = '<img src=x onerror="window.__xssExecuted=true">';
    const maliciousCTR = JSON.stringify({
        '@context': 'https://open.charging.cloud/contexts/chargeTransparency/record/1.0',
        '@id': xssPayload,
        description: { en: xssPayload, de: xssPayload },
        chargingSessions: [{
            '@id': 'session-xss',
            begin: '2026-01-01T10:00:00Z',
            end:   '2026-01-01T10:05:00Z',
            product: { '@id': xssPayload },
            authorizationStart: { '@id': xssPayload, type: 'RFID' },
            EVSEId: xssPayload,
            measurements: []
        }]
    });
    await page.setInputFiles('#fileInput', {
        name:     'xss-probe.chargy',
        mimeType: 'application/json',
        buffer:   Buffer.from(maliciousCTR, 'utf8')
    });
    await page.waitForTimeout(300);
    const xssCheck = await page.evaluate(() => ({
        executed:     window.__xssExecuted === true,
        injectedImgs: document.querySelectorAll('#chargingSessions img, #detailedInfos img, #invalidDataSetsScreen img').length
    }));
    assert.equal(xssCheck.executed, false, 'Untrusted record content must never execute scripts');
    assert.equal(xssCheck.injectedImgs, 0, 'Untrusted record content must never inject HTML elements');

    // 10. Verify zero CSP violations, zero page errors, and zero same-origin HTTP errors
    const domCspViolations = await page.evaluate(() => window.__cspViolations);
    assert.deepEqual(domCspViolations, [], `DOM CSP violations detected: ${JSON.stringify(domCspViolations)}`);
    assert.deepEqual(cspConsoleViolations, [], `Console CSP violations detected: ${JSON.stringify(cspConsoleViolations)}`);
    assert.deepEqual(pageErrors, [], `Uncaught page errors detected: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(localHttpErrors, [], `Same-origin HTTP errors detected: ${JSON.stringify(localHttpErrors)}`);

    console.log(JSON.stringify({
        status: 'ok',
        entryBundle: entryBundles[0],
        stylesheet: chargyStyles[0],
        appVersion: aboutInfo.appVersion,
        appHashMatched: true,
        checks: [
            'production-csp',
            'content-hashed-assets',
            'wcag-dom-audit',
            'modal-focus-and-escape',
            'dynamic-sha512-integrity',
            'pdf-a3-under-strict-csp',
            'de-to-en-i18n',
            'xss-regression'
        ]
    }, null, 2));
} finally {
    if (browser)
        await browser.close();
    server.close();
}
