import { TrustAnchor, hash, toHex } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';

export const trustDatabaseName = "ChargyTrustManagement";
const anchorsStore = "trustAnchors";
const deletedKeysStore = "deletedBundledKeys";

export interface StoredTrustAnchor {
    readonly id: string;
    readonly qrCode: string;
    readonly sourceText: string;
    readonly importedAt: string;
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
    if (trustAnchorStorageId(TrustAnchor.parse(record["qrCode"])) !== record["id"])
        throw new Error("Stored trust anchor identity does not match its content");
    return { id: record["id"], qrCode: record["qrCode"], sourceText: record["sourceText"], importedAt: record["importedAt"] };
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
                                  run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
        const database = await this.open();
        return new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(name, mode);
            let result: { value: T } | null = null;
            transaction.oncomplete = (): void => {
                if (result === null)
                    reject(new Error("Trust management operation returned no result"));
                else
                    resolve(result.value);
            };
            transaction.onabort = (): void => { reject(transaction.error ?? new Error("Trust management operation was aborted")); };
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

    /** The unique-key check and insertion share one transaction, including across tabs. */
    public async importAnchor(anchor: TrustAnchor, sourceText: string): Promise<"imported" | "exists"> {
        const record: StoredTrustAnchor = {
            id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText,
            importedAt: new Date().toISOString()
        };
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.getKey(record.id);
            request.onsuccess = (): void => {
                if (request.result !== undefined)
                    result("exists");
                else {
                    store.add(record);
                    result("imported");
                }
            };
        });
    }

    public async deleteAnchor(id: string): Promise<void> {
        return this.transaction(anchorsStore, "readwrite", (store, result) => { store.delete(id); result(undefined); });
    }

    /** Remove every local trust configuration of this network in one transaction. */
    public async deleteRoamingNetwork(networkId: string): Promise<number> {
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => {
                try {
                    const records = (request.result as unknown[]).map(readAnchor)
                        .filter(record => TrustAnchor.parse(record.qrCode).id === networkId);
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
        return new Set(values.map(value => {
            const id = object(value)["id"];
            if (typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id))
                throw new Error("Invalid deleted public key record");
            return id;
        }));
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

export function activeBundledPublicKeys(keys: readonly POIPublicKey[], deleted: ReadonlySet<string>): readonly POIPublicKey[] {
    return keys.filter(key => !deleted.has(key.id));
}
