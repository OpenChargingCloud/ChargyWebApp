export type ExternalURLRule = {
    prefix:           string;
    maxPayloadBytes:  number;
};

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

export function findExternalURLRule(verifyURL: URL,
                                    rules:     ExternalURLRule[]): ExternalURLRule|null
{

    return rules.find(rule => verifyURL.href.startsWith(rule.prefix)) ?? null;

}

export function withDeepLinkVerificationToken(verifyURL: URL,
                                              token:     string|null): URL
{

    const downloadURL = new URL(verifyURL.href);

    if (token != null)
        downloadURL.searchParams.set("token", token);

    return downloadURL;

}

export function decodeBase64Url(base64Value: string): Uint8Array
{

    const normalizedBase64 = base64Value.
        trim().
        replace(/-/g, "+").
        replace(/_/g, "/").
        replace(/\s/g, "");

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
