import { TrustAnchor, toBase64 } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import type { TrustStore } from './trustStore';
import type { StoredTrustAnchor } from './trustStore';
import { activeBundledPublicKeys } from './trustStore';
import { groupRoamingNetworks, roamingNetworkDisplayName } from './roamingNetworks';
import type { StoredRoamingNetwork } from './roamingNetworks';
import { renderTrustAnchorValidation } from './trustAnchorPreview';

type TrustManagementPage = "menu" | "anchors" | "keys" | "networks" | "networkDetails";

export class TrustManagement {
    private page: TrustManagementPage = "menu";
    private generation = 0;
    private selectedNetworkId: string | null = null;

    public constructor(private readonly root: HTMLElement,
                        private readonly store: TrustStore,
                        private readonly bundledKeys: readonly POIPublicKey[],
                        private readonly localize: (key: string) => string,
                        private readonly language: () => string) {}

    public open(): void { this.root.hidden = false; this.page = "menu"; this.selectedNetworkId = null; void this.render(); }
    public hide(): void { this.root.hidden = true; this.generation++; }
    public refresh(): void { if (this.root.hidden === false) void this.render(); }
    public back(): boolean {
        if (this.page === "menu")
            return false;
        this.page = this.page === "networkDetails" ? "networks" : "menu";
        this.selectedNetworkId = null;
        void this.render();
        return true;
    }

    private button(parent: HTMLElement, label: string, action: () => void, className: string = ""): HTMLButtonElement {
        const button = parent.appendChild(document.createElement("button"));
        button.type = "button";
        button.textContent = this.localize(label);
        button.className = className;
        button.onclick = action;
        return button;
    }

    private text(parent: HTMLElement, text: string, className: string = ""): HTMLElement {
        const element = parent.appendChild(document.createElement("p"));
        element.textContent = text;
        element.className = className;
        return element;
    }

    private async mutate(button: HTMLButtonElement, action: () => Promise<void>, generation: number): Promise<void> {
        button.disabled = true;
        try {
            await action();
            if (this.generation === generation)
                await this.render();
        }
        catch {
            if (this.generation === generation) {
                const error = this.text(this.root, this.localize("trustStorageError"), "trustManagementError");
                error.setAttribute("role", "alert");
                button.disabled = false;
            }
        }
    }

    private renderAnchor(parent: HTMLElement, record: StoredTrustAnchor, generation: number,
                         deletedKeys?: ReadonlySet<string>): void {
        const anchor = TrustAnchor.parse(record.qrCode);
        const card = parent.appendChild(document.createElement("article"));
        card.className = "trustManagementCard";
        card.dataset["anchorId"] = record.id;
        const name = card.appendChild(document.createElement("h4"));
        name.textContent = anchor.name[this.language()] ?? anchor.name["en"] ?? Object.values(anchor.name)[0] ?? anchor.id;
        this.text(card, anchor.id, "trustManagementIdentifier");
        this.text(card, `${this.localize("trustAnchorImportedAtLabel")}: ${new Date(record.importedAt).toLocaleString(this.language())}`);
        this.text(card, this.localize("trustAnchorSavedStatus"));
        const details = card.appendChild(document.createElement("details"));
        const summary = details.appendChild(document.createElement("summary"));
        summary.textContent = this.localize("trustAnchorDetailsLabel");
        if (deletedKeys !== undefined)
            details.open = true;
        for (const url of anchor.urls)
            this.text(details, url, "trustManagementIdentifier");
        this.text(details, `${this.localize("trustAnchorQuorumLabel")}: ${anchor.minConsensus} / ${anchor.holders.length}`);
        for (const [index, holder] of anchor.holders.entries()) {
            this.text(details, `${this.localize("trustAnchorHolderLabel")} ${index + 1}`);
            for (const key of holder) {
                this.text(details, key, "trustManagementIdentifier");
                if (deletedKeys !== undefined) {
                    const known = this.bundledKeys.find(entry => entry.id === key);
                    const status = deletedKeys.has(key) ? "deleted" : known === undefined ? "unknown" : known.isValidAt(Date.now()) ? "trusted" : "expired";
                    const labels = { deleted: "trustNetworkKeyDeleted", unknown: "trustNetworkKeyUnknown", trusted: "trustNetworkKeyTrusted", expired: "trustNetworkKeyExpired" };
                    const label = this.text(details, this.localize(labels[status]), "trustNetworkKeyStatus");
                    label.dataset["keyTrust"] = status;
                }
            }
        }
        const button = this.button(card, "trustAnchorDeleteLabel", () => {
            void this.mutate(button, async () => this.store.deleteAnchor(record.id), generation);
        }, "trustManagementDelete");
    }

