import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test, vi } from 'vitest';
import { Chargy } from '../src/ts/chargy';
import {
    IsAChargeTransparencyRecord,
    isIFileInfo
} from '../src/ts/chargyInterfaces';
import type {
    IChargeTransparencyRecord,
    ICryptoResult,
    IFileInfo,
    IMeasurement,
    IMeasurementValue,
    ISessionCryptoResult
} from '../src/ts/chargyInterfaces';

const require = createRequire(import.meta.url);

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {},
    getDocument: () => {
        throw new Error("PDF fixtures are not supported by this test setup.");
    }
}));

vi.stubGlobal('window', {
    navigator: {
        language: 'en-US'
    }
});

function readFixture(fileName: string): string {
    return readFileSync(new URL("fixtures/" + fileName, import.meta.url), "utf8").trim();
}

function createChargy(): Chargy {

    return new Chargy(
        {},
        "en",
        require("elliptic"),
        require("moment"),
        require("asn1.js"),
        require("base32-decode"),
        () => ""
    );

}

describe('IFileInfo', () => {

    function expectReportLines(summary: string, expected: string) {
        const summaryLines  = summary.split(/\r?\n/);
        const expectedLines = expected.split(/\r?\n/);
        const maxLength     = Math.max(summaryLines.length, expectedLines.length);

        for (let i = 0; i < maxLength; i++)
            expect.soft(summaryLines[i], "verification report line " + (i + 1)).toBe(expectedLines[i]);
    }

    async function expectVerificationReport(inputFixture: string, expectedFixture: string) {

        const input    = readFixture(inputFixture);
        const expected = readFixture(expectedFixture);

        const report   = await verifyChargeData(inputFixture, input);
        const summary  = formatChargeDataVerificationReport(report);

        expectReportLines(summary, expected);

    }

    async function verifyChargeData(fileName: string, input: string): Promise<IChargeTransparencyRecord | ISessionCryptoResult> {

        const fileInfo: IFileInfo = {
            name: fileName,
            type: fileName.endsWith(".chargy") ? "application/chargy" : "application/json",
            data: new TextEncoder().encode(input)
        };

        return await createChargy().DetectAndConvertContentFormat([ fileInfo ]);

    }

    function formatChargeDataVerificationReport(report: IChargeTransparencyRecord | ISessionCryptoResult): string {

        if (!IsAChargeTransparencyRecord(report))
            return [
                "format: session-result",
                "status: " + report.status,
                "message: " + (report.message ?? "")
            ].join("\n");

        const sessions = report.chargingSessions ?? [];
        const lines = [
            "format: ctr",
            "sessions: " + sessions.length
        ];

        for (const [sessionIndex, session] of sessions.entries()) {

            const measurements = session.measurements ?? [];
            const meterId      = session.meterId ?? measurements[0]?.energyMeterId ?? "";

            lines.push("session " + (sessionIndex + 1) + ": " + (session["@id"] ?? ""));
            lines.push("session " + (sessionIndex + 1) + " evseId: " + (session.EVSEId ?? ""));
            lines.push("session " + (sessionIndex + 1) + " meterId: " + meterId);
            lines.push("session " + (sessionIndex + 1) + " status: " + (session.verificationResult?.status ?? "unknown"));
            lines.push("session " + (sessionIndex + 1) + " measurements: " + measurements.length);

            for (const [measurementIndex, measurement] of measurements.entries())
                appendMeasurementLines(lines, sessionIndex + 1, measurementIndex + 1, measurement);

        }

        return lines.join("\n");

    }

    function appendMeasurementLines(lines: string[], sessionNumber: number, measurementNumber: number, measurement: IMeasurement) {

        lines.push("measurement " + sessionNumber + "." + measurementNumber + " name: " + measurement.name);
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " obis: " + measurement.obis);
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " status: " + formatCryptoResult(measurement.verificationResult));
        lines.push("measurement " + sessionNumber + "." + measurementNumber + " values: " + measurement.values.length);

        for (const [valueIndex, value] of measurement.values.entries())
            appendMeasurementValueLines(lines, sessionNumber, measurementNumber, valueIndex + 1, value);

    }

    function appendMeasurementValueLines(lines: string[],
                                         sessionNumber: number,
                                         measurementNumber: number,
                                         valueNumber: number,
                                         value: IMeasurementValue) {

        const prefix = "value " + sessionNumber + "." + measurementNumber + "." + valueNumber;

        lines.push(prefix + " timestamp: " + value.timestamp);
        lines.push(prefix + " value: " + value.value.toString());
        lines.push(prefix + " signatures: " + (value.signatures?.length ?? 0));
        lines.push(prefix + " status: " + formatCryptoResult(value.result));

    }

    function formatCryptoResult(result: ICryptoResult | undefined): string {
        return result?.status ?? "unknown";
    }

    test('accepts browser file payloads backed by ArrayBuffer or Uint8Array', () => {

        expect(isIFileInfo({
            name: 'record.json',
            data: new ArrayBuffer(4)
        })).toBe(true);

        expect(isIFileInfo({
            name: 'clipboard',
            data: new Uint8Array([ 0x7b, 0x7d ])
        })).toBe(true);

    });

    test('rejects malformed file info objects', () => {

        expect(isIFileInfo({ data: new ArrayBuffer(4) })).toBe(false);
        expect(isIFileInfo({ name: 'record.json', data: 'not binary' })).toBe(false);
        expect(isIFileInfo(null)).toBe(false);

    });

    test("chargeIT-Testdatensatz-02", async () => {
        await expectVerificationReport(
            "chargeIT/chargeIT-Testdatensatz-02.chargy",
            "chargeIT/chargeIT-Testdatensatz-02.expected.txt"
        );
    });


});
