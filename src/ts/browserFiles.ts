export function browserFileTypeFromName(fileName: string,
                                        fileType: string): string {

    const trimmedFileType = fileType.trim();

    if (trimmedFileType !== "")
        return trimmedFileType;

    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.endsWith(".svg"))
        return "image/svg+xml";

    if (lowerFileName.endsWith(".png"))
        return "image/png";

    if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg"))
        return "image/jpeg";

    if (lowerFileName.endsWith(".gif"))
        return "image/gif";

    if (lowerFileName.endsWith(".webp"))
        return "image/webp";

    if (lowerFileName.endsWith(".bmp"))
        return "image/bmp";

    return "";

}

export function normalizeDroppedSVGImageData(fileName: string,
                                             fileType: string,
                                             data:     ArrayBuffer): ArrayBuffer|Uint8Array {

    const lowerFileName = fileName.toLowerCase();

    if (fileType !== "image/svg+xml" && !lowerFileName.endsWith(".svg"))
        return data;

    const svgText = new TextDecoder().decode(data);

    if (!svgText.trimStart().startsWith("<svg") &&
        !svgText.trimStart().startsWith("<?xml"))
    {
        return data;
    }

    const svgTagMatch = svgText.match(/<svg\b[^>]*>/i);

    if (svgTagMatch == null)
        return data;

    const svgTag = svgTagMatch[0];

    if (/\swidth\s*=/.test(svgTag) && /\sheight\s*=/.test(svgTag))
        return data;

    const viewBoxMatch = svgTag.match(/\sviewBox\s*=\s*["']\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*["']/i);

    if (viewBoxMatch == null)
        return data;

    const width  = Number(viewBoxMatch[3]);
    const height = Number(viewBoxMatch[4]);

    if (!Number.isFinite(width)  || width  <= 0 ||
        !Number.isFinite(height) || height <= 0)
    {
        return data;
    }

    const svgTagIndex = svgTagMatch.index;

    if (svgTagIndex == null)
        return data;

    const explicitSize = " width=\"" + width.toString() + "\" height=\"" + height.toString() + "\"";
    const normalized   = svgText.slice(0, svgTagIndex + svgTag.length - 1) +
                         explicitSize +
                         svgText.slice(svgTagIndex + svgTag.length - 1);

    return new TextEncoder().encode(normalized);

}
