import { TrustAnchor, hash, toHex } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import type { StoredTrustAnchorData } from './trustAnchorData';

export const trustDatabaseName = "ChargyTrustManagement";
const anchorsStore = "trustAnchors";
const deletedKeysStore = "deletedBundledKeys";

export interface StoredTrustAnchor {
    readonly id: string;
    readonly qrCode: string;
    readonly sourceText: string;
    readonly importedAt: string;
    /** Explicit local decisions, scoped to this exact anchor policy, never global roots. */
    readonly trustedKeys?: readonly ManuallyTrustedKey[];
    readonly downloadedData?: StoredTrustAnchorData;
}

export interface ManuallyTrustedKey {
    readonly id: string;
    readonly acceptedAt: string;
}

/** Names/descriptions do not create duplicates between compact and URL forms. */
export function trustAnchorStorageId(anchor: TrustAnchor): string {
    const identity = JSON.stringify({
        network: anchor.id,
        holders: anchor.holders,
        minConsensus: anchor.minConsensus,
        urls: anchor.urls.map(url => new URL(url).href.replace(/\/+$/, "")).sort()
    });
    return toHex(hash("sha256", new TextEncoder().encode(identity)));
}

function object(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid trust management record");
    return value as Record<string, unknown>;
}

function readAnchor(value: unknown): StoredTrustAnchor {
    const record = object(value);
    if (typeof record["id"] !== "string" || typeof record["qrCode"] !== "string" ||
        typeof record["sourceText"] !== "string" || typeof record["importedAt"] !== "string" ||
        !Number.isFinite(Date.parse(record["importedAt"])))
        throw new Error("Invalid stored trust anchor");
    const anchor = TrustAnchor.parse(record["qrCode"]);
    if (trustAnchorStorageId(anchor) !== record["id"])
        throw new Error("Stored trust anchor identity does not match its content");
    const trustedKeys: ManuallyTrustedKey[] = [];
    if (record["trustedKeys"] !== undefined) {
        if (!Array.isArray(record["trustedKeys"]))
            throw new Error("Invalid manual key trust");
        for (const entry of record["trustedKeys"]) {
            const key = object(entry);
            if (typeof key["id"] !== "string" || !anchor.keys.includes(key["id"]) ||
                typeof key["acceptedAt"] !== "string" || !Number.isFinite(Date.parse(key["acceptedAt"])) ||
                trustedKeys.some(existing => existing.id === key["id"]))
                throw new Error("Invalid manual key trust");
            trustedKeys.push({ id: key["id"], acceptedAt: key["acceptedAt"] });
        }
    }
    let downloadedData: StoredTrustAnchorData | undefined;
    if (record["downloadedData"] !== undefined) {
        const data = object(record["downloadedData"]);
        if (typeof data["sourceURL"] !== "string" || typeof data["text"] !== "string" ||
            typeof data["downloadedAt"] !== "string" || !Number.isFinite(Date.parse(data["downloadedAt"])))
            throw new Error("Invalid downloaded trust anchor data");
        downloadedData = { sourceURL: data["sourceURL"], text: data["text"], downloadedAt: data["downloadedAt"] };
    }
    return { id: record["id"], qrCode: record["qrCode"], sourceText: record["sourceText"], importedAt: record["importedAt"], trustedKeys,
             ...(downloadedData === undefined ? {} : { downloadedData }) };
}

/** Version 1 keeps imports and local exclusions separate from immutable build-time keys. */
export class TrustStore {
    private connection: Promise<IDBDatabase> | null = null;

