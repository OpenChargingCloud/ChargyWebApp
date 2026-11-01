// Public, reproducible demonstration keys only. Never add these to production trust roots.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { CoseCurves, CoseKey } from '@vanaheimr/cose';
import { Attestation, SigningKeyCertificate, KeyStatement, TrustAnchor, TrustContext, RoamingNetwork,
    ChargingStationProof, verifyChargingStation, POIPublicKey, parseJSON, prettyJSON,
    toHex, toBase64, etagToJSON, entityDigest, auditPath, clone, canonicalJSON, ROAMING_NETWORK_CONTEXT } from '@open-charging-cloud/wwcp-poi';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { at: { type: 'string' }, 'output-dir': { type: 'string',
    default: path.join(repo, 'tests/fixtures/POISession') } } });
const now = values.at === undefined ? Date.now() : Date.parse(values.at);
assert.ok(Number.isFinite(now));
const at = Math.floor(now / 1000) * 1000;
const iso = timestamp => new Date(timestamp).toISOString();
const output = path.resolve(values['output-dir']);
await mkdir(output, { recursive: true });
const fixed = '2026-01-01T00:00:00.000Z';
const until = '2030-01-01T00:00:00.000Z';
const networkId = 'CHARGY-POI-DEMO';
const operatorId = 'CHARGY-DEMO-RNO';
const evseId = 'DE*POI*E1*1';
const serial = 'CHARGY-POI-METER-001';
const json = value => parseJSON(JSON.stringify(value));
function key(seed, holder) {
    const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, seed)]), type: 'pkcs8', format: 'der' });
    const raw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
    const cose = CoseKey.fromOkpPublicKey(CoseCurves.Ed25519, raw);
    const publicKey = POIPublicKey.parse({ '@id': toHex(cose.thumbprint()), key: toBase64(cose.toBytes()), holder,
        notBefore: fixed, notAfter: until });
    return { publicKey, sign: bytes => sign(null, bytes, privateKey).toString('base64') };
}
const identities = [key(41, 'Demo holder A'), key(43, 'Demo holder B')];
const signingKeys = [key(42, 'Demo holder A'), key(44, 'Demo holder B')];
const anchor = TrustAnchor.create(networkId, ['https://poi.example/RNs/' + networkId], identities.map(item => [item.publicKey.id]), 2,
    { en: 'Chargy POI demonstration (test keys)', de: 'Chargy POI-Demonstration (Testschlüssel)' });
let statement = { roamingNetworkId: networkId, roamingNetworkOperatorId: operatorId, minConsensus: 2,
    identityKeys: identities.map(item => item.publicKey.json).sort((a,b) => a['@id'].localeCompare(b['@id'])),
    signedAt: fixed, validUntil: until,
    signatures: [{ algorithm: 'Ed25519', keyId: identities[0].publicKey.id, value: 'placeholder' }] };
const unsignedStatement = KeyStatement.parse(statement);
statement = { ...statement, signatures: identities.map(item => ({ algorithm: 'Ed25519', keyId: item.publicKey.id,
    value: item.sign(unsignedStatement.signingBytes('Ed25519', item.publicKey.id)) })) };
const certificates = signingKeys.map((item,index) => {
    const value = { roamingNetworkOperatorId: operatorId, signingKey: item.publicKey.json, signedAt: fixed,
        algorithm: 'Ed25519', keyId: identities[index].publicKey.id, value: 'placeholder' };
    const unsigned = SigningKeyCertificate.parse(value);
    return { ...value, value: identities[index].sign(unsigned.signingBytes()) };
});
const meterKeyPath = 'tests/fixtures/ChargeTransparencyLive/OCMF-Test-01/privateKey_energyMeter.pem';
const meterPrivateKey = createPrivateKey(await readFile(path.join(repo, meterKeyPath)));
const meterSPKI = createPublicKey(meterPrivateKey).export({ type: 'spki', format: 'der' });
const meterKeyId = createHash('sha256').update(meterSPKI).digest('hex');
const tariff = { '@id': 'DE*POI*T1', name: { en: 'Demo AC tariff', de: 'Demo-AC-Tarif' }, currency: 'EUR',
    elements: [{ priceComponents: [{ type: 'ENERGY', price: 0.35, stepSize: 1 }] }], created: fixed, lastChange: fixed };
const station = { '@id': 'DE*POI*S1', name: { en: 'Chargy POI demo station', de: 'Chargy-POI-Demoladestation' },
    address: { street: 'Demo Street 1', city: 'Jena', postalCode: '07743', country: 'DE' },
    geoLocation: { lat: 50.9271, lng: 11.5892 },
    EVSEs: [{ '@id': evseId, currentTypes: ['AC_3_PHASE'], maxPower: 22000,
        chargingConnectors: [{ '@id': '1', type: 'IEC_62196_T2', format: 'SOCKET' }],
        energyMeter: { '@id': 'DE*POI*M1', role: 'evse', serialNumber: serial,
            signatureMethods: ['OCMF'], publicKeys: [{ '@id': meterKeyId, key: meterSPKI.toString('base64') }],
            created: fixed, lastChange: fixed },
        chargingTariffIds: [tariff['@id']], created: fixed, lastChange: fixed }], created: fixed, lastChange: fixed };
const other = { '@id': 'DE*POI*S2', EVSEs: [{ '@id': 'DE*POI*E2*1', created: fixed, lastChange: fixed }], created: fixed, lastChange: fixed };
const operator = { '@id': operatorId, name: { en: 'Chargy demo roaming operator' }, minConsensus: 2,
    identityKeys: statement.identityKeys, keyStatement: statement, signingKeyCertificates: certificates, created: fixed, lastChange: fixed };
