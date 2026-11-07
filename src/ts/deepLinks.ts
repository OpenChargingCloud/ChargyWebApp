export type ExternalURLRule = {
    prefix:           string;
    maxPayloadBytes:  number;
};

/**
 * How a live link's transport URLs that no prefix covers are treated.
 *
 * "open"   (the default): an uncovered origin is offered to the user, once per
 *          origin, remembered - trust on first use.
 * "strict": an uncovered origin is never offered and never polled. Only the
 *          prefixes below and the installation's own origin are reloaded. A
 *          self-hosting operator that lists its own servers here wants this, so
 *          its drivers are never asked a trust question they cannot judge.
 *
 * Set with a directive line `mode strict` (or `mode open`) anywhere in
 * externalURLs.conf; the last one wins, and an unknown mode leaves the default.
 * This does not touch the deep-link "verifyURL" path, which always requires a
 * prefix and never shows a dialog regardless of the mode.
 */
export type ExternalURLMode = "open" | "strict";

export function parseExternalURLConfigMode(configText: string): ExternalURLMode
{

    let mode: ExternalURLMode = "open";

    for (const rawLine of configText.split(/\r?\n/))
    {

        const line = rawLine.trim();

        if (line === "" || line.startsWith("#"))
            continue;

        const parts = line.split(/\s+/);

        if (parts[0] !== "mode")
            continue;

        if (parts[1] === "strict" || parts[1] === "open")
            mode = parts[1];

    }

    return mode;

}

export function parseExternalURLConfig(configText: string): ExternalURLRule[]
{

    return configText.
        split(/\r?\n/).
        map(line => line.trim()).
        filter(line => line !== "" && !line.startsWith("#")).
        map(line => {

            const parts              = line.split(/\s+/);
            const prefix             = parts[0] ?? "";
            const maxPayloadKBytes   = Number(parts[1]);

            if (!Number.isFinite(maxPayloadKBytes) ||
                maxPayloadKBytes <= 0)
            {
                return null;
            }

            try
            {

                const prefixURL = new URL(prefix);

                if (prefixURL.protocol !== "https:" &&
                    prefixURL.protocol !== "http:")
                {
                    return null;
                }

                return {
                    prefix:           prefixURL.href,
                    maxPayloadBytes:  Math.floor(maxPayloadKBytes * 1024)
                };

            }
            catch
            {
                return null;
            }

        }).
        filter((rule): rule is ExternalURLRule => rule != null);

}

/**
 * Whether a URL lies within a URL prefix.
 *
 * A lexical startsWith() alone would let a prefix of "https://host/api" also
 * cover "https://host/apievil". The match therefore has to end at a component
 * boundary: either the prefix itself ends with one, or the URL continues with
 * one ("/" for a deeper path, "?" for a query, "#" for a fragment).
 */
export function isWithinURLPrefix(href:   string,
                                  prefix: string): boolean
{

    if (!href.startsWith(prefix))
        return false;

    if (href.length === prefix.length || prefix.endsWith("/"))
        return true;

    const boundary = href.charAt(prefix.length);

    return boundary === "/" ||
           boundary === "?" ||
           boundary === "#";

}

/**
 * Whether a URL that gained a query parameter still lies within a URL prefix.
 *
 * Chargy appends parameters to URLs it has already matched against a prefix:
 * the deep link's "token", and a live link's "lastUpdated" timestamp. The
 * result has to stay within that prefix - but a prefix may itself end inside a
 * query string ("https://host/ctrs?format=chargy"), and there the next
 * parameter follows an "&", which is that component's boundary just as "/" is
 * inside a path. Outside a query an "&" is an ordinary path character, so it
 * only counts once the prefix carries a "?"; otherwise a prefix of
 * "https://host/api" would cover "https://host/api&evil" again.
 */
export function isWithinURLPrefixAfterQueryAppend(href:   string,
                                                  prefix: string): boolean
{

    if (isWithinURLPrefix(href, prefix))
        return true;

    return prefix.includes("?") &&
           href.startsWith(prefix) &&
           href.charAt(prefix.length) === "&";

}

export function findExternalURLRule(verifyURL: URL,
                                    rules:     ExternalURLRule[]): ExternalURLRule|null
{

    return rules.find(rule => isWithinURLPrefix(verifyURL.href, rule.prefix)) ?? null;

}

export function withDeepLinkVerificationToken(verifyURL: URL,
                                              token:     string|null): URL
{

    const downloadURL = new URL(verifyURL.href);

    if (token != null)
        downloadURL.searchParams.set("token", token);

    return downloadURL;

}

/**
 * HTTP Basic Auth credentials that arrived as "user:password@" inside a
 * deep-link verifyURL.
 *
 * This is meant as an easy way in - for a test system, or a backend that
 * knows nothing else yet. The credentials are long-lived and travel inside a
 * link that can be forwarded, printed as a QR code or stored in a browser
 * history, so short-lived, payload-scoped "token" or "bearerToken" values are
 * what Chargy recommends.
 */
export type DeepLinkBasicAuth = {
    username:  string;
    password:  string;
};

/**
 * Separates the credentials of a verifyURL from the URL itself.
 *
 * fetch() refuses a URL that carries credentials, and a URL with
 * "user:password@" would never match an allowed prefix either. The returned
 * URL is therefore the one to vet, download and show; the credentials only go
 * into the Authorization header.
 */