    private async open(): Promise<IDBDatabase> {
        if (this.connection !== null)
            return this.connection;
        const opening = new Promise<IDBDatabase>((resolve, reject) => {
            let blocked = false;
            const request = indexedDB.open(trustDatabaseName, 1);
            request.onupgradeneeded = (): void => {
                const database = request.result;
                if (!database.objectStoreNames.contains(anchorsStore))
                    database.createObjectStore(anchorsStore, { keyPath: "id" });
                if (!database.objectStoreNames.contains(deletedKeysStore))
                    database.createObjectStore(deletedKeysStore, { keyPath: "id" });
            };
            request.onerror = (): void => { reject(request.error ?? new Error("Could not open trust management storage")); };
            request.onblocked = (): void => { blocked = true; reject(new Error("Trust management storage is blocked by another tab")); };
            request.onsuccess = (): void => {
                const database = request.result;
                if (blocked) { database.close(); return; }
                database.onversionchange = (): void => { database.close(); this.connection = null; };
                database.onclose = (): void => { this.connection = null; };
                resolve(database);
            };
        });
        this.connection = opening.catch((error: unknown) => { this.connection = null; throw error; });
        return this.connection;
    }

    private async transaction<T>(name: string, mode: IDBTransactionMode,
                                  run: (store: IDBObjectStore, result: (value: T) => void) => void,
                                  signal?: AbortSignal): Promise<T> {
        const database = await this.open();
        signal?.throwIfAborted();
        return new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(name, mode);
            const abort = (): void => { try { transaction.abort(); } catch { /* Already committed. */ } };
            signal?.addEventListener("abort", abort, { once: true });
            let result: { value: T } | null = null;
            transaction.oncomplete = (): void => {
                signal?.removeEventListener("abort", abort);
                if (result === null)
                    reject(new Error("Trust management operation returned no result"));
                else
                    resolve(result.value);
            };
            transaction.onabort = (): void => {
                signal?.removeEventListener("abort", abort);
                reject(transaction.error ?? new Error("Trust management operation was aborted"));
            };
            transaction.onerror = (): void => { reject(transaction.error ?? new Error("Trust management operation failed")); };
            try {
                run(transaction.objectStore(name), value => { result = { value }; });
            }
            catch (error) {
                transaction.abort();
                reject(error instanceof Error ? error : new Error("Trust management operation failed"));
            }
        });
    }

    public async listAnchors(): Promise<readonly StoredTrustAnchor[]> {
        const values = await this.transaction<unknown[]>(anchorsStore, "readonly", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => { result(request.result as unknown[]); };
        });
        return values.map(readAnchor).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    }

    public async hasAnchor(anchor: TrustAnchor): Promise<boolean> {
        return this.transaction(anchorsStore, "readonly", (store, result) => {
            const request = store.getKey(trustAnchorStorageId(anchor));
            request.onsuccess = (): void => { result(request.result !== undefined); };
        });
    }

    public async getAnchor(anchor: TrustAnchor): Promise<StoredTrustAnchor | undefined> {
        const value = await this.transaction<unknown>(anchorsStore, "readonly", (store, result) => {
            const request = store.get(trustAnchorStorageId(anchor));
            request.onsuccess = (): void => { result(request.result); };
        });
        return value === undefined ? undefined : readAnchor(value);
    }

    /** An authorization snapshot must not mix an anchor and exclusions read from different transactions. */
    public async trustSnapshot(anchorPolicyId: string): Promise<{
        readonly record: StoredTrustAnchor | undefined; readonly deleted: ReadonlySet<string>;
    }> {
        const { records, deleted } = await this.readTrustSnapshot(anchorPolicyId);
        return { record: records[0], deleted };
    }

    public async listTrustSnapshot(): Promise<{
        readonly records: readonly StoredTrustAnchor[]; readonly deleted: ReadonlySet<string>;
    }> {
        return this.readTrustSnapshot();
    }

    private async readTrustSnapshot(anchorPolicyId?: string): Promise<{
        readonly records: readonly StoredTrustAnchor[]; readonly deleted: ReadonlySet<string>;
    }> {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([anchorsStore, deletedKeysStore], 'readonly');
            const anchors = transaction.objectStore(anchorsStore);
            const request = anchorPolicyId === undefined ? anchors.getAll() : anchors.get(anchorPolicyId);
            const exclusions = transaction.objectStore(deletedKeysStore).getAll();
            transaction.onabort = (): void => { reject(transaction.error ?? new Error('Could not read POI trust decisions')); };
            transaction.onerror = (): void => { reject(transaction.error ?? new Error('Could not read POI trust decisions')); };
            transaction.oncomplete = (): void => {
                try {
                    const values = anchorPolicyId === undefined ? request.result as unknown[]
                        : request.result === undefined ? [] : [request.result as unknown];
                    const records = values.map(readAnchor).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
                    resolve({ records, deleted: readDeletedKeys(exclusions.result as unknown[]) });
                }
                catch (error) { reject(error instanceof Error ? error : new Error('Invalid POI trust snapshot')); }
            };
        });
    }

    /** A separate user action; import never calls this. Updating one key preserves concurrent decisions. */
    public async setKeyTrust(anchorId: string, keyId: string, trusted: boolean): Promise<void> {
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.get(anchorId);
            request.onsuccess = (): void => {
                try {
                    const record = readAnchor(request.result);
                    if (!TrustAnchor.parse(record.qrCode).keys.includes(keyId))
                        throw new Error("The key is not part of this trust anchor");
                    const keys = [...(record.trustedKeys ?? [])];
                    if (trusted && !keys.some(key => key.id === keyId))
                        keys.push({ id: keyId, acceptedAt: new Date().toISOString() });
                    store.put({ ...record, trustedKeys: trusted ? keys : keys.filter(key => key.id !== keyId) });
                    result(undefined);
                }
                catch {
                    store.transaction.abort();
                }
            };
        });
    }

    /** The unique-key check and insertion share one transaction, including across tabs. */
    public async importAnchor(anchor: TrustAnchor, sourceText: string, downloadedData?: StoredTrustAnchorData,
                               signal?: AbortSignal): Promise<"imported" | "exists"> {
        const record: StoredTrustAnchor = {
            id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText,
            importedAt: new Date().toISOString(), ...(downloadedData === undefined ? {} : { downloadedData })
        };
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.get(record.id);
            request.onsuccess = (): void => {
                if (request.result !== undefined) {
                    if (downloadedData !== undefined) {
                        try { store.put({ ...readAnchor(request.result), downloadedData }); }
                        catch { store.transaction.abort(); return; }
                    }
                    result("exists");
                }
                else {
                    store.add(record);
                    result("imported");
                }
            };
        }, signal);
    }

    public async deleteAnchor(id: string): Promise<void> {
        return this.transaction(anchorsStore, "readwrite", (store, result) => { store.delete(id); result(undefined); });
    }

    /** Delete only the selected identity's policies, never every operator claiming the same network ID. */
    public async deleteRoamingNetwork(anchorPolicyIds: readonly string[]): Promise<number> {
        const selected = new Set(anchorPolicyIds);
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => {
                try {
                    const records = (request.result as unknown[]).map(readAnchor)
                        .filter(record => selected.has(record.id));
                    for (const record of records)
                        store.delete(record.id);
                    result(records.length);
                }
                catch {
                    store.transaction.abort();
                }
            };
        });
    }

    public async deletedBundledKeyIds(): Promise<ReadonlySet<string>> {
        const values = await this.transaction<unknown[]>(deletedKeysStore, "readonly", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => { result(request.result as unknown[]); };
        });
        return readDeletedKeys(values);
    }

    public async deleteBundledKey(id: string): Promise<void> {
        if (!/^[0-9a-f]{64}$/.test(id))
            throw new Error("Invalid public key ID");
        return this.transaction(deletedKeysStore, "readwrite", (store, result) => { store.put({ id }); result(undefined); });
    }

    public async restoreBundledKey(id: string): Promise<void> {
        return this.transaction(deletedKeysStore, "readwrite", (store, result) => { store.delete(id); result(undefined); });
    }
}

function readDeletedKeys(values: readonly unknown[]): ReadonlySet<string> {
    return new Set(values.map(value => {
        const id = object(value)["id"];
        if (typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id))
            throw new Error("Invalid deleted public key record");
        return id;
    }));
}

export function activeBundledPublicKeys(keys: readonly POIPublicKey[], deleted: ReadonlySet<string>): readonly POIPublicKey[] {
    return keys.filter(key => !deleted.has(key.id));
}