    private renderNetworkDetails(parent: HTMLElement, network: StoredRoamingNetwork,
                                  deletedKeys: ReadonlySet<string>, generation: number): void {
        parent.dataset["networkId"] = network.id;
        const title = parent.appendChild(document.createElement("h4"));
        title.textContent = roamingNetworkDisplayName(network, this.language());
        this.text(parent, `${this.localize("trustAnchorNetworkLabel")}: ${network.id}`, "trustManagementIdentifier");
        this.text(parent, this.localize("trustNetworkNameSource"));
        this.text(parent, `${this.localize("trustNetworkAnchorCount")}: ${network.anchors.length}`);
        const statement = parent.appendChild(document.createElement("section"));
        statement.className = "trustNetworkKeyStatement";
        const heading = statement.appendChild(document.createElement("h4"));
        heading.textContent = this.localize("trustNetworkKeyStatementTitle");
        statement.appendChild(renderTrustAnchorValidation(
            { signatures: "unavailable", signers: "unavailable", quorum: "unavailable" }, this.localize,
            activeBundledPublicKeys(this.bundledKeys, deletedKeys).length, "trustNetworkKeyStatementMissing"
        ));
        this.text(parent, this.localize("trustNetworkPoliciesSeparate"));
        for (const record of network.anchors)
            this.renderAnchor(parent, record, generation, deletedKeys);
        const removal = parent.appendChild(document.createElement("div"));
        removal.className = "trustNetworkRemoval";
        this.text(removal, this.localize("trustNetworkDeleteDescription"));
        const button = this.button(removal, "trustNetworkDeleteLabel", () => {
            void this.mutate(button, async () => {
                await this.store.deleteRoamingNetwork(network.id);
                if (this.generation === generation) {
                    this.page = "networks";
                    this.selectedNetworkId = null;
                }
            }, generation);
        }, "trustManagementDelete");
    }

