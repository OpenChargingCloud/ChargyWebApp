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

const chargyStylesheetPattern = /(^|\/)css\/chargy(?:\.[0-9a-f]+)?\.css$/i;
const chargyBundleScriptPattern = /(^|\/)chargyWebApp-bundle(?:\.[0-9a-f]+)?\.js$/i;
const contentHashedAssetPattern = /\.[0-9a-f]{8,}\.(js|css)$/i;

export interface IntegrityDocumentLike {
    querySelectorAll(selector: string): Iterable<{ getAttribute(name: string): string | null }>;
}

function sameOriginAssetPath(rawAttribute: string | null,
                             pageURL: URL,
                             pattern: RegExp): string | undefined {

    if (rawAttribute === null)
        return undefined;

    const trimmed = rawAttribute.trim();
    if (trimmed === "")
        return undefined;

    try
    {
        const resolved = new URL(trimmed, pageURL);
        if (resolved.origin !== pageURL.origin)
            return undefined;

        if (!pattern.test(resolved.pathname))
            return undefined;

        return resolved.origin + resolved.pathname;
    }
    catch
    {
        return undefined;
    }

}

/**
 * Collects the active same-origin application assets referenced by the running
 * page so integrity hashing works identically with content-hashed production
 * bundles and unhashed development builds.
 */
export function collectApplicationIntegrityAssets(doc: IntegrityDocumentLike,
                                                  pageHref: string): string[] {

    const pageURL = new URL(pageHref);
    const indexURL = new URL("index.html", pageURL);
    const entryIndex = indexURL.origin + indexURL.pathname;

    const stylesheets = new Set<string>();
    for (const element of doc.querySelectorAll("link[rel='stylesheet'][href]"))
    {
        const asset = sameOriginAssetPath(element.getAttribute("href"), pageURL, chargyStylesheetPattern);
        if (asset !== undefined)
            stylesheets.add(asset);
    }

    const scripts = new Set<string>();
    for (const element of doc.querySelectorAll("script[src]"))
    {
        const asset = sameOriginAssetPath(element.getAttribute("src"), pageURL, chargyBundleScriptPattern);
        if (asset !== undefined)
            scripts.add(asset);
    }

    return [
        entryIndex,
        ...[ ...stylesheets ].sort((left, right) => left.localeCompare(right)),
        ...[ ...scripts ].sort((left, right) => left.localeCompare(right))
    ];

}

export function isContentHashedAsset(assetURL: string): boolean {

    try
    {
        const parsed = new URL(assetURL, "https://local.invalid/");
        return contentHashedAssetPattern.test(parsed.pathname);
    }
    catch
    {
        return false;
    }

}

function bytesToHex(bytes: Uint8Array): string {

    let hex = "";
    for (const byte of bytes)
        hex += byte.toString(16).padStart(2, "0");
    return hex;

}

function concatenateDigestBuffers(buffers: readonly ArrayBuffer[]): Uint8Array<ArrayBuffer> {

    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const combined = new Uint8Array(new ArrayBuffer(totalLength));

    let offset = 0;
    for (const buffer of buffers)
    {
        combined.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    }

    return combined;

}

/**
 * Computes the combined SHA-512 hash over the active application assets.
 * Unhashed entry files (such as index.html) are always revalidated with
 * `cache: "no-cache"`, while content-hashed JS/CSS bundles can safely reuse
 * immutable browser caches.
 */
export async function computeApplicationSHA512(assetURLs: readonly string[],
                                               fetchImpl: typeof fetch = fetch): Promise<string> {

    if (assetURLs.length === 0)
        throw new Error("No application assets available for integrity hashing");

    const fileHashes = await Promise.all(assetURLs.map(async assetURL => {
        const response = await fetchImpl(assetURL, {
            cache:       isContentHashedAsset(assetURL) ? "default" : "no-cache",
            credentials: "same-origin"
        });

        if (!response.ok)
            throw new Error(`Failed to fetch application asset ${assetURL}: HTTP ${response.status}`);

        const bytes = await response.arrayBuffer();
        return crypto.subtle.digest("SHA-512", bytes);
    }));

    const combined = concatenateDigestBuffers(fileHashes);
    const finalDigest = await crypto.subtle.digest("SHA-512", combined);

    return bytesToHex(new Uint8Array(finalDigest));

}

export function normalizeSHA512(hash: string): string {
    return hash.replace(/^0x/i, "").replace(/\s/g, "").toLowerCase();
}

export function hashesMatch(localHash: string,
                            remoteHash: string | undefined): boolean {

    if (remoteHash === undefined)
        return false;

    const normalizedLocal = normalizeSHA512(localHash);
    const normalizedRemote = normalizeSHA512(remoteHash);

    return normalizedLocal !== "" && normalizedLocal === normalizedRemote;

}

export function formatSHA512Groups(hash: string): string {
    return hash.match(/.{1,8}/g)?.join(" ") ?? "";
}

export function buildVersionInfoURL(versionsURL: string,
                                    appVersion: string): string {

    const trimmedBase = versionsURL.replace(/\/+$/, "");
    return trimmedBase + "/" + encodeURIComponent(appVersion);

}
