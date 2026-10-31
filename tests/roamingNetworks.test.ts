import { describe, expect, test } from 'vitest';
import { TrustAnchor } from '@open-charging-cloud/wwcp-poi';
import { groupRoamingNetworks, roamingNetworkDisplayName } from '../src/ts/roamingNetworks';
import { trustAnchorStorageId } from '../src/ts/trustStore';
import type { StoredTrustAnchor } from '../src/ts/trustStore';

function record(anchor: TrustAnchor, importedAt: string = '2026-10-30T12:00:00.000Z'): StoredTrustAnchor {
    return { id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText: anchor.toURL(), importedAt };
}

describe('Local roaming network index', () => {
    test('groups by network ID without combining trust policies', () => {
        const first = TrustAnchor.create('QA', ['https://example.org/RNs/QA'], ['11'.repeat(32)], 1, { de: 'Testnetz' });
        const second = TrustAnchor.create('QA', ['https://mirror.example/RNs/QA'], ['22'.repeat(32), '33'.repeat(32)], 2);
        const networks = groupRoamingNetworks([record(first), record(second)]);
        expect(networks).toHaveLength(1);
        expect(networks[0]?.anchors).toHaveLength(2);
        expect(networks[0]?.anchors.map(entry => TrustAnchor.parse(entry.qrCode).minConsensus)).toEqual([1, 2]);
        expect(networks[0]?.anchors.map(entry => TrustAnchor.parse(entry.qrCode).keys)).toEqual([first.keys, second.keys]);
    });

    test('keeps networks separate even with identical display names', () => {
        const records = ['QA', 'OTHER'].map(id => record(TrustAnchor.create(id, [`https://example.org/RNs/${id}`], ['11'.repeat(32)], 1, { de: 'Gleicher Name' })));
        expect(groupRoamingNetworks(records).map(network => network.id)).toEqual(['OTHER', 'QA']);
    });

    test('keeps a localized name when the newest anchor is an unnamed URL', () => {
        const named = TrustAnchor.create('QA', ['https://example.org/RNs/QA'], ['11'.repeat(32)], 1, { de: 'Testnetz', en: 'Test network' });
        const unnamed = TrustAnchor.create('QA', ['https://mirror.example/RNs/QA'], ['22'.repeat(32)]);
        const network = groupRoamingNetworks([record(named), record(unnamed, '2026-10-30T13:00:00.000Z')])[0];
        if (network === undefined)
            throw new Error('Expected a network');
        expect(roamingNetworkDisplayName(network, 'de')).toBe('Testnetz');
        expect(roamingNetworkDisplayName(network, 'en')).toBe('Test network');
        expect(network.anchors[0]?.id).toBe(trustAnchorStorageId(unnamed));
    });

    test('uses the network ID when no display name is known and handles an empty store', () => {
        const network = groupRoamingNetworks([record(TrustAnchor.create('QA', ['https://example.org/RNs/QA'], ['11'.repeat(32)]))])[0];
        if (network === undefined)
            throw new Error('Expected a network');
        expect(roamingNetworkDisplayName(network, 'de')).toBe('QA');
        expect(groupRoamingNetworks([])).toEqual([]);
    });
});
