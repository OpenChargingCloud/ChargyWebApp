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

// A charge transparency live link names the URLs its live data can be fetched
// from, and the document comes from outside - so those URLs are a trust
// question, not a configuration detail. The installation may pre-answer it in
// externalURLs.conf; for everything else the user is asked once per origin and
// the answer is remembered: trust on first use.
//
// This module holds the parts of that which are plain functions - the shape of
// the remembered decisions and the structural rules a poll target has to
// satisfy before a user is even asked. The dialog and the store live in the
// application.

export type TrustDecision = "allow" | "deny";

export interface ITrustedOrigin {
    decision:  TrustDecision;
    since:     string;
}

/** What the user decided, per origin (scheme + host + port). */
export type TrustedOrigins = Record<string, ITrustedOrigin>;

/**
 * A reloading client can hammer a server no faster than this, whatever the
 * document says: a viral QR code must not turn every phone that scans it
 * into a flood.
 */
export const minimumRefreshSeconds     = 5;

/**
 * And no slower than this. The refresh period is a document-controlled number
 * with no upper bound of its own, and a value large enough to overflow the
 * timer delay wraps back to firing immediately - so a document could turn its
 * own "poll rarely" into "poll as fast as the network answers" through the far
 * end of the range. One day is longer than any charging session and safely
 * inside the timer's integer range.
 */
export const maximumRefreshSeconds     = 24 * 60 * 60;

/**
 * How much a poll answer may weigh when the origin was approved by the user
 * rather than by externalURLs.conf, which states a limit per prefix.
 */
export const defaultTrustedPayloadBytes = 1024 * 1024;

//#region The remembered decisions

/**
 * The stored decisions, tolerantly: anything that is not exactly an entry with
 * a valid decision is dropped rather than trusted by accident, and a store
 * that cannot be parsed at all counts as empty - the user is simply asked
 * again.
 */
export function parseTrustedOrigins(json: string | null): TrustedOrigins {

    if (json == null || json === "")
        return {};

    let parsed: unknown;

    try
    {
        parsed = JSON.parse(json);
    }
    catch
    {
        return {};
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
        return {};

    const origins: TrustedOrigins = {};

    for (const [ origin, entry ] of Object.entries(parsed))
    {

        if (entry === null || typeof entry !== "object")
            continue;

        const decision = (entry as Record<string, unknown>)["decision"];
        const since    = (entry as Record<string, unknown>)["since"];

        if (decision !== "allow" && decision !== "deny")
            continue;

        origins[origin] = {
            decision:  decision,
            since:     typeof since === "string" ? since : ""
        };

    }

    return origins;

}

export function serializeTrustedOrigins(origins: TrustedOrigins): string {
    return JSON.stringify(origins);
}

//#endregion

//#region The structural rules

function ipv4Octets(hostname: string): number[] | null {

    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);

    if (match === null)
        return null;

    const octets = match.slice(1).map(Number);

    return octets.every(octet => octet <= 255)
               ? octets
               : null;

}

/**
 * The dotted-quad an IPv4-carrying IPv6 literal embeds, or null.
 *
 * An IPv4 address hidden inside IPv6 still reaches the same IPv4 host at the
 * socket layer, so it has to be classified as that host, not waved through as
 * an opaque IPv6 address. The WHATWG URL parser serializes the embedded IPv4
 * in hex - "[::ffff:127.0.0.1]" arrives here as "[::ffff:7f00:1]" - so the two
 * trailing hextets are decoded back into octets. Covered forms: IPv4-mapped
 * (::ffff:0:0/96), the deprecated IPv4-compatible (::/96) and NAT64
 * (64:ff9b::/96).
 */
function embeddedIPv4(hostname: string): number[] | null {

    if (!hostname.startsWith("[") || !hostname.endsWith("]"))
        return null;

    const address = hostname.slice(1, -1).toLowerCase();

    // A dotted tail can survive when the leading field is non-zero; take it.
    const dotted  = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(address);

    if (dotted !== null)
        return ipv4Octets(dotted[1] as string);

    const hex = /^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);

    if (hex === null)
        return null;

    const high = parseInt(hex[1] as string, 16);
    const low  = parseInt(hex[2] as string, 16);

    // eslint-disable-next-line no-bitwise
    return [ (high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff ];

}

/** The host of the machine itself. The WHATWG URL parser has already
 *  normalized IPv4 notations, so "127.1" arrives here as "127.0.0.1". */
export function isLoopbackHost(hostname: string): boolean {

    const host = hostname.toLowerCase();

    if (host === "localhost" || host.endsWith(".localhost"))
        return true;

    if (host === "[::1]" || host === "::1" || host === "0.0.0.0")
        return true;

    const octets = ipv4Octets(host) ?? embeddedIPv4(host);

    return octets !== null && octets[0] === 127;

}

/**
 * A host that is not on the public internet: loopback, RFC 1918, link-local
 * and IPv6 unique-local addresses. A public web application must not let a
 * document turn the user's browser into a probe for the network behind their
 * router.
 */
export function isPrivateNetworkHost(hostname: string): boolean {

    if (isLoopbackHost(hostname))
        return true;

    const host   = hostname.toLowerCase();
    const octets = ipv4Octets(host) ?? embeddedIPv4(host);

    if (octets !== null)
    {

        const [ first, second ] = octets as [ number, number, number, number ];

        return first === 10                                        ||
              (first === 172 && second >= 16 && second <= 31)      ||
              (first === 192 && second === 168)                    ||
              (first === 169 && second === 254);

    }

    if (host.startsWith("[") && host.endsWith("]"))
    {

        const address = host.slice(1, -1);

        // fc00::/7 (unique local) and fe80::/10 (link local).
        return address.startsWith("fc")  ||
               address.startsWith("fd")  ||
               address.startsWith("fe8") ||
               address.startsWith("fe9") ||
               address.startsWith("fea") ||
               address.startsWith("feb");

    }

    return false;

}

/**
 * Why this URL must not be polled, or null if it may be - subject to the
 * user's consent, which is the next gate, not this one.
 *
 * An application served from loopback is a developer's, and a developer polls
 * their own machine: for them both rules are waived.
 */
export function pollTargetProblem(url: URL, appIsLoopback: boolean): string | null {

    if (appIsLoopback && isLoopbackHost(url.hostname))
        return null;

    if (url.protocol !== "https:")
        return "only https is polled, not " + url.protocol.replace(":", "");

    if (isPrivateNetworkHost(url.hostname))
        return "the host is not on the public internet";

    return null;

}

//#endregion
