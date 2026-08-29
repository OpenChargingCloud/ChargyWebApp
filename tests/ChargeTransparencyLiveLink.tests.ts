import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

import type {
    IChargeTransparencyLiveLink,
    IFileInfo
} from "@open-charging-cloud/chargy-core";
import {
    Chargy,
    IsAChargeTransparencyLiveLink,
    IsAChargeTransparencyRecord
} from "@open-charging-cloud/chargy-core";
import coreI18n  from "@open-charging-cloud/chargy-core/i18n.json";
import localI18n from "../src/i18n.json";
import {
    createTestChargy,
    mergeI18NDictionaries,
    parseJSONRecord
} from "./chargyTestRuntime";

vi.stubGlobal("window", {
    navigator: {
        language: "en"
    }
});

const currentDirectory = fileURLToPath(new URL(".",  import.meta.url));
type DetectionResult   = ReturnType<Chargy["DetectAndConvertContentFormat"]>;

function readFixture(fileName: string): string {
    return readFileSync(join(currentDirectory, "fixtures", fileName), "utf8").trim();
}

function createChargy(): Chargy {
    return createTestChargy(Chargy, { i18n: mergeI18NDictionaries(coreI18n, localI18n) });
}

function readLiveLink(fileName: string): IChargeTransparencyLiveLink {

    const liveLink = parseJSONRecord(readFixture(fileName));

    if (!IsAChargeTransparencyLiveLink(liveLink))
        throw new Error("'" + fileName + "' is not a charge transparency live link!");

    return liveLink;

}

async function verifyChargeTransparencyLiveLink(fileName: string): DetectionResult {

    const fileInfo: IFileInfo = {
        name: fileName,
        type: "application/json",
        data: new TextEncoder().encode(readFixture(fileName))
    };

    return createChargy().DetectAndConvertContentFormat([ fileInfo ]);

}

describe("Charge Transparency LiveLink", () => {

    test("recognizes live links by their JSON-LD context", () => {

        const liveLink = parseJSONRecord(readFixture("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json"));

        expect(IsAChargeTransparencyLiveLink(liveLink)).toBe(true);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, "@context": "https://example.com/other" })).toBe(false);
        expect(IsAChargeTransparencyLiveLink({ ...liveLink, liveTransports: [ { type: "ftp", url: "https://example.com" } ] })).toBe(false);
        expect(IsAChargeTransparencyLiveLink(undefined)).toBe(false);

    });

    test("stays a live link, whether it carries meter values or not", async () => {

        // A live link describes a charging session that is still running, a
        // charge transparency record a collection of finished ones. Carrying
        // meter values does not turn the one into the other: the application
        // shows the live link on the left and its meter values on the right.
        const withMeterValues    = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json");

        expect(IsAChargeTransparencyLiveLink(withMeterValues)).toBe(true);
        expect(IsAChargeTransparencyRecord  (withMeterValues)).toBe(false);

        const withoutMeterValues = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0000.json");

        expect(IsAChargeTransparencyLiveLink(withoutMeterValues)).toBe(true);

        if (IsAChargeTransparencyLiveLink(withoutMeterValues))
        {
            expect(withoutMeterValues.created).toBe("2026-08-28T11:59:59Z");
            expect(withoutMeterValues.liveTransports).toHaveLength(3);
        }

    });

    test("parses the signed meter values of a live link into a verified CTR", async () => {

        const ctr = await createChargy().TryToParseLiveLinkMeterValues(
                              readLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_1.json")
                          );

        expect(IsAChargeTransparencyRecord(ctr)).toBe(true);

        expect(ctr?.chargingSessions).toHaveLength(1);

        const chargingSession = ctr?.chargingSessions?.[0];

        expect(chargingSession?.EVSEId).toBe("DE*GEF*E12345678*1");
        expect(chargingSession?.measurements).toHaveLength(1);

        const measurement = chargingSession?.measurements?.[0];

        // 19 OCMF documents, but the end document repeats the start value.
        expect(measurement?.name).toBe("ENERGY_TOTAL");
        expect(measurement?.values).toHaveLength(20);

        // The live link carries the public keys, so unlike a bare OCMF file
        // every meter value can actually be verified here.
        for (const measurementValue of measurement?.values ?? [])
            expect(measurementValue.result?.status).toBe("ValidSignature");

    });

    test("reports no meter values for a live link that has none yet", async () => {

        const ctr = await createChargy().TryToParseLiveLinkMeterValues(
                              readLiveLink("ChargeTransparencyLive/OCMF-Test-01/OCMF-Test-01__0000.json")
                          );

        expect(ctr).toBeUndefined();

    });

    test("adds the current UTC timestamp when a live link has none", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-13T10:11:12.000Z"));

        try
        {
            const report = await verifyChargeTransparencyLiveLink("ChargeTransparencyLive/ChargeTransparencyLiveLink_2.json");

            expect(IsAChargeTransparencyLiveLink(report)).toBe(true);

            if (IsAChargeTransparencyLiveLink(report))
                expect(report.created).toBe("2026-06-13T10:11:12.000Z");
        }
        finally
        {
            vi.useRealTimers();
        }
    });

});
