declare module "*.css";
declare module "*.scss";
declare module "leaflet.awesome-markers";

declare const __CHARGY_CORE_SHA512__: string;
declare const __CHARGY_ALLOW_INSECURE_TRANSPORTS__: boolean;
declare const __CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS__: boolean;

declare module "asn1.js" {
    interface Asn1Builder {
        bitstr(): Asn1Builder;
        int(): Asn1Builder;
        key(name: string): Asn1Builder;
        obj(...items: unknown[]): Asn1Builder;
        objid(): Asn1Builder;
        seq(): Asn1Builder;
        seqof(schema: unknown): Asn1Builder;
    }

    interface Asn1Schema {
        // asn1.js schemas return caller-defined object shapes.
        decode<T = unknown>(data: Uint8Array | ArrayBuffer, encoding: string): T;
    }

    const asn1: {
        define: (name: string, body: (this: Asn1Builder) => void) => Asn1Schema;
    };

    export = asn1;
}
