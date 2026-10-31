import { TrustAnchor, TRUST_ANCHOR_QR_PREFIX } from '@open-charging-cloud/wwcp-poi';

export interface TrustAnchorPreview {
    readonly anchor: TrustAnchor;
    readonly text: string;
}

export type TrustAnchorCheckState = "valid" | "invalid" | "unavailable";

/** Results supplied by a verifier, independently of the scanned document. */
export interface TrustAnchorValidation {
    readonly signatures: TrustAnchorCheckState;
    readonly signers: TrustAnchorCheckState;
    readonly quorum: TrustAnchorCheckState;
}

export interface TrustAnchorPreviewOptions {
    readonly isImported?: boolean;
    readonly busy?: boolean;
    readonly activeTrustedKeyCount?: number;
    readonly onImport?: () => void;
    readonly onDiscard?: () => void;
}

// TA-2 has no anchor signatures. Key pins and their count are not verification results.
const unsignedAnchorValidation: TrustAnchorValidation = {
    signatures: "unavailable",
    signers: "unavailable",
    quorum: "unavailable"
};

export type ScannedTrustAnchor =
    | { readonly kind: "other" }
    | { readonly kind: "invalid"; readonly message: string }
    | { readonly kind: "anchor"; readonly preview: TrustAnchorPreview };

/** Recognize the two QR representations without following URLs or establishing trust. */
export function parseScannedTrustAnchor(text: string): ScannedTrustAnchor {
    const trimmed = text.trim();
    let candidate = trimmed.startsWith(TRUST_ANCHOR_QR_PREFIX);

    if (!candidate) {
        try {
            const url = new URL(trimmed);
            candidate = (url.protocol === "https:" || url.protocol === "http:") &&
                        url.pathname.replace(/\/+$/, "").split("/").at(-2) === "RNs" &&
                        url.searchParams.has("keys");
        }
        catch {
            return { kind: "other" };
        }
    }

    if (!candidate)
        return { kind: "other" };

    try {
        return { kind: "anchor", preview: { anchor: TrustAnchor.parse(trimmed), text: trimmed } };
    }
    catch (error) {
        return { kind: "invalid", message: error instanceof Error ? error.message : String(error) };
    }
}

/** All three checks must pass before the whole field receives the success appearance. */
export function renderTrustAnchorValidation(result: TrustAnchorValidation,
                                            localize: (key: string) => string,
                                            activeTrustedKeyCount: number = 0,
                                            unavailableReason?: string): HTMLElement {
    const validation = document.createElement("section");
    validation.className = "trustAnchorValidation";
    const states = [ result.signatures, result.signers, result.quorum ];
    const allValid = states.every(state => state === "valid");
    validation.dataset["state"] = allValid ? "valid" : states.includes("invalid") ? "invalid" : "unavailable";
    validation.setAttribute("aria-labelledby", "trustAnchorValidationTitle");
    const validationTitle = validation.appendChild(document.createElement("h3"));
    validationTitle.id = "trustAnchorValidationTitle";
    validationTitle.textContent = localize("trustAnchorValidationTitle");
    if (allValid) {
        const icon = document.createElement("i");
        icon.className = "fas fa-check-circle trustAnchorValidationSuccessIcon";
        icon.setAttribute("aria-hidden", "true");
        validationTitle.prepend(icon, document.createTextNode(" "));
    }

    const checks = [
        { id: "signatures", state: result.signatures, label: "trustAnchorSignaturesValid", reason: "trustAnchorNoSignatures" },
        { id: "signers", state: result.signers, label: "trustAnchorSignersTrusted", reason: "trustAnchorSignersNotCheckable" },
        { id: "quorum", state: result.quorum, label: "trustAnchorQuorumMet", reason: "trustAnchorQuorumNotCheckable" }
    ];
    const checkList = validation.appendChild(document.createElement("ul"));
    for (const check of checks) {
        const row = checkList.appendChild(document.createElement("li"));
        row.dataset["check"] = check.id;
        row.dataset["state"] = check.state;
        const icon = row.appendChild(document.createElement("span"));
        icon.className = "trustAnchorCheckIcon";
        icon.setAttribute("aria-hidden", "true");
        if (check.state === "valid")
            icon.classList.add("fas", "fa-check-circle");
        else if (check.state === "invalid")
            icon.classList.add("fas", "fa-times-circle");
        else
            icon.textContent = "○";
        const content = row.appendChild(document.createElement("div"));
        const label = content.appendChild(document.createElement("strong"));
        label.textContent = localize(check.label);
        const reason = content.appendChild(document.createElement("p"));
        reason.textContent = localize(check.state === "valid" ? "trustAnchorCheckPassed" :
                                      check.state === "invalid" ? "trustAnchorCheckFailed" : unavailableReason ?? check.reason);
    }
    const trustPolicy = validation.appendChild(document.createElement("p"));
    trustPolicy.className = "trustAnchorTrustPolicy";
    trustPolicy.textContent = localize("trustAnchorTrustPolicy");
    const bundledKeyCount = validation.appendChild(document.createElement("p"));
    bundledKeyCount.className = "trustAnchorBundledKeyCount";
    bundledKeyCount.textContent = `${localize("trustAnchorBundledKeysLabel")}: ${activeTrustedKeyCount}`;

    return validation;
}

