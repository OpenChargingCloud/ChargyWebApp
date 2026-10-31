import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import type { StoredTrustAnchor } from './trustStore';

export interface StoredRoamingNetwork {
    readonly id: string;
    readonly anchors: readonly StoredTrustAnchor[];
}

/** A local index, never a merger of the different anchors' keys or quorum policies. */
export function groupRoamingNetworks(records: readonly StoredTrustAnchor[]): readonly StoredRoamingNetwork[] {
    const groups = new Map<string, StoredTrustAnchor[]>();
    for (const record of records) {
        const id = TrustAnchor.parse(record.qrCode).id;
        const group = groups.get(id) ?? [];
        group.push(record);
        groups.set(id, group);
    }
    return [...groups].map(([id, anchors]) => ({
        id, anchors: anchors.sort((a, b) => b.importedAt.localeCompare(a.importedAt))
    })).sort((a, b) => a.id.localeCompare(b.id));
}

/** These display names come from imported anchors and are not authenticated network names. */
export function roamingNetworkDisplayName(network: StoredRoamingNetwork, language: string): string {
    const names = network.anchors.map(record => TrustAnchor.parse(record.qrCode).name);
    for (const candidate of [language, "en"])
        for (const name of names) {
            const value = name[candidate];
            if (value !== undefined && value.trim() !== "")
                return value;
        }
    return names.flatMap(name => Object.values(name)).find(value => value.trim() !== "") ?? network.id;
}
