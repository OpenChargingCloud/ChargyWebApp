import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import { trustAnchorStorageId } from './trustStore';
import type { TrustStore } from './trustStore';
import { POITrustService } from './poiTrustContext';
import { StationProofPanel } from './stationProofPanel';
import type { SessionPOIEvidence } from './sessionPOIData';
import type { ITransportAllowances } from './liveLinkTrust';

/** One selected session and one explicitly selected local anchor policy, never a union of network trust. */
export class SessionPOIPanel {
    private disposed = false;
    private generation = 0;
    private panel: StationProofPanel | null = null;
    public constructor(private readonly root: HTMLElement, private readonly store: TrustStore,
        private readonly keys: readonly POIPublicKey[], private readonly evseId: string,
        private readonly evidence: SessionPOIEvidence | undefined, private readonly localize: (key: string) => string,
        private readonly language: string, private readonly allowances: ITransportAllowances,
        private readonly importBootstrap: (bootstrap: NonNullable<SessionPOIEvidence['bootstrap']>) => void) {
        root.className = 'sessionPOI';
    }

    public dispose(): void { this.disposed = true; ++this.generation; this.panel?.dispose(); this.panel = null; }

    public async mount(): Promise<void> {
        this.panel?.dispose(); this.panel = null;
        const generation = ++this.generation;
        this.root.replaceChildren();
        this.root.appendChild(document.createElement('h3')).textContent = this.localize('poiSessionTitle');
        const status = this.root.appendChild(document.createElement('section'));
        status.className = 'sessionPOIStatus'; status.dataset['state'] = 'idle'; status.setAttribute('role', 'status');
        status.textContent = this.localize('poiChoosePolicy');
        const controls = this.root.appendChild(document.createElement('details'));
        controls.className = 'sessionPOIDetails';
        controls.appendChild(document.createElement('summary')).textContent = this.localize('poiSessionDetails');
        controls.appendChild(document.createElement('p')).textContent = this.localize('poiSessionScope');
        try {
            const { records } = await this.store.listTrustSnapshot();
            if (this.disposed || generation !== this.generation) return;
            controls.open = records.length === 0;
            const bootstrap = this.evidence?.bootstrap;
            if (bootstrap !== undefined) {
                const note = controls.appendChild(document.createElement('p'));
                note.textContent = this.localize('poiBootstrapNotice');
                const button = controls.appendChild(document.createElement('button'));
                button.type = 'button'; button.textContent = this.localize('poiShowBootstrap');
                button.onclick = (): void => { this.importBootstrap(bootstrap); };
            }
            const label = controls.appendChild(document.createElement('label'));
            label.textContent = this.localize('poiSelectPolicy');
            const select = controls.appendChild(document.createElement('select'));
            label.htmlFor = 'poiSessionPolicy'; select.id = 'poiSessionPolicy';
            const empty = select.appendChild(document.createElement('option'));
            empty.value = ''; empty.textContent = this.localize(records.length === 0 ? 'poiNoPolicy' : 'poiChoosePolicy');
            const service = new POITrustService(this.store, this.keys);
            const hint = bootstrap === undefined ? undefined : trustAnchorStorageId(bootstrap.anchor);
            const matches: string[] = [];
            for (const record of records) {
                let authorized = false;
                let network = '';
                try { const context = await service.resolve(record.id); authorized = true; network = context.roamingNetworkId; }
                catch { /* Still selectable: users can inspect their trust failure, never authorize it implicitly. */ }
                if (generation !== this.generation) return;
                const option = select.appendChild(document.createElement('option'));
                option.value = record.id;
                option.textContent = `${network || this.localize('poiUnverifiedPolicy')} · ${record.id.slice(0, 12)}`;
                if (authorized && (hint !== undefined ? hint === record.id
                    : this.evidence?.roamingNetworkId !== undefined ? network === this.evidence.roamingNetworkId : records.length === 1)) matches.push(record.id);
            }
            const host = controls.appendChild(document.createElement('div'));
            const open = async (): Promise<void> => {
                this.panel?.dispose(); this.panel = null; host.replaceChildren();
                status.dataset['state'] = 'idle'; status.textContent = this.localize('poiChoosePolicy');
                if (select.value === '' || this.disposed) return;
                const panel = new StationProofPanel(host, this.store, service, select.value, this.localize, this.language,
                    this.allowances, this.evseId, { evseId: this.evseId, onState: (state, proof): void => {
                        if (this.disposed || generation !== this.generation) return;
                        status.dataset['state'] = state;
                        const label = state === 'valid' ? 'poiStationVerified' : state === 'warning' ? 'poiStationVerifiedWithWarnings'
                            : state === 'invalid' ? 'poiLoadFailed' : state === 'pending' ? 'poiLoading' : 'poiCancelled';
                        status.replaceChildren();
                        const heading = status.appendChild(document.createElement('p'));
                        heading.textContent = (state === 'valid' ? '✅ ' : '') + this.localize(label);
                        if (proof !== undefined) {
                            const tariffs = proof.station.tariffs.get(this.evseId) ?? [];
                            status.appendChild(document.createElement('p')).textContent = `${this.evseId} · ${this.localize('poiStaticTariffs')}: ${tariffs.length}`;
                            status.appendChild(document.createElement('p')).textContent = `${this.localize('poiCheckedAt')}: ${new Date(proof.context.evaluatedAt).toLocaleString(this.language)}`;
                        }
                    },
                        ...(this.evidence?.document === undefined ? {} : { document: this.evidence.document }) });
                this.panel = panel;
                if (this.evidence?.document === undefined)
                    status.textContent = this.localize('poiSessionProofPending');
                await panel.mount();
            };
            select.onchange = (): void => { void open(); };
            if (matches.length === 1) { select.value = matches[0] ?? ''; await open(); }
        }
        catch {
            if (!this.disposed && generation === this.generation)
                this.root.appendChild(document.createElement('p')).textContent = this.localize('trustStorageError');
        }
    }
}
