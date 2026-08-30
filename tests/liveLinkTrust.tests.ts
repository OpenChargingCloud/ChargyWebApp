import { describe, expect, test } from "vitest";

import {
    isLoopbackHost,
    isPrivateNetworkHost,
    maximumRefreshSeconds,
    minimumRefreshSeconds,
    parseTrustedOrigins,
    pollTargetProblem,
    serializeTrustedOrigins
} from "../src/ts/liveLinkTrust";

describe("Live link trust", () => {

    //#region The remembered decisions

    test("round-trips remembered decisions", () => {

        const origins = {
            "https://api1.example.com": { decision: "allow" as const, since: "2026-08-29T08:00:00Z" },
            "https://tracker.example":  { decision: "deny"  as const, since: "2026-08-29T08:01:00Z" }
        };

        expect(parseTrustedOrigins(serializeTrustedOrigins(origins))).toEqual(origins);

    });

    test("treats an unreadable store as empty instead of trusting it", () => {

        expect(parseTrustedOrigins(null)).toEqual({});
        expect(parseTrustedOrigins("")).toEqual({});
        expect(parseTrustedOrigins("not json at all")).toEqual({});
        expect(parseTrustedOrigins("[ 1, 2, 3 ]")).toEqual({});
        expect(parseTrustedOrigins("42")).toEqual({});

    });

    test("drops malformed entries rather than trusting them by accident", () => {

        const parsed = parseTrustedOrigins(JSON.stringify({
            "https://good.example":    { decision: "allow", since: "2026-08-29T08:00:00Z" },
            "https://weird.example":   { decision: "maybe", since: "2026-08-29T08:00:00Z" },
            "https://broken.example":  "allow",
            "https://dateless.example": { decision: "deny" }
        }));

        expect(Object.keys(parsed).sort()).toEqual([
            "https://dateless.example",
            "https://good.example"
        ]);

        // A missing timestamp is tolerated, an invalid decision is not.
        expect(parsed["https://dateless.example"]?.decision).toBe("deny");
        expect(parsed["https://dateless.example"]?.since).toBe("");

    });

    //#endregion

    //#region Loopback and private networks

    test("recognizes loopback hosts", () => {

        for (const host of [ "localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "127.255.0.1", "[::1]", "0.0.0.0" ])
            expect(isLoopbackHost(host), host).toBe(true);

        for (const host of [ "example.com", "127.0.0.1.example.com", "128.0.0.1", "notlocalhost" ])
            expect(isLoopbackHost(host), host).toBe(false);

    });

    test("recognizes hosts that are not on the public internet", () => {

        for (const host of [ "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1",
                             "169.254.169.254", "[fd00::1]", "[fc00::1]", "[fe80::1]", "localhost" ])
            expect(isPrivateNetworkHost(host), host).toBe(true);

        for (const host of [ "8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.0.1",
                             "example.com", "[2001:db8::1]" ])
            expect(isPrivateNetworkHost(host), host).toBe(false);

    });

    test("sees through IPv4 hidden inside an IPv6 literal", () => {

        // The forms the URL parser produces from [::ffff:192.168.1.1] etc.
        const privateHex = {
            "[::ffff:c0a8:101]":   "192.168.1.1 mapped",
            "[::ffff:a00:1]":      "10.0.0.1 mapped",
            "[::ffff:a9fe:a9fe]":  "169.254.169.254 mapped (cloud metadata)",
            "[::ffff:7f00:1]":     "127.0.0.1 mapped",
            "[::7f00:1]":          "127.0.0.1 compatible",
            "[64:ff9b::c0a8:101]": "192.168.1.1 via NAT64"
        };

        for (const [ host, what ] of Object.entries(privateHex))
            expect(isPrivateNetworkHost(host), what).toBe(true);

        // Loopback in disguise is loopback.
        expect(isLoopbackHost("[::ffff:7f00:1]")).toBe(true);
        expect(isLoopbackHost("[::7f00:1]")).toBe(true);

        // A mapped PUBLIC address stays public, and a genuine global IPv6 is
        // not misread as carrying a private IPv4.
        expect(isPrivateNetworkHost("[::ffff:808:808]")).toBe(false); // 8.8.8.8 mapped
        expect(isPrivateNetworkHost("[2001:db8::1]")).toBe(false);
        expect(pollTargetProblem(new URL("https://[::ffff:169.254.169.254]/live"), false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://[::ffff:192.168.1.1]/live"),     false)).not.toBeNull();

    });

    //#endregion

    //#region The structural poll rules

    test("polls only https on the public internet", () => {

        expect(pollTargetProblem(new URL("https://api.example.com/live"),   false)).toBeNull();
        expect(pollTargetProblem(new URL("http://api.example.com/live"),    false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://192.168.1.1/live"),       false)).not.toBeNull();
        expect(pollTargetProblem(new URL("https://[fd00::1]/live"),         false)).not.toBeNull();

    });

    test("waives both rules for a developer polling their own machine", () => {

        expect(pollTargetProblem(new URL("http://localhost:1608/live.json"),  true)).toBeNull();
        expect(pollTargetProblem(new URL("https://127.0.0.1:8443/live"),      true)).toBeNull();

        // ... but only for loopback targets: a document loaded into a
        // developer's browser still must not probe the developer's LAN.
        expect(pollTargetProblem(new URL("https://192.168.1.1/live"),         true)).not.toBeNull();
        expect(pollTargetProblem(new URL("http://api.example.com/live"),      true)).not.toBeNull();

    });

    test("the WHATWG URL parser normalizes IPv4 tricks before the rules run", () => {

        // "0x7f.1" and "127.1" are loopback in disguise; new URL() unmasks
        // them, so the hostname the rules see is already canonical.
        expect(new URL("https://0x7f.0.0.1/").hostname).toBe("127.0.0.1");
        expect(new URL("https://127.1/").hostname).toBe("127.0.0.1");
        expect(pollTargetProblem(new URL("https://127.1/"), false)).not.toBeNull();

    });

    test("enforces a floor and a ceiling on the refresh period", () => {

        expect(minimumRefreshSeconds).toBeGreaterThanOrEqual(5);

        // The ceiling exists so a huge document value cannot overflow the timer
        // delay into an immediate, back-to-back loop, and stays inside the
        // signed-32-bit millisecond range setTimeout accepts.
        expect(maximumRefreshSeconds).toBeGreaterThan(minimumRefreshSeconds);
        expect(maximumRefreshSeconds * 1000).toBeLessThan(2 ** 31 - 1);

        const clamp = (refresh: number): number =>
            Math.min(Math.max(refresh, minimumRefreshSeconds), maximumRefreshSeconds);

        expect(clamp(1)).toBe(minimumRefreshSeconds);
        expect(clamp(1e309)).toBe(maximumRefreshSeconds);   // 1e309 parses to Infinity
        expect(clamp(1e308)).toBe(maximumRefreshSeconds);
        expect(clamp(600)).toBe(600);

    });

    //#endregion

});