export function splitDeepLinkCredentials(verifyURL: URL): { url: URL, basicAuth: DeepLinkBasicAuth|null }
{

    const url = new URL(verifyURL.href);

    if (url.username === "" &&
        url.password === "")
    {
        return { url, basicAuth: null };
    }

    let username: string;
    let password: string;

    try
    {
        username = decodeURIComponent(url.username);
        password = decodeURIComponent(url.password);
    }
    catch
    {
        throw new Error("External verification URL credentials are not validly percent-encoded.");
    }

    // RFC 7617 separates user-id and password at the first colon, so a user
    // name with a colon would reach the server as a different user.
    if (username.includes(":"))
        throw new Error("External verification URL user name must not contain a colon.");

    url.username = "";
    url.password = "";

    return {
        url,
        basicAuth: { username, password }
    };

}

/**
 * The Authorization header value of HTTP Basic Auth (RFC 7617), with user
 * name and password encoded as UTF-8 - btoa() alone would throw on anything
 * beyond Latin-1.
 */
export function basicAuthorizationHeader(credentials: DeepLinkBasicAuth): string
{

    const bytes = new TextEncoder().encode(credentials.username + ":" + credentials.password);
    let binary  = "";

    for (const byte of bytes)
        binary += String.fromCharCode(byte);

    return "Basic " + btoa(binary);

}

/**
 * The address of this page without the secrets of a deep link, or null when
 * it carries none.
 *
 * "token" and "bearerToken" are removed, and the credentials inside a
 * "verifyURL" (or "verifyUrl") are stripped from it. Everything else stays, so
 * a link without secrets still works after a reload. Chargy writes the result
 * back with history.replaceState() once it has read the parameters, so the
 * secrets do not stay in the address bar, the browser history or a bookmark.
 */
export function withoutDeepLinkSecrets(pageURL: URL): URL|null
{

    const cleanedURL = new URL(pageURL.href);
    const parameters = cleanedURL.searchParams;
    let   changed    = false;

    for (const secretParameter of [ "token", "bearerToken" ])
    {
        if (parameters.has(secretParameter))
        {
            parameters.delete(secretParameter);
            changed = true;
        }
    }

    for (const verifyURLParameter of [ "verifyURL", "verifyUrl" ])
    {

        const value = parameters.get(verifyURLParameter);

        if (value == null)
            continue;

        let verifyURL: URL;

        try
        {
            verifyURL = new URL(value);
        }
        catch
        {
            continue;
        }

        if (verifyURL.username === "" &&
            verifyURL.password === "")
        {
            continue;
        }

        verifyURL.username = "";
        verifyURL.password = "";

        parameters.set(verifyURLParameter, verifyURL.href);
        changed = true;

    }

    return changed
               ? cleanedURL
               : null;

}

export function decodeBase64Url(base64Value: string): Uint8Array
{

    if (!/^[A-Za-z0-9_-]+$/.test(base64Value) ||
        base64Value.length % 4 === 1)
    {
        throw new Error("Deep-link verification data must use unpadded Base64URL encoding.");
    }

    const normalizedBase64 = base64Value.
        replace(/-/g, "+").
        replace(/_/g, "/");

    const paddedBase64 = normalizedBase64.padEnd(
        normalizedBase64.length + ((4 - normalizedBase64.length % 4) % 4),
        "="
    );

    const binaryString = atob(paddedBase64);
    const bytes        = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index++)
        bytes[index] = binaryString.charCodeAt(index);

    return bytes;

}

export function decodeUtf8(bytes: Uint8Array): string|null
{

    try
    {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch
    {
        return null;
    }

}

export function getDeepLinkFileName(verifyURL: URL,
                                    contentType: string): string
{

    if (verifyURL.pathname.endsWith("/"))
        throw new Error("External verification URL must reference a file.");

    const lastPathSegment = verifyURL.pathname.split("/").filter(segment => segment !== "").pop();

    if (lastPathSegment != null &&
        lastPathSegment.trim() !== "")
    {
        return lastPathSegment;
    }

    if (contentType.includes("json"))
        return "deeplink.json";

    if (contentType.includes("xml"))
        return "deeplink.xml";

    if (contentType.includes("pdf"))
        return "deeplink.pdf";

    if (contentType.includes("svg"))
        return "deeplink.svg";

    return "deeplink.bin";

}

export async function readResponseWithinLimit(response:        Response,
                                              maxPayloadBytes: number): Promise<Uint8Array>
{

    const contentLengthHeader = response.headers.get("content-length");

    if (contentLengthHeader != null)
    {
        const contentLength = Number(contentLengthHeader);

        if (Number.isFinite(contentLength) &&
            contentLength > maxPayloadBytes)
        {
            throw new Error("External verification payload exceeds configured limit.");
        }
    }

    if (response.body == null)
    {
        const data = new Uint8Array(await response.arrayBuffer());

        if (data.byteLength > maxPayloadBytes)
            throw new Error("External verification payload exceeds configured limit.");

        return data;
    }

    const reader = response.body.getReader();
    const chunks = new Array<Uint8Array>();
    let length   = 0;

    try
    {

        for (;;)
        {
            const { done, value } = await reader.read();

            if (done)
                break;

            length += value.byteLength;

            if (length > maxPayloadBytes)
            {
                await reader.cancel();
                throw new Error("External verification payload exceeds configured limit.");
            }

            chunks.push(value);
        }

    }
    finally
    {
        reader.releaseLock();
    }

    const data = new Uint8Array(length);
    let offset = 0;

    for (const chunk of chunks)
    {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return data;

}
