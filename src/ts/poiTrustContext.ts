import { OperatorTrust, TrustAnchor, TrustContext, canonicalJSONBytes, hash, toHex, verifyChargingStation } from '@open-charging-cloud/wwcp-poi';
import type { JSONValue, POIPublicKey, VerifiedChargingStation } from '@open-charging-cloud/wwcp-poi';
import { trustedAnchorHolders } from './anchorKeyTrust';
import { parseTrustAnchorData } from './trustAnchorData';
import type { StoredTrustAnchorData } from './trustAnchorData';
import { trustAnchorStorageId } from './trustStore';
import type { StoredTrustAnchor, TrustStore } from './trustStore';

/** An immutable report at evaluatedAt, never a reusable authorization token or a stored green flag. */
export interface POITrustContext {
    readonly verification: TrustContext;
    readonly anchorPolicyId: string;
    /** Conservatively scoped to this exact bootstrap policy until verified succession is supported. */
    readonly networkIdentity: string;
    readonly roamingNetworkId: string;
    readonly roamingNetworkOperatorId: string;
    readonly keyStatementDigest: string;
    readonly evaluatedAt: number;
    readonly validUntil: number;
    readonly requiredConsensus: number;
    /** Original holder positions are retained, including empty groups. */
    readonly authorizedHolders: readonly (readonly string[])[];
    readonly evidence: {
        readonly anchorQRCode: string;
        readonly keyStatement: StoredTrustAnchorData;
    };
}

const digest = (value: JSONValue): string => toHex(hash('sha256', canonicalJSONBytes(value)));

/** Reparse original evidence; callers cannot substitute a pre-parsed statement or cached verification result. */
export function createPOITrustContext(anchor: TrustAnchor, document: StoredTrustAnchorData,
                                        record: StoredTrustAnchor | undefined, bundled: readonly POIPublicKey[],
                                        deleted: ReadonlySet<string>, at: number = Date.now()): POITrustContext {
    if (!Number.isFinite(at))
        throw new Error('Invalid POI trust evaluation time');
    if (record !== undefined && (record.id !== trustAnchorStorageId(anchor) ||
        trustAnchorStorageId(TrustAnchor.parse(record.qrCode)) !== record.id))
        throw new Error('The stored trust decision belongs to another anchor policy');
    const data = parseTrustAnchorData(anchor, document, bundled);
    const verification = TrustContext.create(anchor, data.statement, {
        trustedIdentityKeyIds: trustedAnchorHolders(anchor, record, bundled, deleted, at).flat(),
        otherIdentityKeys: data.identityKeys, at
    });
    const anchorPolicyId = trustAnchorStorageId(anchor);
    const roamingNetworkId = data.statement.roamingNetworkId;
    const roamingNetworkOperatorId = data.statement.roamingNetworkOperatorId;
    return Object.freeze({
        verification,
        anchorPolicyId,
        networkIdentity: digest({ roamingNetworkId, roamingNetworkOperatorId, anchorPolicyId }),
        roamingNetworkId, roamingNetworkOperatorId,
        keyStatementDigest: verification.keyStatementDigest,
        evaluatedAt: verification.evaluatedAt, validUntil: verification.validUntil, requiredConsensus: verification.requiredConsensus,
        authorizedHolders: verification.trustedHolders,
        evidence: Object.freeze({ anchorQRCode: anchor.toQRCode(), keyStatement: Object.freeze({ ...document }) })
    });
}

/** Storage-backed gateway. Every call reads current local decisions in one transaction; no authorization cache. */
export class POITrustService {
    public constructor(private readonly store: Pick<TrustStore, 'trustSnapshot'>,
                        private readonly bundled: readonly POIPublicKey[],
                        private readonly now: () => number = Date.now) {}

    public async resolve(anchorPolicyId: string): Promise<POITrustContext> {
        const { record, deleted } = await this.store.trustSnapshot(anchorPolicyId);
        if (record?.id !== anchorPolicyId || record.downloadedData === undefined)
            throw new Error('No saved KeyStatement exists for this anchor policy');
        return createPOITrustContext(TrustAnchor.parse(record.qrCode), record.downloadedData,
                                     record, this.bundled, deleted, this.now());
    }

    public async verifyOperator(anchorPolicyId: string, operator: JSONValue): Promise<{ readonly context: POITrustContext; readonly trust: OperatorTrust }> {
        const context = await this.resolve(anchorPolicyId);
        return { context, trust: OperatorTrust.fromOperatorJSON(context.verification, operator) };
    }

    /** Integration seam only: no fetching, station selection, caching or ChargyCore handoff here. */
    public async verifyStation(anchorPolicyId: string, value: JSONValue,
                                subject: { readonly evseId: string } | { readonly chargingStationId: string }): Promise<{
                                    readonly context: POITrustContext; readonly station: VerifiedChargingStation;
                                }> {
        const context = await this.resolve(anchorPolicyId);
        if (('evseId' in subject ? subject.evseId : subject.chargingStationId).trim() === '')
            throw new Error('A station proof requires an unambiguous subject');
        const station = verifyChargingStation(context.verification, value, subject);
        return { context, station };
    }
}
