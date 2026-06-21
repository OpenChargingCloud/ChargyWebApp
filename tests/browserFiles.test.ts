import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
    browserFileTypeFromName,
    normalizeDroppedSVGImageData
} from "../src/ts/browserFiles";

describe("browser file helpers", () => {

    test("uses the file extension when a dropped SVG has no browser MIME type", () => {

        expect(browserFileTypeFromName("ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg", "")).toBe("image/svg+xml");

    });

    test("adds explicit SVG dimensions from the viewBox for browser QR decoding", () => {

        const svgData = readFileSync(
            new URL("fixtures/ALFEN/ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg", import.meta.url)
        );

        const normalizedData = normalizeDroppedSVGImageData(
            "ALFEN-Testdata-03_SAFEXMLContainer_asQRCode.svg",
            "",
            new Uint8Array(svgData).buffer
        );

        const normalizedSVG = new TextDecoder().decode(normalizedData);

        expect(normalizedSVG).toContain("width=\"101\"");
        expect(normalizedSVG).toContain("height=\"101\"");

    });

});
