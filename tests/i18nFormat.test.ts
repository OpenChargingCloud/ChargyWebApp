import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import coreI18n from "@open-charging-cloud/chargy-core/i18n.json";
import webAppI18n from "../src/i18n.json";
import { formatDuration, formatTimeOfDay } from "../src/ts/i18nFormat";

const intentionallyEmptyInEnglish = new Set([ "fundingProjectOutro" ]);

describe("i18n formatting and completeness", () => {

    test("formats charging and parking durations cleanly in German and English", () => {
        expect(formatDuration(0, "de")).toBe("");
        expect(formatDuration(-5000, "en")).toBe("");

        expect(formatDuration(1_000, "de", "long")).toBe("1 Sekunde");
        expect(formatDuration(45_000, "de", "long")).toBe("45 Sekunden");
        expect(formatDuration(45_000, "de", "compact")).toBe("45 Sek.");
        expect(formatDuration(1_000, "en", "long")).toBe("1 second");
        expect(formatDuration(45_000, "en", "long")).toBe("45 seconds");
        expect(formatDuration(45_000, "en", "compact")).toBe("45 s");

        expect(formatDuration(61_000, "de", "long")).toBe("1 Minute 1 Sekunde");
        expect(formatDuration(125_000, "de", "long")).toBe("2 Minuten 5 Sekunden");
        expect(formatDuration(125_000, "de", "compact")).toBe("2 Min. 5 Sek.");
        expect(formatDuration(61_000, "en", "long")).toBe("1 minute 1 second");
        expect(formatDuration(125_000, "en", "long")).toBe("2 minutes 5 seconds");
        expect(formatDuration(125_000, "en", "compact")).toBe("2 min 5 s");

        expect(formatDuration(3_723_000, "de")).toBe("1 Std. 2 Min. 3 Sek.");
        expect(formatDuration(3_723_000, "en")).toBe("1 h 2 min 3 s");

        expect(formatDuration(90_061_000, "de")).toBe("1 Tag 1 Std. 1 Min. 1 Sek.");
        expect(formatDuration(90_061_000, "en")).toBe("1 day 1 h 1 min 1 s");

        expect(formatDuration(180_122_000, "de")).toBe("2 Tage 2 Std. 2 Min. 2 Sek.");
        expect(formatDuration(180_122_000, "en")).toBe("2 days 2 h 2 min 2 s");
    });

    test("formats time-of-day with German Uhr suffix only in German", () => {
        expect(formatTimeOfDay("14:30:05", "de")).toBe("14:30:05 Uhr");
        expect(formatTimeOfDay("14:30:05", "en")).toBe("14:30:05");
    });

    test("every key in src/i18n.json defines both German and English translations", () => {
        const entries = Object.entries(webAppI18n as Record<string, Record<string, unknown>>);
        expect(entries.length).toBeGreaterThan(0);

        for (const [ key, value ] of entries)
        {
            expect(typeof value["de"], `${key}.de`).toBe("string");
            expect(typeof value["en"], `${key}.en`).toBe("string");
            expect((value["de"] as string).length, `${key}.de non-empty`).toBeGreaterThan(0);
            if (!intentionallyEmptyInEnglish.has(key))
                expect((value["en"] as string).length, `${key}.en non-empty`).toBeGreaterThan(0);
        }
    });

    test("every data-i18n-* key in src/index.html exists in the merged i18n dictionary", () => {
        const html = fs.readFileSync(path.resolve("src/index.html"), "utf8");
        const dictionary: Record<string, unknown> = {
            ...(coreI18n as Record<string, unknown>),
            ...(webAppI18n as Record<string, unknown>)
        };

        const attrPattern = /data-i18n(?:-(?:title|aria-label|placeholder))?-key="([^"]+)"/g;
        const referencedKeys = new Set<string>();
        for (const match of html.matchAll(attrPattern))
        {
            const key = match[1];
            if (key !== undefined)
                referencedKeys.add(key);
        }

        expect(referencedKeys.size).toBeGreaterThan(40);
        const missing = [ ...referencedKeys ].filter(key => !(key in dictionary));
        expect(missing).toEqual([]);
    });

});
