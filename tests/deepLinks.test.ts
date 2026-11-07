import { describe, expect, test } from "vitest";

import {
    basicAuthorizationHeader,
    decodeBase64Url,
    decodeUtf8,
    findExternalURLRule,
    getDeepLinkFileName,
    isWithinURLPrefix,
    isWithinURLPrefixAfterQueryAppend,
    parseExternalURLConfig,
    parseExternalURLConfigMode,
    readResponseWithinLimit,
    splitDeepLinkCredentials,
    withDeepLinkVerificationToken,
    withoutDeepLinkSecrets
} from "../src/ts/deepLinks";

describe("Deep link helpers", () => {

    test("decodes unpadded Base64URL payloads", () => {

        expect(decodeUtf8(decodeBase64Url("eyJoZWxsbyI6IndvcmxkIn0"))).toBe('{"hello":"world"}');
        expect(decodeUtf8(decodeBase64Url("SGVsbG8td29ybGQ"))).toBe("Hello-world");
        expect(decodeBase64Url("-_8")).toEqual(new Uint8Array([251, 255]));

    });

    test("rejects standard Base64, padding and whitespace", () => {

        expect(() => decodeBase64Url("+/8=")).toThrow("must use unpadded Base64URL");
        expect(() => decodeBase64Url("eyJoZWxsbyI6IndvcmxkIn0=")).toThrow("must use unpadded Base64URL");
        expect(() => decodeBase64Url(" SGVsbG8td29ybGQ")).toThrow("must use unpadded Base64URL");

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

    test("reads the reload mode, defaulting to open", () => {

        // The mode directive coexists with prefixes and does not become a rule.
        const config = `
            mode strict
            https://api.example.org/ctrs/ 100
        `;

        expect(parseExternalURLConfigMode(config)).toBe("strict");
        expect(parseExternalURLConfig(config)).toEqual([
            { prefix: "https://api.example.org/ctrs/", maxPayloadBytes: 102400 }
        ]);

        expect(parseExternalURLConfigMode("")).toBe("open");
        expect(parseExternalURLConfigMode("https://api.example.org/ctrs/ 100")).toBe("open");
        expect(parseExternalURLConfigMode("mode open")).toBe("open");
        expect(parseExternalURLConfigMode("# mode strict")).toBe("open");   // commented out
        expect(parseExternalURLConfigMode("mode nonsense")).toBe("open");   // unknown value ignored

        // The last directive wins.
        expect(parseExternalURLConfigMode("mode strict\nmode open")).toBe("open");
        expect(parseExternalURLConfigMode("mode open\nmode strict")).toBe("strict");

    });

    test("matches verifyURL only below configured prefixes", () => {

        const rules = parseExternalURLConfig("https://api.example.org/ctrs/ 100");

        expect(findExternalURLRule(new URL("https://api.example.org/ctrs/12345.json"), rules)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://api.example.org/other/12345.json"), rules)).toBeNull();

        // A prefix without a trailing slash still ends at a segment boundary:
        // "/ctrs" may not cover "/ctrsevil".
        const bare = parseExternalURLConfig("https://api.example.org/ctrs 100");

        expect(findExternalURLRule(new URL("https://api.example.org/ctrs/12345.json"), bare)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://api.example.org/ctrsevil/12345.json"), bare)).toBeNull();

    });

    test("prefixes end at component boundaries, not mid-segment", () => {

        expect(isWithinURLPrefix("https://example.com/api",         "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api/live",    "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api?token=1", "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/api#part",    "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/apievil",     "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefix("https://example.com/api.evil/x",  "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefix("https://example.com/api/x",       "https://example.com/api/")).toBe(true);
        expect(isWithinURLPrefix("https://example.com/apix",        "https://example.com/api/")).toBe(false);

    });

    test("an appended query parameter keeps a URL within its prefix", () => {

        // What the deep-link "token" and the live-link "lastUpdated" timestamp
        // do to a URL that was already matched against a prefix.
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api?token=1",  "https://example.com/api")).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api/x?token=1","https://example.com/api/")).toBe(true);

        // A prefix that ends inside a query string is continued by "&".
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api?f=c&token=1", "https://example.com/api?f=c")).toBe(true);
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api?f=c",         "https://example.com/api?f=c")).toBe(true);

        // ... but a pinned query value may not simply be extended.
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api?f=chargyevil", "https://example.com/api?f=chargy")).toBe(false);

        // Outside a query "&" is an ordinary path character and no boundary.
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api&evil",   "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/apievil",    "https://example.com/api")).toBe(false);
        expect(isWithinURLPrefixAfterQueryAppend("https://example.com/api.evil/x", "https://example.com/api")).toBe(false);

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

    test("separates Basic Auth credentials from a verifyURL", () => {

        const { url, basicAuth } = splitDeepLinkCredentials(
            new URL("https://reader:s3cr%40t%3Ax@steve.example.org/steve/api/v1/transactions/1/safe.xml")
        );

        // Percent-encoded "@" and ":" in the password come back as such.
        expect(basicAuth).toEqual({ username: "reader", password: "s3cr@t:x" });
        expect(url.href).toBe("https://steve.example.org/steve/api/v1/transactions/1/safe.xml");

        // Only the URL without credentials can match a prefix.
        const rules = parseExternalURLConfig("https://steve.example.org/steve/api/v1/transactions/ 200");

        expect(findExternalURLRule(url, rules)).not.toBeNull();
        expect(findExternalURLRule(new URL("https://reader:pw@steve.example.org/steve/api/v1/transactions/1/safe.xml"), rules)).toBeNull();

    });

    test("leaves a verifyURL without credentials as it is", () => {

        const verifyURL = new URL("https://api.example.org/ctrs/12345.json?format=chargy");
        const { url, basicAuth } = splitDeepLinkCredentials(verifyURL);

        expect(basicAuth).toBeNull();
        expect(url.href).toBe(verifyURL.href);
        expect(url).not.toBe(verifyURL);

    });

    test("accepts a password without a user name, but no colon in the user name", () => {

        expect(splitDeepLinkCredentials(new URL("https://:pw@api.example.org/a.xml")).basicAuth)
            .toEqual({ username: "", password: "pw" });

        expect(() => splitDeepLinkCredentials(new URL("https://a%3Ab:pw@api.example.org/a.xml")))
            .toThrow("must not contain a colon");

        expect(() => splitDeepLinkCredentials(new URL("https://reader:%E0%A4%A@api.example.org/a.xml")))
            .toThrow("not validly percent-encoded");

    });

    test("encodes the Basic Auth header as UTF-8 (RFC 7617 examples)", () => {

        expect(basicAuthorizationHeader({ username: "Aladdin", password: "open sesame" }))
            .toBe("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");

        expect(basicAuthorizationHeader({ username: "test", password: "123£" }))
            .toBe("Basic dGVzdDoxMjPCow==");

    });

    test("removes deep-link secrets from the page address", () => {

        const pageURL = new URL(
            "https://chargy.example.org/?verifyURL=" +
            encodeURIComponent("https://reader:pw@steve.example.org/steve/api/v1/transactions/1/safe.xml") +
            "&token=abc&bearerToken=xyz&lang=de#top"
        );

        const cleanedURL = withoutDeepLinkSecrets(pageURL);

        expect(cleanedURL).not.toBeNull();
        expect(cleanedURL?.searchParams.get("verifyURL")).toBe("https://steve.example.org/steve/api/v1/transactions/1/safe.xml");
        expect(cleanedURL?.searchParams.has("token")).toBe(false);
        expect(cleanedURL?.searchParams.has("bearerToken")).toBe(false);
        expect(cleanedURL?.searchParams.get("lang")).toBe("de");
        expect(cleanedURL?.hash).toBe("#top");
        expect(cleanedURL?.href).not.toContain("pw");

        // The legacy spelling is cleaned the same way.
        expect(withoutDeepLinkSecrets(new URL("https://chargy.example.org/?verifyUrl=" + encodeURIComponent("https://u:p@h.example.org/a.xml")))?.searchParams.get("verifyUrl"))
            .toBe("https://h.example.org/a.xml");

    });

    test("keeps a page address without deep-link secrets", () => {

        expect(withoutDeepLinkSecrets(new URL("https://chargy.example.org/"))).toBeNull();
        expect(withoutDeepLinkSecrets(new URL("https://chargy.example.org/?verify=eyJ9"))).toBeNull();
        expect(withoutDeepLinkSecrets(new URL("https://chargy.example.org/?verifyURL=" + encodeURIComponent("https://h.example.org/a.xml")))).toBeNull();
        expect(withoutDeepLinkSecrets(new URL("https://chargy.example.org/?verifyURL=not-a-url"))).toBeNull();

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
            start(controller): void {
                controller.enqueue(new TextEncoder().encode("hello"));
                controller.enqueue(new TextEncoder().encode("world"));
                controller.close();
            }
        });

        const response = new Response(stream);

        await expect(readResponseWithinLimit(response, 9)).rejects.toThrow("exceeds configured limit");

    });

});
