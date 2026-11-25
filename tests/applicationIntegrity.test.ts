import { describe, expect, test } from "vitest";
import {
    buildVersionInfoURL,
    collectApplicationIntegrityAssets,
    computeApplicationSHA512,
    formatSHA512Groups,
    hashesMatch,
    isContentHashedAsset,
    normalizeSHA512,
    type IntegrityDocumentLike
} from "../src/ts/applicationIntegrity";

function fakeDocument(links: readonly string[],
                      scripts: readonly string[]): IntegrityDocumentLike {

    return {
        querySelectorAll(selector: string): Array<{ getAttribute(name: string): string | null }> {
            if (selector.startsWith("link"))
                return links.map(href => ({ getAttribute: (name: string): string | null => (name === "href" ? href : null) }));
            if (selector.startsWith("script"))
                return scripts.map(src => ({ getAttribute: (name: string): string | null => (name === "src" ? src : null) }));
            return [];
        }
    };

}

describe("applicationIntegrity", () => {

    test("collects active content-hashed JS and CSS assets from the running page", () => {
        const doc = fakeDocument(
            [
                "css/leaflet.css",
                "css/chargy.a1b2c3d4e5f6.css",
                "https://evil.example/css/chargy.deadbeef1234.css"
            ],
            [
                "chargyWebApp-bundle.0123456789ab.js",
                "https://cdn.example/chargyWebApp-bundle.ffffffffffff.js"
            ]
        );

        expect(collectApplicationIntegrityAssets(doc, "https://chargy.charging.cloud/")).toEqual([
            "https://chargy.charging.cloud/index.html",
            "https://chargy.charging.cloud/css/chargy.a1b2c3d4e5f6.css",
            "https://chargy.charging.cloud/chargyWebApp-bundle.0123456789ab.js"
        ]);
    });

    test("supports unhashed development builds and subdirectory deployments", () => {
        const doc = fakeDocument(
            [ "css/chargy.css?v=1", "css/chargy.css" ],
            [ "chargyWebApp-bundle.js" ]
        );

        expect(collectApplicationIntegrityAssets(doc, "https://example.org/apps/chargy/index.html?verify=abc")).toEqual([
            "https://example.org/apps/chargy/index.html",
            "https://example.org/apps/chargy/css/chargy.css",
            "https://example.org/apps/chargy/chargyWebApp-bundle.js"
        ]);
    });

    test("distinguishes content-hashed assets from unhashed entry files", () => {
        expect(isContentHashedAsset("https://chargy.charging.cloud/chargyWebApp-bundle.a1b2c3d4e5f6.js")).toBe(true);
        expect(isContentHashedAsset("https://chargy.charging.cloud/css/chargy.0123456789ab.css")).toBe(true);
        expect(isContentHashedAsset("https://chargy.charging.cloud/index.html")).toBe(false);
        expect(isContentHashedAsset("https://chargy.charging.cloud/chargyWebApp-bundle.js")).toBe(false);
        expect(isContentHashedAsset("https://chargy.charging.cloud/css/chargy.css")).toBe(false);
    });

    test("computes combined SHA-512 and revalidates unhashed entry files with no-cache", async () => {
        const seenRequests: Array<{ url: string; cache: RequestCache | undefined; credentials: RequestCredentials | undefined }> = [];
        const files = new Map<string, string>([
            [ "https://chargy.charging.cloud/index.html", "<html>index</html>" ],
            [ "https://chargy.charging.cloud/css/chargy.a1b2c3d4e5f6.css", "body{color:black}" ],
            [ "https://chargy.charging.cloud/chargyWebApp-bundle.0123456789ab.js", "console.log('ok');" ]
        ]);

        const fakeFetch: typeof fetch = async (input, init): Promise<Response> => {
            await Promise.resolve();
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            seenRequests.push({ url, cache: init?.cache, credentials: init?.credentials });
            const body = files.get(url);
            if (body === undefined)
                return new Response("Not found", { status: 404 });
            return new Response(body, { status: 200 });
        };

        const urls = [ ...files.keys() ];
        const digest = await computeApplicationSHA512(urls, fakeFetch);

        expect(digest).toMatch(/^[0-9a-f]{128}$/);
        expect(seenRequests).toEqual([
            { url: "https://chargy.charging.cloud/index.html", cache: "no-cache", credentials: "same-origin" },
            { url: "https://chargy.charging.cloud/css/chargy.a1b2c3d4e5f6.css", cache: "default", credentials: "same-origin" },
            { url: "https://chargy.charging.cloud/chargyWebApp-bundle.0123456789ab.js", cache: "default", credentials: "same-origin" }
        ]);

        // Deterministic across repeated runs and sensitive to any byte change.
        expect(await computeApplicationSHA512(urls, fakeFetch)).toBe(digest);
        files.set("https://chargy.charging.cloud/chargyWebApp-bundle.0123456789ab.js", "console.log('changed');");
        expect(await computeApplicationSHA512(urls, fakeFetch)).not.toBe(digest);
    });

    test("fails explicitly instead of hashing empty bytes when an asset cannot be fetched", async () => {
        const failingFetch: typeof fetch = async (): Promise<Response> => {
            await Promise.resolve();
            return new Response("missing", { status: 404 });
        };

        await expect(
            computeApplicationSHA512([ "https://chargy.charging.cloud/index.html" ], failingFetch)
        ).rejects.toThrow("HTTP 404");

        await expect(computeApplicationSHA512([], failingFetch)).rejects.toThrow();
    });

    test("normalizes, matches, formats hashes and joins version URLs cleanly", () => {
        expect(normalizeSHA512("0xABCD ef01 2345")).toBe("abcdef012345");
        expect(hashesMatch("abcdef012345", "0xABCD ef01 2345")).toBe(true);
        expect(hashesMatch("abcdef012345", "0x0000")).toBe(false);
        expect(hashesMatch("", "")).toBe(false);
        expect(hashesMatch("abcdef", undefined)).toBe(false);
        expect(formatSHA512Groups("0123456789abcdef")).toBe("01234567 89abcdef");
        expect(buildVersionInfoURL("https://chargy.charging.cloud/apps/web/versions/", "1.4.7"))
            .toBe("https://chargy.charging.cloud/apps/web/versions/1.4.7");
        expect(buildVersionInfoURL("https://chargy.charging.cloud/apps/web/versions", "1.4.7"))
            .toBe("https://chargy.charging.cloud/apps/web/versions/1.4.7");
    });

});