const network = RoamingNetwork.parse(json({ '@context': ROAMING_NETWORK_CONTEXT,
    '@id': networkId, name: anchor.name, operator,
    chargingStationOperators: [{ '@id': 'DE*POI', name: { en: 'Chargy demo CPO' },
        chargingTariffs: [tariff], chargingPools: [{ '@id': 'DE*POI*P1', name: { en: 'Demo pool' },
            chargingStations: [station, other], created: fixed, lastChange: fixed }], created: fixed, lastChange: fixed }],
    created: fixed, lastChange: fixed }));
const rootETag = network.effectiveTreeETag('sha256');
const commitId = createHash('sha256').update('Chargy demo version: ' + canonicalJSON(etagToJSON(rootETag))).digest('hex');
const attestations = signingKeys.map(item => {
    const value = { roamingNetworkId: networkId, commitId, revision: 1, eTag: etagToJSON(rootETag),
        role: 'roamingNetworkOperator', signer: operatorId, signedAt: iso(at - 60000), validUntil: iso(at + 23 * 3600000),
        algorithm: 'Ed25519', keyId: item.publicKey.id, value: 'placeholder' };
    return { ...value, value: item.sign(Attestation.parse(json(value)).signingBytes()) };
});
// Omit the second station completely. Its only contribution is the Merkle audit path.
const pruned = clone(network.effectiveContent);
const stations = pruned.chargingStationOperators[0].chargingPools[0].chargingStations;
const leaves = stations.map(item => entityDigest(item, 'chargingStation', 'sha256'));
pruned.chargingStationOperators[0].chargingPools[0].chargingStations = {
    '@size': stations.length, '@leaves': [{ '@index': 0, '@auditPath': auditPath('sha256', leaves, 0).map(toHex), '@entity': stations[0] }]
};
const proof = { '@context': 'https://open.charging.cloud/contexts/wwcp/roamingNetwork/proof/v1',
    hashAlgorithm: 'sha256', commitId, revision: 1, roamingNetwork: pruned, attestations };
const context = TrustContext.create(anchor, KeyStatement.parse(statement), { trustedIdentityKeyIds: anchor.keys, at });
const verified = verifyChargingStation(context, proof, { evseId });
assert.equal(verified.evses[0]['@id'], evseId);
assert.equal(verified.energyMeters[0].serialNumber, serial);
assert.equal(verified.tariffs.get(evseId).length, 1);
assert.deepEqual(verified.warnings, []);
assert.equal(ChargingStationProof.parse(proof).verify(context).attestedBy.length, 2);
const begin = at - 35 * 60000;
const end = at - 5 * 60000;
function ocmf(time, reason, value) {
    const payload = JSON.stringify({ FV: '1.0', GI: 'Chargy POI demo', GS: 'DEMO-GATEWAY-001', GV: '1.0',
        PG: 'T42', MV: 'Chargy', MM: 'Demo meter', MS: serial, MF: '1.0',
        IS: true, IL: 'VERIFIED', IF: ['OCPP_AUTH'], IT: 'ISO14443', ID: 'DEMO-CONTRACT-001',
        CT: 'EVSEID', CI: evseId, TT: '001;EUR;0;35;0;0',
        RD: [{ TM: iso(time).replace('.', ',').replace('Z', '+0000') + ' S', TX: reason, RV: value,
            RI: '1-b:1.8.0', RU: 'kWh', RT: 'AC', EF: '', ST: 'G' }] });
    return 'OCMF|' + payload + '|' + JSON.stringify({ SA: 'ECDSA-secp256r1-SHA256', SE: 'hex',
        SD: sign('sha256', Buffer.from(payload), meterPrivateKey).toString('hex').toUpperCase() });
}
const container = { format: 'ptb', formatVersion: '1.0', publicKey: meterSPKI.toString('base64'),
    chargeboxIdentifier: evseId, address: { street: 'Demo Street 1', city: 'Jena', postalCode: '07743', country: 'DE' },
    geoLocation: { lat: 50.9271, lng: 11.5892 }, ocmfBegin: ocmf(begin, 'B', 1000), ocmfEnd: ocmf(end, 'E', 1011),
    poiEvidence: { '@context': 'https://open.charging.cloud/contexts/chargy/poiEvidence/v1', EVSEId: evseId,
        roamingNetworkId: networkId, bootstrap: { trustAnchor: anchor.toQRCode(), keyStatement: network.content.operator },
        chargingStationProof: proof } };
const files = { 'completed-session-with-evse-proof.chargy': prettyJSON({ ...json({ ...container, poiEvidence: undefined }), poiEvidence: container.poiEvidence }) + '\n',
    'trust-anchor.txt': anchor.toQRCode() + '\n', 'key-statement.json': prettyJSON(network.content.operator) + '\n' };
for (const [file,text] of Object.entries(files)) await writeFile(path.join(output,file),text);
await writeFile(path.join(output,'provenance.json'),JSON.stringify({ generator: 'build-tools/generatePOISessionExample.mjs',
    generatedAt: iso(at), begin: iso(begin), end: iso(end), attestationsValidUntil: iso(at + 23 * 3600000),
    networkId, evseId, meterSerial: serial, meterKeyId, meterKeySource: meterKeyPath,
    identityKeySeeds: [41,43], operationalKeySeeds: [42,44], keys: 'PUBLIC TEST KEYS ONLY; never production trust roots',
    consumedKWh: 11, pricePerKWh: '0.35', tariffClaim: 'Static definition inclusion; no PriceStatement or publication claim',
    files: Object.fromEntries(Object.entries(files).map(([name,text]) => [name,{sha256:createHash('sha256').update(text).digest('hex')}])) },null,2)+'\n');
console.log('Generated genuine signed completed session and pruned EVSE proof in ' + output);