/** Display QR data alongside independently supplied verification results. */
export function renderTrustAnchorPreview(preview: TrustAnchorPreview,
                                         language: string,
                                         localize: (key: string) => string,
                                         validation: TrustAnchorValidation = unsignedAnchorValidation,
                                         options: TrustAnchorPreviewOptions = {}): HTMLElement {
    const { anchor, text } = preview;
    const section = document.createElement("section");
    section.className = "trustAnchorPreview";
    section.setAttribute("aria-labelledby", "trustAnchorPreviewTitle");

    const title = section.appendChild(document.createElement("h2"));
    title.id = "trustAnchorPreviewTitle";
    title.textContent = localize("trustAnchorPreviewTitle");

    const notice = section.appendChild(document.createElement("p"));
    notice.className = "trustAnchorPreviewNotice";
    notice.textContent = localize(options.isImported === true ? "trustAnchorAlreadyImported" : "trustAnchorPreviewNotice");
    section.appendChild(renderTrustAnchorValidation(validation, localize, options.activeTrustedKeyCount));

    const fields = section.appendChild(document.createElement("dl"));
    const addField = (label: string, values: readonly string[], monospace: boolean = false): void => {
        const term = fields.appendChild(document.createElement("dt"));
        term.textContent = label;
        const description = fields.appendChild(document.createElement("dd"));
        if (monospace)
            description.className = "trustAnchorMonospace";
        for (const value of values) {
            const line = description.appendChild(document.createElement("div"));
            line.textContent = value;
        }
    };

    const localizedText = (texts: Readonly<Record<string, string>>): string =>
        texts[language] ?? texts["en"] ?? Object.values(texts)[0] ?? "";

    const name = localizedText(anchor.name);
    if (name !== "")
        addField(localize("trustAnchorNameLabel"), [ name ]);
    const description = localizedText(anchor.description);
    if (description !== "")
        addField(localize("trustAnchorDescriptionLabel"), [ description ]);

    addField(localize("trustAnchorNetworkLabel"), [ anchor.id ]);
    addField(localize("trustAnchorURLsLabel"), anchor.urls, true);
    addField(localize("trustAnchorQuorumLabel"), [ `${anchor.minConsensus} / ${anchor.holders.length}` ]);

    const keys = section.appendChild(document.createElement("details"));
    const keysSummary = keys.appendChild(document.createElement("summary"));
    keysSummary.textContent = `${localize("trustAnchorIdentityKeysLabel")} (${anchor.keys.length})`;
    for (const [index, holder] of anchor.holders.entries()) {
        const group = keys.appendChild(document.createElement("div"));
        group.className = "trustAnchorHolder";
        const heading = group.appendChild(document.createElement("h3"));
        heading.textContent = `${localize("trustAnchorHolderLabel")} ${index + 1}`;
        for (const key of holder) {
            const fingerprint = group.appendChild(document.createElement("div"));
            fingerprint.className = "trustAnchorMonospace";
            fingerprint.textContent = key;
        }
    }

    const raw = section.appendChild(document.createElement("details"));
    const rawSummary = raw.appendChild(document.createElement("summary"));
    rawSummary.textContent = localize("recognizedContent");
    const rawText = raw.appendChild(document.createElement("pre"));
    rawText.textContent = text;

    const actions = section.appendChild(document.createElement("div"));
    actions.className = "trustAnchorPreviewActions";
    if (options.onImport !== undefined) {
        const button = actions.appendChild(document.createElement("button"));
        button.type = "button";
        button.dataset["action"] = "import";
        button.className = "trustAnchorImport";
        button.textContent = localize(options.isImported === true ? "trustAnchorImportedLabel" : "trustAnchorImportLabel");
        button.disabled = options.isImported === true || options.busy === true;
        button.onclick = options.onImport;
    }
    if (options.onDiscard !== undefined) {
        const button = actions.appendChild(document.createElement("button"));
        button.type = "button";
        button.dataset["action"] = "discard";
        button.textContent = localize(options.isImported === true ? "trustCloseLabel" : "trustAnchorDiscardLabel");
        button.onclick = options.onDiscard;
    }

    return section;
}