    private async render(): Promise<void> {
        const generation = ++this.generation;
        this.root.replaceChildren();
        const settings = this.root.closest<HTMLElement>("#settingsScreen");
        if (settings !== null)
            settings.scrollTop = 0;
        this.root.dataset["page"] = this.page;
        const heading = this.root.appendChild(document.createElement("h2"));
        heading.textContent = this.localize("trustManagementTitle");
        if (this.page === "menu") {
            this.button(this.root, "trustRoamingNetworksTitle", () => { this.page = "networks"; void this.render(); }, "settingsEntry");
            this.button(this.root, "trustAnchorsTitle", () => { this.page = "anchors"; void this.render(); }, "settingsEntry");
            this.button(this.root, "trustBundledKeysTitle", () => { this.page = "keys"; void this.render(); }, "settingsEntry");
            return;
        }

        const title = this.root.appendChild(document.createElement("h3"));
        const titles = { anchors: "trustAnchorsTitle", keys: "trustBundledKeysTitle", networks: "trustRoamingNetworksTitle", networkDetails: "trustRoamingNetworkDetailsTitle" };
        title.textContent = this.localize(titles[this.page]);
        const descriptions = { anchors: "trustAnchorsStorageDescription", keys: "trustBundledKeysDescription", networks: "trustRoamingNetworksDescription", networkDetails: "trustRoamingNetworkDetailsDescription" };
        this.text(this.root, this.localize(descriptions[this.page]));
        const list = this.root.appendChild(document.createElement("div"));
        list.className = "trustManagementList";
        list.setAttribute("aria-busy", "true");
        try {
            if (this.page === "networks" || this.page === "networkDetails") {
                const [anchors, deletedKeys] = await Promise.all([this.store.listAnchors(), this.store.deletedBundledKeyIds()]);
                if (this.generation !== generation)
                    return;
                const networks = groupRoamingNetworks(anchors);
                if (this.page === "networkDetails") {
                    const network = networks.find(entry => entry.id === this.selectedNetworkId);
                    if (network === undefined) {
                        this.page = "networks";
                        this.selectedNetworkId = null;
                        await this.render();
                        return;
                    }
                    this.renderNetworkDetails(list, network, deletedKeys, generation);
                }
                else {
                    if (networks.length === 0)
                        this.text(list, this.localize("trustRoamingNetworksEmpty"));
                    for (const network of networks) {
                        const button = this.button(list, "trustNetworkOpenLabel", () => {
                            this.selectedNetworkId = network.id;
                            this.page = "networkDetails";
                            void this.render();
                        }, "settingsEntry trustNetworkEntry");
                        button.dataset["networkId"] = network.id;
                        button.replaceChildren();
                        const text = button.appendChild(document.createElement("div"));
                        const name = text.appendChild(document.createElement("strong"));
                        name.textContent = roamingNetworkDisplayName(network, this.language());
                        this.text(text, `${network.id} · ${this.localize("trustNetworkAnchorCount")}: ${network.anchors.length}`);
                        this.text(text, this.localize("trustNetworkOpenLabel"));
                    }
                }
            }
            else if (this.page === "anchors") {
                const anchors = await this.store.listAnchors();
                if (this.generation !== generation)
                    return;
                if (anchors.length === 0)
                    this.text(list, this.localize("trustAnchorsEmpty"));
                for (const record of anchors)
                    this.renderAnchor(list, record, generation);
            }
            else {
                const deleted = await this.store.deletedBundledKeyIds();
                if (this.generation !== generation)
                    return;
                if (this.bundledKeys.length === 0)
                    this.text(list, this.localize("trustBundledKeysEmpty"));
                for (const key of this.bundledKeys) {
                    const isDeleted = deleted.has(key.id);
                    const card = list.appendChild(document.createElement("article"));
                    card.className = "trustManagementCard";
                    card.dataset["keyId"] = key.id;
                    card.dataset["state"] = isDeleted ? "deleted" : "active";
                    if (key.holder !== undefined)
                        this.text(card, key.holder);
                    this.text(card, key.id, "trustManagementIdentifier");
                    this.text(card, this.localize(isDeleted ? "trustBundledKeyDeleted" : "trustBundledKeyActive"));
                    const details = card.appendChild(document.createElement("details"));
                    const summary = details.appendChild(document.createElement("summary"));
                    summary.textContent = this.localize("publicKeyLabel");
                    this.text(details, toBase64(key.keyBytes), "trustManagementIdentifier");
                    const button = this.button(card, isDeleted ? "trustBundledKeyRestore" : "trustBundledKeyDelete", () => {
                        void this.mutate(button, async () => isDeleted ? this.store.restoreBundledKey(key.id) : this.store.deleteBundledKey(key.id), generation);
                    }, isDeleted ? "" : "trustManagementDelete");
                }
            }
        }
        catch {
            if (this.generation === generation) {
                const error = this.text(list, this.localize("trustStorageError"), "trustManagementError");
                error.setAttribute("role", "alert");
                this.button(list, "trustRetryLabel", () => { void this.render(); });
            }
        }
        finally {
            if (this.generation === generation) {
                if (settings !== null)
                    settings.scrollTop = 0;
                list.setAttribute("aria-busy", "false");
            }
        }
    }
}
