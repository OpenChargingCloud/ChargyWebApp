/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy Desktop App <https://github.com/OpenChargingCloud/ChargyDesktopApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Chargy }             from './chargy'
import * as ocmfTypes         from './OCMFTypes'
import * as chargyInterfaces  from './chargyInterfaces'


export class OCMF {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }

    //#region tryToParseOCMFv0_1(OCMFDataList, PublicKey?)

    private async tryToParseOCMFv0_1(OCMFDataList:  ocmfTypes.IOCMFData_v0_1,
                                     PublicKey?:    string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        // {
        //     "FV": "0.1",
        //     "VI": "ABL",
        //     "VV": "1.4p3",
        //
        //     "PG": "T12345",
        //
        //     "MV": "Phoenix Contact",
        //     "MM": "EEM-350-D-MCB",
        //     "MS": "BQ27400330016",
        //     "MF": "1.0",
        //
        //     "IS": "VERIFIED",
        //     "IF": ["RFID_PLAIN", "OCPP_RS_TLS"],
        //     "IT": "ISO14443",
        //     "ID": "1F2D3A4F5506C7",
        //
        //     "RD": [{
        //         "TM": "2018-07-24T13:22:04,000+0200 S",
        //         "TX": "B",
        //         "RV": 2935.6,
        //         "RI": "1-b:1.8.e",
        //         "RU": "kWh",
        //         "EI": 567,
        //         "ST": "G"
        //     }]
        // }

        try
        {

            let VendorInformation  :string = OCMFDataList.VI != null ? OCMFDataList.VI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the vendor.
            let VendorVersion      :string = OCMFDataList.VV != null ? OCMFDataList.VV.trim() : ""; // Software version of the vendor.

            let paging             :string = OCMFDataList.PG != null ? OCMFDataList.PG.trim() : ""; // Paging, as this data might be part of a larger context.
            let transactionType     = ocmfTypes.OCMFTransactionTypes.undefined;
            switch (paging[0]?.toLowerCase())
            {

                case 't':
                    transactionType = ocmfTypes.OCMFTransactionTypes.transaction;
                    break;

                case 'f':
                    transactionType = ocmfTypes.OCMFTransactionTypes.fiscal;
                    break

            }
            let pagingId            = paging.substring(1);

            let MeterVendor        :string = OCMFDataList.MV != null ? OCMFDataList.MV.trim() : ""; // Vendor of the device, optional.
            let MeterModel         :string = OCMFDataList.MM != null ? OCMFDataList.MM.trim() : ""; // Model of the device, optional.
            let MeterSerial        :string = OCMFDataList.MS != null ? OCMFDataList.MS.trim() : ""; // Serialnumber of the device, might be optional.
            let MeterFirmware      :string = OCMFDataList.MF != null ? OCMFDataList.MF.trim() : ""; // Software version of the device.

            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                certainty: 0
            }

        } catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion

    //#region tryToParseOCMFv1_0(OCMFDataList, PublicKey?)

    public async tryToParseOCMF(OCMFDataList:  ocmfTypes.IOCMFData_v1_0_Signed[],
                                PublicKey?:    string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        try
        {

            var CTR:any = {

                "@id":       "1554181214441:-1965658344385548683:2",
                "@context":  "https://open.charging.cloud/contexts/CTR+json",
                "begin":     "2019-04-02T05:00:19Z",
                "end":       "2019-04-02T05:13:52Z",
                "description": {
                    "de":        "Alle OCMF-Ladevorgänge"
                },
                "contract": {
                    "@id":       "8057F5AA592904",
                    "type":      "RFID_TAG_ID",
                    "username":  "",
                    "email":     ""
                },

                "EVSEs": [{
                    "@id": "DE*BDO*E8025334492*2",
                    "meters": [{
                        "@id":              "0901454D48000083E076",
                        "vendor":           "EMH",
                        "vendorURL":        "http://www.emh-metering.de",
                        "model":            "eHZ IW8E EMH",
                        "hardwareVersion":  "1.0",
                        "firmwareVersion":  "123",
                        "signatureFormat":  "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                        "publicKeys": [{
                            "algorithm":        "secp192r1",
                            "format":           "DER",
                            "value":            "049EA8697F5C3126E86A37295566D560DE8EA690325791C9CBA79D30612B8EA8E00908FBAD5374812D55DCC3D809C3A36C",
                        }]
                    }]

                }],

                "chargingSessions": [{

                    "@id":                  "1554181214441:-1965658344385548683:2",
                    "@context":             "https://open.charging.cloud/contexts/SessionSignatureFormats/OCMFv1.0+json",
                    "begin":                null,
                    "end":                  null,
                    "EVSEId":               "DE*BDO*E8025334492*2",

                    "authorizationStart": {
                        "@id":              "8057F5AA592904",
                        "type":             "RFID_TAG_ID"
                    },

                    "signatureInfos": {
                        "hash":             "SHA512",
                        "hashTruncation":   "24",
                        "algorithm":        "ECC",
                        "curve":            "secp192r1",
                        "format":           "rs"
                    },

                    "measurements": [//{

                        // "energyMeterId":    "0901454D48000083E076",
                        // "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                        // "name":             "ENERGY_TOTAL",
                        // "obis":             "0100011100FF",
                        // "unit":             "WATT_HOUR",
                        // "unitEncoded":      30,
                        // "valueType":        "Integer64",
                        // "scale":            -1,
    
                        // "signatureInfos": {
                        //     "hash":            "SHA512",
                        //     "hashTruncation":  "24",
                        //     "algorithm":       "ECC",
                        //     "curve":           "secp192r1",
                        //     "format":          "rs"
                        // },

                        // "values": [
                        // {
                        //     "timestamp":        "2019-04-02T07:00:19+02:00",
                        //     "value":            "66260",
                        //     "infoStatus":       "08",
                        //     "secondsIndex":     65058,
                        //     "paginationId":     "00000012",
                        //     "logBookIndex":     "0006",
                        //     "signatures": [{
                        //         "r":    "71F76A80F170F87675AAEB19606BBD298355FDA7B0851700",
                        //         "s":    "2FAD322FA073255BD8B971BD69BFF051BCA9330703172E3C"
                        //     }]
                        // },
                        // {
                        //     "timestamp":        "2019-04-02T07:13:52+02:00",
                        //     "value":            "67327",
                        //     "infoStatus":       "08",
                        //     "secondsIndex":     65871,
                        //     "paginationId":     "00000013",
                        //     "logBookIndex":     "0006",
                        //     "signatures": [{
                        //         "r":    "6DF01D7603CB49BB76141F8E67B371351BF1F87C1F8D38AE",
                        //         "s":    "B3600A9432B8CE0A378126D4FB9D9581457651A5D208AD9E"
                        //     }]
                        // }
                    ]

                }]

             //   }]
            };

            // {
            //
            //     "data": {
            //
            //       "FV": "1.0",
            //       "GI": "SEAL AG",
            //       "GS": "1850006a",
            //       "GV": "1.34",
            //
            //       "PG": "T9289",
            //
            //       "MV": "Carlo Gavazzi",
            //       "MM": "EM340-DIN.AV2.3.X.S1.PF",
            //       "MS": "******240084S",
            //       "MF": "B4",
            //
            //       "IS": true,
            //       "IL": "TRUSTED",
            //       "IF": ["OCCP_AUTH"],
            //       "IT": "ISO14443",
            //       "ID": "56213C05",
            //
            //       "RD": [{
            //           "TM": "2019-06-26T08:57:44,337+0000 U",
            //           "TX": "B",
            //           "RV": 268.978,
            //           "RI": "1-b:1.8.0",
            //           "RU": "kWh",
            //           "RT": "AC",
            //           "EF": "",
            //           "ST": "G"
            //       }]
            //
            //     },
            //
            //     "signature": {
            //       "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
            //     }
            //
            // }

            for (let ocmf of OCMFDataList)
            {

                let GatewayInformation :string    = ocmf.data.GI != null ? ocmf.data.GI.trim() : ""; // Some text about the manufacturer, model, variant, ... of e.g. the gateway.
                let GatewaySerial      :string    = ocmf.data.GS != null ? ocmf.data.GS.trim() : ""; // Serial number of the gateway, might be mandatory.
                let GatewayVersion     :string    = ocmf.data.GV != null ? ocmf.data.GV.trim() : ""; // Software version of the gateway.

                let paging             :string    = ocmf.data.PG != null ? ocmf.data.PG.trim() : ""; // Paging, as this data might be part of a larger context.
                let TransactionType               = ocmfTypes.OCMFTransactionTypes.undefined;
                switch (paging[0]?.toLowerCase())
                {

                    case 't':
                        TransactionType = ocmfTypes.OCMFTransactionTypes.transaction;
                        break;

                    case 'f':
                        TransactionType = ocmfTypes.OCMFTransactionTypes.fiscal;
                        break

                }
                let Pagination                    = paging.substring(1);

                let MeterVendor         :string   = ocmf.data.MV != null ? ocmf.data.MV.trim() : "";    // Vendor of the device, optional.
                let MeterModel          :string   = ocmf.data.MM != null ? ocmf.data.MM.trim() : "";    // Model of the device, optional.
                let MeterSerial         :string   = ocmf.data.MS != null ? ocmf.data.MS.trim() : "";    // Serialnumber of the device, might be optional.
                let MeterFirmware       :string   = ocmf.data.MF != null ? ocmf.data.MF.trim() : "";    // Software version of the device.

                let IdentificationStatus:boolean  = ocmf.data.IS != null ? ocmf.data.IS        : false; // true, if user is assigned, else false.
                let IdentificationLevel :string   = ocmf.data.IL != null ? ocmf.data.IL.trim() : "";    // optional
                let IdentificationFlags :string[] = ocmf.data.IF != null ? ocmf.data.IF        : [];    // optional
                let IdentificationType  :string   = ocmf.data.IT != null ? ocmf.data.IT.trim() : "";    // The type of the authentication data.
                let IdentificationData  :string   = ocmf.data.ID != null ? ocmf.data.ID.trim() : "";    // The authentication data.

                let ChargePointIdType   :string   = ocmf.data.CT != null ? ocmf.data.CT.trim() : "";    // Type of the following ChargePointId: EVSEId|ChargingStationId|...
                let ChargePointId       :string   = ocmf.data.CI != null ? ocmf.data.CI.trim() : "";    // The identification of the charge point

                if (!ocmf.data.RD || ocmf.data.RD.length == 0)
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Each OCMF data set must have at least one meter reading!",
                        certainty: 0
                    }

                for (let reading of ocmf.data.RD)
                {

                    let metaTimestamp       = reading.TM.split(' ');
                    let Timestamp           = metaTimestamp[0];
                    let TimeStatus          = metaTimestamp[1];
                    let Transaction         = reading.TX;   // B|C,X|E,L,R,A,P|S|T | null
                    let Value               = reading.RV;   // typeof RV == 'number', but MUST NOT be rounded!
                    let OBIS                = reading.RI;   // OBIS-Code
                    let Unit                = reading.RU;   // Reading-Unit: kWh, ...
                    let CurrentType         = reading.RT;   // Reading-Current-Type
                    let ErrorFlags          = reading.EF;   // Error-Flags
                    let Status              = reading.ST;   // Status

                    if (CTR.chargingSessions[0].begin == null)
                        CTR.chargingSessions[0].begin = Timestamp;

                    CTR.chargingSessions[0].end = Timestamp;

                    if (CTR.chargingSessions[0].measurements.length == 0)
                        CTR.chargingSessions[0].measurements.push({
                            "energyMeterId":    MeterSerial,
                            "@context":         "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/OCMFv1.0+json",
                            "obis":             OBIS,        // "1-b:1.8.0"
                            "unit":             Unit,        // "kWh"
                            "currentType":      CurrentType, // "AC"
                            "values":           []
                        });

                    CTR.chargingSessions[0].measurements[0].values.push({
                        "timestamp":        Timestamp,          // "2019-06-26T08:57:44,337+0000"
                        "timeStatus":       TimeStatus,         // "U"
                        "transaction":      Transaction,        // "B"
                        "value":            Value,              // 2935.6
                        "transactionType":  TransactionType,    // "T"
                        "pagination":       Pagination,         // "9289"
                        "errorFlags":       ErrorFlags,         // ""
                        "status":           Status,             // "G"
                        "signatures": [{
                            "value": ocmf.signature["SD"]
                        }]
                    });

                }

                CTR.begin = CTR.chargingSessions[0].begin;
                CTR.end   = CTR.chargingSessions[0].end;

                CTR.chargingSessions[0].authorizationStart["@id"]  = ocmf.data.ID;
                CTR.chargingSessions[0].authorizationStart["type"] = ocmf.data.IT;
                CTR.chargingSessions[0].authorizationStart["IS"]   = ocmf.data.IS;
                CTR.chargingSessions[0].authorizationStart["IL"]   = ocmf.data.IL;
                CTR.chargingSessions[0].authorizationStart["IF"]   = ocmf.data.IF;

            }

            return CTR;

        }
        catch (exception)
        {
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                certainty: 0
            }
        }

    }

    //#endregion


    //#region Try

    public async tryToParseOCMF2(OCMFValues:  string|string[],
                                 PublicKey?:  string) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        let commonVersion          = "";
        let ocmfDataList:Object[]  = [];

        if (typeof OCMFValues === 'string')
            OCMFValues = [ OCMFValues ];

        for (let ocmfValue of OCMFValues)
        {

            // OCMF|{"FV":"1.0","GI":"SEAL AG","GS":"1850006a","GV":"1.34","PG":"T9289","MV":"Carlo Gavazzi","MM":"EM340-DIN.AV2.3.X.S1.PF","MS":"******240084S","MF":"B4","IS":true,"IL":"TRUSTED","IF":["OCCP_AUTH"],"IT":"ISO14443","ID":"56213C05","RD":[{"TM":"2019-06-26T08:57:44,337+0000 U","TX":"B","RV":268.978,"RI":"1-b:1.8.0","RU":"kWh","RT":"AC","EF":"","ST":"G"}]}|{"SD":"304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"}
            const ocmfSections = ocmfValue.split('|');

            if (ocmfSections.length == 3)
            {

                if (ocmfSections[0] !== "OCMF")
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "The given data does not have a valid OCMF header!",
                        certainty: 0
                    }

                let ocmfVersion           = "";
                let ocmfData:     any     = {};
                let ocmfSignature:Object  = {};

                try
                {

                    // http://hers.abl.de/SAFE/Datenformat_OCMF/Datenformat_OCMF_v1.0.pdf
                    // Ein Darstellungsformat, JSON-basiert (nachvollziehbar)
                    // Ein Übertragungsformat, JSON-basiert (vereinheitlicht)
                    //
                    // {
                    //     "FV": "1.0",
                    //     "GI": "SEAL AG",
                    //     "GS": "1850006a",
                    //     "GV": "1.34",
                    //
                    //     "PG": "T9289",
                    //
                    //     "MV": "Carlo Gavazzi",
                    //     "MM": "EM340-DIN.AV2.3.X.S1.PF",
                    //     "MS": "******240084S",
                    //     "MF": "B4",
                    //
                    //     "IS": true,
                    //     "IL": "TRUSTED",
                    //     "IF": ["OCCP_AUTH"],
                    //     "IT": "ISO14443",
                    //     "ID": "56213C05",
                    //
                    //     "RD": [{
                    //         "TM": "2019-06-26T08:57:44,337+0000 U",
                    //         "TX": "B",
                    //         "RV": 268.978,
                    //         "RI": "1-b:1.8.0",
                    //         "RU": "kWh",
                    //         "RT": "AC",
                    //         "EF": "",
                    //         "ST": "G"
                    //     }]
                    // }
                    // {
                    //     "SD": "304402201455BF1082C9EB8B1272D7FA838EB44286B03AC96E8BAFC5E79E30C5B3E1B872022006286CA81AEE0FAFCB1D6A137FFB2C0DD014727E2AEC149F30CD5A7E87619139"
                    // }

                    ocmfData       = JSON.parse(ocmfSections[1] ?? "{}");
                    ocmfSignature  = JSON.parse(ocmfSections[2] ?? "{}");
                    ocmfVersion    = ocmfData["FV"] != null ? ocmfData["FV"].trim() : ""; 

                }
                catch (exception)
                {
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Could not parse the given OCMF data!",
                        certainty: 0
                    }
                }

                if (ocmfData      == null || Object.keys(ocmfData).length === 0)
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Could not parse the given OCMF data!",
                        certainty: 0
                    }

                if (ocmfSignature == null || Object.keys(ocmfSignature).length === 0)
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Could not parse the given OCMF signature!",
                        certainty: 0
                    }

                if (commonVersion == "")
                    commonVersion = ocmfVersion;
                else
                    if (ocmfVersion != commonVersion)
                        "Invalid mixture of different OCMF versions within the given SAFE XML!";

                ocmfDataList.push({ "data": ocmfData, "signature": ocmfSignature });

            }

            else
                return {
                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:   "The given data is not valid OCMF!",
                    certainty: 0
                }

        }

        if (ocmfDataList.length == 1)
            return {
                status:    chargyInterfaces.SessionVerificationResult.AtLeastTwoMeasurementsRequired,
                message:   "At least two OCMF measurements are required!",
                certainty: 0
            }

        if (ocmfDataList.length >= 2)
        {
            switch (commonVersion)
            {

                // case "0.1":
                //     return await this.tryToParseOCMFv0_1(OCMFDataList as IOCMFData_v0_1[], PublicKey);

                case "1.0":
                    return await this.tryToParseOCMF(ocmfDataList as ocmfTypes.IOCMFData_v1_0_Signed[], PublicKey);

                default:
                    return {
                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:   "Unknown OCMF version!",
                        certainty: 0
                    }

            }
        }

        return {
            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
            message:   "Unknown OCMF version!",
            certainty: 0
        }

    }

    //#endregion


}
