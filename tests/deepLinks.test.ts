import { describe, expect, test } from "vitest";

import {
    decodeBase64Url,
    decodeUtf8,
    findExternalURLRule,
    getDeepLinkFileName,
    parseExternalURLConfig,
    readResponseWithinLimit,
    withDeepLinkVerificationToken
} from "../src/ts/deepLinks";

describe("Deep link helpers", () => {

    test("decodes standard Base64 and Base64URL payloads", () => {

        expect(decodeUtf8(decodeBase64Url("eyJoZWxsbyI6IndvcmxkIn0="))).toBe('{"hello":"world"}');
        expect(decodeUtf8(decodeBase64Url("SGVsbG8td29ybGQ"))).toBe("Hello-world");

    });

    test("parses external URL allowlist config", () => {

        const rules = parseExternalURLConfig(`
            # comments and blank lines are ignored
            https://api.example.org/ctrs/ 100
            http://localhost:8080/data/ 1.5
            ftp://api.example.org/nope/ 100
            https://api.example.org/bad-size/ nope
        `);

        expect(rules).toEqual([
            {
                prefix:          "https://api.example.org/ctrs/",
                maxPayloadBytes: 102400
            },
            {
                prefix:          "http://localhost:8080/data/",
                maxPayloadBytes: 1536
            }
        ]);

    });

    test("matches verifyURL only below configured prefixes", () => {

        const rules = parseExternalURLConfig("https://api.example.org/ctrs/ 100");

        expect(findExternalURLRule(new URL("https://api.example.org/ctrs/12345.json"), rules)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://api.example.org/other/12345.json"), rules)).toBeNull();

    });

    test("merges query token into external download URL", () => {

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json"),
                "abc123"
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?token=abc123");

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json?format=chargy"),
                "abc123"
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?format=chargy&token=abc123");

    });

    test("keeps existing URL when no query token was provided", () => {

        expect(
            withDeepLinkVerificationToken(
                new URL("https://api.example.org/ctrs/12345.json?format=chargy"),
                null
            ).href
        ).toBe("https://api.example.org/ctrs/12345.json?format=chargy");

    });

    test("derives useful file names from URL path or content type", () => {

        expect(getDeepLinkFileName(new URL("https://api.example.org/ctrs/12345.json"), "application/json")).toBe("12345.json");
        expect(getDeepLinkFileName(new URL("https://api.example.org/ctrs/12345"), "application/xml")).toBe("12345");

    });

    test("rejects external URLs pointing at directories", () => {

        expect(() => getDeepLinkFileName(new URL("https://api.example.org/ctrs/"), "application/xml")).toThrow("must reference a file");

    });

    test("rejects responses whose Content-Length exceeds configured limit", async () => {

        const response = new Response("ok", {
            headers: {
                "content-length": "101"
            }
        });

        await expect(readResponseWithinLimit(response, 100)).rejects.toThrow("exceeds configured limit");

    });

    test("reads response body within configured limit", async () => {

        const response = new Response("hello");
        const data     = await readResponseWithinLimit(response, 10);

        expect(decodeUtf8(data)).toBe("hello");

    });

    test("aborts streamed responses when configured limit is exceeded", async () => {

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("hello"));
                controller.enqueue(new TextEncoder().encode("world"));
                controller.close();
            }
        });

        const response = new Response(stream);

        await expect(readResponseWithinLimit(response, 9)).rejects.toThrow("exceeds configured limit");

    });

});
