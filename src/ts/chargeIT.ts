/*
 * Copyright (c) 2018-2022 GraphDefined GmbH <achim.friedland@graphdefined.com>
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
import { Alfen01 }            from './Alfen01'
import { BSMCrypt01 }         from './BSMCrypt01'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import { ChargyApp }          from './chargyApp'

export class ChargeIT {

    private readonly chargy: Chargy;

    constructor(chargy:  Chargy) {
        this.chargy  = chargy;
    }


    private bufferToHex(buffer: ArrayBuffer, Reverse?: Boolean) : string {
        return (Reverse
                    ? Array.from(new Uint8Array(buffer)).reverse()
                    : Array.from(new Uint8Array(buffer))
               ).map (b => b.toString(16).padStart(2, "0")).join("");
    }

    private bufferToNumber(buffer: ArrayBuffer) : number {
        return parseInt(Array
            .from(new Uint8Array(buffer))
            .map (b => b.toString(16).padStart(2, "0"))
            .join(""), 16);
    }





    //#region tryToParseChargeITJSON(SomeJSON)

    //private async tryToParseAnonymousFormat(SomeJSON: { signedMeterValues: any[]; placeInfo: any; }) : Promise<IChargeTransparencyRecord|ISessionCryptoResult>

    // The chargeIT mobility data format does not always provide context or format identifiers
    public async tryToParseChargeITContainerFormatJSON(SomeJSON: any) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        if (SomeJSON === undefined || SomeJSON === null || Array.isArray(SomeJSON))
            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                certainty: 0
            }

        const warnings                     = new Array<String>();
        const errors                       = new Array<String>();

        const oldChargeITContainerFormat   = "oldChargeITContainerFormat";
        const oldChargeITMeterValueFormat  = "oldChargeITMeterValueFormat";

        const containerFormat              = chargyLib.isMandatoryString(SomeJSON["@context"])
                                                 ? SomeJSON["@context"]?.trim()
                                                 : oldChargeITContainerFormat;

        //#region Old chargeIT container format

        if (containerFormat === oldChargeITContainerFormat)
        {

            // How sure we are, that this is really a chargeIT transparency format
            let numberOfFormatChecks  = 14 + 2*39; // At least two signed meter values!
            let secondaryErrors       = 0;

            //#region documentation

            // {
            //     "placeInfo": {
            //         "evseId": "DE*BDO*74778874*1",
            //         "address": {
            //             "street": "Musterstraße 12",
            //             "zipCode": "74789",
            //             "town": "Stadt" 
            //         },
            //         "geoLocation": {
            //             "lat": 12.3774,
            //             "lon": 1.3774
            //         }
            //     },
            //
            //     "signedMeterValues":[{
            //         "timestamp": 1550533285,
            //         "meterInfo": {
            //            "firmwareVersion": "123",
            //            "publicKey": "08A56CF3B51DABA44F38607BB884F62FB8BE84B4EF39D09624AB9E0910354398590DC59A5B40F43FE68A9F416F65EC76",
            //            "publicKeySignatures": [],
            //            "meterId": "0901454D4800007F9F3E",
            //            "type": "eHZ IW8E EMH",
            //            "manufacturer": "EMH"
            //         },
            //         "transactionId": "1546933282548:-7209653592192971037:1",
            //         "contract": {
            //            "type": "RFID_TAG_ID",
            //            "timestampLocal": {
            //               "timestamp": 1546933284,
            //               "localOffset": 60,
            //               "seasonOffset": 0
            //            },
            //            "timestamp": 1550533284,
            //            "id": "235DD5BB"
            //         },
            //         "measurementId": "00000007",
            //         "measuredValue": {
            //            "timestampLocal": {
            //               "timestamp": 1546933285,
            //               "localOffset": 60,
            //               "seasonOffset": 0
            //            },
            //            "value": "60077",
            //            "unit": "WATT_HOUR",
            //            "scale": -1,
            //            "valueType": "Integer64",
            //            "unitEncoded": 30
            //         },
            //         "measurand": {
            //            "id": "0100011100FF",
            //            "name": "ENERGY_TOTAL"
            //         },
            //         "additionalInfo": {
            //            "indexes": {
            //               "timer": 1730275,
            //               "logBook": "0004"
            //            },
            //            "status": "88"
            //         },
            //         "signature": "13493BBB43DA1E26C88B21ADB7AA53A7AE4FC7F6F6B916E67AD3E168421D180F021D6DD458612C53FF167781892A9DF3"
            //     }]
            //
            // }

            //#endregion

            try
            {

                //#region Validate the container format
                {

                    //#region Validate 'placeInfo'

                    const placeInfo = SomeJSON.placeInfo;
                    if (!chargyLib.isMandatoryJSONObject(placeInfo))
                    {
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidPlaceInfo"));
                        secondaryErrors += 13;
                    }
                    else
                    {

                        const evseId = placeInfo.evseId;
                        if (!chargyLib.isMandatoryString(evseId))
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidEVSEId"));

                        //#region placeInfo.address

                        const address = placeInfo.address;
                        if (!chargyLib.isMandatoryJSONObject(address))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddress"));
                            secondaryErrors += 3;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryString(address.street))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressStreetName"));

                            if (!chargyLib.isMandatoryString(address.zipCode))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressZIPCode"));

                            if (!chargyLib.isMandatoryString(address.town))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCityName"));

                            //if (!chargyLib.isMandatoryString(address.country))
                            //    errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidAddressCountryName"));

                        }

                        //#endregion

                        //#region placeInfo.geoLocation

                        const geoLocation = placeInfo.geoLocation;
                        if (!chargyLib.isMandatoryJSONObject(geoLocation))
                        {
                            errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocation"));
                            secondaryErrors += 2;
                        }
                        else
                        {

                            if (!chargyLib.isMandatoryNumber(geoLocation.lat))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLatitude"));

                            if (!chargyLib.isMandatoryNumber(geoLocation.lon))
                                errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidGeoLocationLongitude"));

                        }

                        //#endregion

                    }

                    //#endregion

                    //#region Validate 'signedMeterValues'

                    const signedMeterValues = SomeJSON.signedMeterValues;
                    if (!chargyLib.isMandatoryJSONArray(signedMeterValues) || signedMeterValues.length < 2) {
                        errors.push(this.chargy.GetLocalizedMessage("MissingOrInvalidSignedMeterValues"));
                        secondaryErrors += 2*39;
                    }
                    else
                    {

                        // Additional format checks per measurement
                        // when there are more than 2 signed meter values
                        numberOfFormatChecks += 39 * (signedMeterValues.length - 2);

                        //#region Get and validate consistency of the signedMeterValue context

                        const signedMeterValueContext  = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                                            ? signedMeterValues[0]["@context"]?.trim()
                                                            : oldChargeITMeterValueFormat;


                        let consistent = true;

                        for (const signedMeterValue of signedMeterValues) {
                            if ((signedMeterValue["@context"] ?? oldChargeITMeterValueFormat) !== signedMeterValueContext) {

                                if (consistent)
                                    errors.push(this.chargy.GetLocalizedMessage("InconsistentJSONContextInformation"));

                                consistent = false;

                            }
                        }

                        //#endregion

                        if (consistent) {

                            if (signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v0" ||
                                signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v1" ||
                                signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0" ||
                                signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v1") {

                                //return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, null, signedMeterValues);

                            }

                            if (signedMeterValueContext.startsWith("ALFEN")) {
                                return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));
                            }

                            if (containerFormat === oldChargeITContainerFormat) {

                                if (signedMeterValues[0].format == "ALFEN")
                                    return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                            }

                            if (signedMeterValueContext === oldChargeITMeterValueFormat)
                            {

                                let measurementCounter = 0;

                                for (const signedMeterValue of signedMeterValues)
                                {

                                    measurementCounter++;

                                    if (!chargyLib.isMandatoryJSONObject(signedMeterValue)) {
                                        errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidSignedMeterValueP",                     measurementCounter));
                                        secondaryErrors += 38;
                                    }
                                    else
                                    {

                                        if (!chargyLib.isMandatoryString(signedMeterValue.measurementId))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurementIdP",  measurementCounter));

                                        if (!chargyLib.isMandatoryNumber(signedMeterValue.timestamp))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_TimestampP",      measurementCounter));

                                        if (!chargyLib.isMandatoryString(signedMeterValue.transactionId))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_TransactionIdP",  measurementCounter));

                                        if (!chargyLib.isMandatoryString(signedMeterValue.signature))
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_SignatureP",      measurementCounter));

                                        //#region Meter information

                                        const meterInfo = signedMeterValue.meterInfo;
                                        if (!chargyLib.isMandatoryJSONObject(meterInfo))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfoP",                 measurementCounter));
                                            secondaryErrors += 5;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(meterInfo.meterId))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_MeterIdP",         measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.type))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_TypeP",            measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.firmwareVersion))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_FirmwareVersionP", measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.publicKey))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_PublicKeyP",       measurementCounter));

                                            if (!chargyLib.isMandatoryString(meterInfo.manufacturer))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeterInfo_ManufacturerP",    measurementCounter));

                                            //#region Meter information - PublicKey signatures (optional)

                                            if (chargyLib.isOptionalJSONArrayError(meterInfo.publicKeySignatures))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("Invalid_SignedMeterValue_MeterInfo_PublicKeySignaturesP", measurementCounter));

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Contract information

                                        const contract = signedMeterValue.contract;
                                        if (!chargyLib.isMandatoryJSONObject(contract))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ContractP",           measurementCounter));
                                            secondaryErrors += 7;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(contract.id))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_IdP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(contract.type))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TypeP",      measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(contract.timestamp))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampP", measurementCounter));

                                            //#region Contract information - Timestamp local

                                            const timestampLocal = contract.timestampLocal;
                                            if (!chargyLib.isMandatoryJSONObject(timestampLocal))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocalP",              measurementCounter));
                                                secondaryErrors += 3;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.timestamp))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_TimestampP",    measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.localOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_LocalOffsetP",  measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.seasonOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Contract_TimestampLocal_SeasonOffsetP", measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Measured value

                                        const measuredValue = signedMeterValue.measuredValue;
                                        if (!chargyLib.isMandatoryJSONObject(measuredValue))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValueP",                  measurementCounter));
                                            secondaryErrors += 9;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(measuredValue.value))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ValueP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(measuredValue.unit))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_UnitP",         measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(measuredValue.scale))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ScaleP",        measurementCounter));

                                            if (!chargyLib.isMandatoryString(measuredValue.valueType))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_ValueTypeP",    measurementCounter));

                                            if (!chargyLib.isMandatoryNumber(measuredValue.unitEncoded))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasuredValue_UnitEncodedP",  measurementCounter));

                                            //#region Measured Value - Local timestamp

                                            const timestampLocal = measuredValue.timestampLocal;
                                            if (!chargyLib.isMandatoryJSONObject(timestampLocal))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalP",                  measurementCounter));
                                                secondaryErrors += 3;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.timestamp))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalTimestampP",     measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.localOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampLocalOffsetP",        measurementCounter));

                                                if (!chargyLib.isMandatoryNumber(timestampLocal.seasonOffset))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalidMeasuredValueTimestampSeasonOffsetP",       measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region Measurand

                                        const measurand = signedMeterValue.measurand;
                                        if (!chargyLib.isMandatoryJSONObject(measurand))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_MeasurandP",           measurementCounter));
                                            secondaryErrors += 2;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(measurand.id))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Measurand_IdP",    measurementCounter));

                                            if (!chargyLib.isMandatoryString(measurand.name))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_Measurand_NameP",  measurementCounter));

                                        }

                                        //#endregion

                                        //#region Additional info

                                        const additionalInfo = signedMeterValue.additionalInfo;
                                        if (!chargyLib.isMandatoryJSONObject(additionalInfo))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformationP",         measurementCounter));
                                            secondaryErrors += 4;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(additionalInfo.status))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_StatusP",  measurementCounter));

                                            //#region Additional info - Indexes

                                            const indexes = additionalInfo.indexes;
                                            if (!chargyLib.isMandatoryJSONObject(indexes))
                                            {
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_IndexesP",         measurementCounter));
                                                secondaryErrors += 2;
                                            }
                                            else
                                            {

                                                if (!chargyLib.isMandatoryNumber(signedMeterValue?.additionalInfo?.indexes?.timer))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_Indexes_TimerP",   measurementCounter));

                                                if (!chargyLib.isMandatoryString(signedMeterValue?.additionalInfo?.indexes?.logBook))
                                                    errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_AdditionalInformation_Indexes_LogBookP", measurementCounter));

                                            }

                                            //#endregion

                                        }

                                        //#endregion

                                        //#region ChargePoint information

                                        const chargePoint = signedMeterValue.chargePoint;
                                        if (!chargyLib.isMandatoryJSONObject(chargePoint))
                                        {
                                            errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ChargePointInformationP",                 measurementCounter));
                                            secondaryErrors += 1;
                                        }
                                        else
                                        {

                                            if (!chargyLib.isMandatoryString(signedMeterValue?.chargePoint?.softwareVersion))
                                                errors.push(this.chargy.GetLocalizedMessageWithParameter("MissingOrInvalid_SignedMeterValue_ChargePointInformation_SoftwareVersionP", measurementCounter));

                                        }

                                        //#endregion

                                    }

                                }

                            }

                        }

                    }

                    //#endregion

                    if (errors.length > 0) return {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        errors:     errors,
                        warings:    warnings,
                        certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                    }

                }
                //#endregion

                //#region Parse the container format
                {

                    const signedMeterValues  = SomeJSON.signedMeterValues;
                    const placeInfo          = SomeJSON.placeInfo;
                    const evseId             = SomeJSON.placeInfo.evseId;
                    const address            = SomeJSON.placeInfo.address;
                    const address_street     = SomeJSON.placeInfo.address.street;
                    const address_zipCode    = SomeJSON.placeInfo.address.zipCode;
                    const address_town       = SomeJSON.placeInfo.address.town;
                    const address_country    = SomeJSON.placeInfo.address.country ?? "Deutschland"; //ToDo: i18n!
                    const geoLocation        = SomeJSON.placeInfo.geoLocation;
                    const geoLocation_lat    = SomeJSON.placeInfo.geoLocation.lat;
                    const geoLocation_lon    = SomeJSON.placeInfo.geoLocation.lon;


                    if (chargyLib.isMandatoryJSONArray (signedMeterValues) &&

                        chargyLib.isMandatoryJSONObject(placeInfo)         &&

                        chargyLib.isMandatoryString    (evseId)            &&

                        chargyLib.isMandatoryJSONObject(address)           &&
                        chargyLib.isMandatoryString    (address_street)    &&
                        chargyLib.isMandatoryString    (address_zipCode)   &&
                        chargyLib.isMandatoryString    (address_town)      &&
                        chargyLib.isMandatoryString    (address_country)   &&

                        chargyLib.isMandatoryJSONObject(geoLocation)       &&
                        chargyLib.isMandatoryNumber    (geoLocation_lat)   &&
                        chargyLib.isMandatoryNumber    (geoLocation_lon)
                        )
                    {

                        //#region Generate default charge transparency record

                        let CTR: chargyInterfaces.IChargeTransparencyRecord = {

                            "@id":              "",
                            "@context":         "https://open.charging.cloud/contexts/CTR+json",

                            "description": {
                                "de":           "Alle Ladevorgänge"
                            },

                            "chargingStationOperators": [
                                {

                                    "@id":                      "chargeITmobilityCSO",
                                    "@context":                 "",
                                    //"eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
                                    "description": {
                                        "de":                   "chargeIT mobility GmbH - Charging Station Operator Services"
                                    },

                                    "contact": {
                                        "email":                    "info@chargeit-mobility.com",
                                        "web":                      "https://www.chargeit-mobility.com",
                                        "logoUrl":                  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                        "publicKeys": [
                                            {
                                                "algorithm":        "secp192r1",
                                                "format":           "DER",
                                                "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                                "signatures": [
                                                    {
                                                        "keyId":      "...",
                                                        "algorithm":  "secp192r1",
                                                        "format":     "DER",
                                                        "value":      "????"
                                                    }
                                                ]
                                            },
                                            {
                                                "algorithm":        "secp256k1",
                                                "format":           "DER",
                                                "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                                "signatures":       [ ]
                                            }
                                        ]
                                    },

                                    "support": {
                                        "hotline":                  "+49 9321 / 2680 - 700",
                                        "email":                    "service@chargeit-mobility.com",
                                        "web":                      "https://cso.chargeit.charging.cloud/issues"
                                        // "mediationServices":        [ "GraphDefined Mediation" ],
                                        // "publicKeys": [
                                        //     {
                                        //         "algorithm":        "secp256k1",
                                        //         "format":           "DER",
                                        //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                        //         "signatures":       [ ]
                                        //     }
                                        // ]
                                    },

                                    "privacy": {
                                        "contact":                  "Dr. iur. Christian Borchers, datenschutz süd GmbH",
                                        "email":                    "datenschutz@chargeit-mobility.com",
                                        "web":                      "http://www.chargeit-mobility.com/de/datenschutz/"
                                        // "publicKeys": [
                                        //     {
                                        //         "algorithm":        "secp256k1",
                                        //         "format":           "DER",
                                        //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                        //         "signatures":       [ ]
                                        //     }
                                        // ]
                                    },

                                    "chargingStations": [
                                        {
                                            "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
                                            //"description":              { },
                                            //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
                                            "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                            "address": {
                                                "street":               address_street,
                                                "postalCode":           address_zipCode,
                                                "city":                 address_town,
                                                "country":              "Germany"
                                            },
                                            "EVSEs": [
                                                {
                                                    "@id":                      evseId,
                                                    // "description": {
                                                    //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                                    // },
                                                    //"connectors":               [  ],
                                                    "meters":                   [ ]
                                                }
                                            ]
                                        }
                                    ]

                                }
                            ]

                        };

                        //#endregion

                        //#region Parse the signedMeterValues

                        const signedMeterValueContext = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                                            ? signedMeterValues[0]["@context"]?.trim()
                                                            : oldChargeITMeterValueFormat;

                        if (signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v0" ||
                            signedMeterValueContext === "https://www.eneco.com/contexts/bsm-ws36a-json-v1" ||
                            signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v0" ||
                            signedMeterValueContext === "https://www.chargeit-mobility.com/contexts/bsm-ws36a-json-v1") {

                            return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, null, signedMeterValues);

                        }

                        if (signedMeterValueContext.startsWith("ALFEN")) {
                            return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));
                        }

                        if (containerFormat === oldChargeITContainerFormat) {

                            if (signedMeterValues[0].format == "ALFEN")
                                return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                        }

                        if (signedMeterValueContext === oldChargeITMeterValueFormat)
                        {

                            let CTRArray = [];

                            //#region Parse Signed Meter Values

                            for (const signedMeterValue of signedMeterValues)
                            {

                                //#region Data

                                const measurementId                              = signedMeterValue.measurementId;
                                const timestamp                                  = signedMeterValue.timestamp;
                                const transactionId                              = signedMeterValue.transactionId;
                                const signature                                  = signedMeterValue.signature;

                                const meterInfo                                  = signedMeterValue.meterInfo;
                                const meterInfo_meterId                          = meterInfo.meterId;
                                const meterInfo_type                             = meterInfo.type;
                                const meterInfo_firmwareVersion                  = meterInfo.firmwareVersion;
                                const meterInfo_publicKey                        = meterInfo.publicKey;
                                const meterInfo_manufacturer                     = meterInfo.manufacturer;

                                const meterInfo_publicKeySignatures              = meterInfo.publicKeySignatures;

                                const contract                                   = signedMeterValue.contract;
                                const contract_id                                = contract.id;
                                const contract_type                              = contract.type;
                                const contract_timestamp                         = contract.timestamp;

                                const contract_timestampLocal                    = contract.timestampLocal;
                                const contract_timestampLocal_timestamp          = contract_timestampLocal.timestamp;
                                const contract_timestampLocal_localOffset        = contract_timestampLocal.localOffset;
                                const contract_timestampLocal_seasonOffset       = contract_timestampLocal.seasonOffset;

                                const measuredValue                              = signedMeterValue.measuredValue;
                                const measuredValue_value                        = measuredValue.value;
                                const measuredValue_unit                         = measuredValue.unit;
                                const measuredValue_scale                        = measuredValue.scale;
                                const measuredValue_valueType                    = measuredValue.valueType;
                                const measuredValue_unitEncoded                  = measuredValue.unitEncoded;

                                const measuredValue_timestampLocal               = measuredValue.timestampLocal;
                                const measuredValue_timestampLocal_timestamp     = measuredValue_timestampLocal.timestamp;
                                const measuredValue_timestampLocal_localOffset   = measuredValue_timestampLocal.localOffset;
                                const measuredValue_timestampLocal_seasonOffset  = measuredValue_timestampLocal.seasonOffset;

                                const measurand                                  = signedMeterValue.measurand;
                                const measurand_id                               = measurand.id;
                                const measurand_name                             = measurand.name;

                                const additionalInfo                             = signedMeterValue.additionalInfo;
                                const additionalInfo_status                      = additionalInfo.status;

                                const additionalInfo_indexes                     = additionalInfo.indexes;
                                const additionalInfo_indexes_timer               = additionalInfo_indexes.timer;
                                const additionalInfo_indexes_logBook             = additionalInfo_indexes.logBook;

                                const chargePoint                                = signedMeterValue.chargePoint;
                                const chargePoint_softwareVersion                = chargePoint.softwareVersion;

                                //#endregion

                                if (chargyLib.isMandatoryString    (measurementId)                             &&
                                    chargyLib.isMandatoryNumber    (timestamp)                                 &&
                                    chargyLib.isMandatoryString    (transactionId)                             &&
                                    chargyLib.isMandatoryString    (signature)                                 &&

                                    chargyLib.isMandatoryJSONObject(meterInfo)                                 &&
                                    chargyLib.isMandatoryString    (meterInfo_meterId)                         &&
                                    chargyLib.isMandatoryString    (meterInfo_type)                            &&
                                    chargyLib.isMandatoryString    (meterInfo_firmwareVersion)                 &&
                                    chargyLib.isMandatoryString    (meterInfo_publicKey)                       &&
                                    chargyLib.isMandatoryString    (meterInfo_manufacturer)                    &&

                                    chargyLib.isOptionalJSONArrayOk(meterInfo_publicKeySignatures)             &&

                                    chargyLib.isMandatoryJSONObject(contract)                                  &&
                                    chargyLib.isMandatoryString    (contract_id)                               &&
                                    chargyLib.isMandatoryString    (contract_type)                             &&
                                    chargyLib.isMandatoryNumber    (contract_timestamp)                        &&

                                    chargyLib.isMandatoryJSONObject(contract_timestampLocal)                   &&
                                    chargyLib.isMandatoryNumber    (contract_timestampLocal_timestamp)         &&
                                    chargyLib.isMandatoryNumber    (contract_timestampLocal_localOffset)       &&
                                    chargyLib.isMandatoryNumber    (contract_timestampLocal_seasonOffset)      &&

                                    chargyLib.isMandatoryJSONObject(measuredValue)                             &&
                                    chargyLib.isMandatoryString    (measuredValue_value)                       &&
                                    chargyLib.isMandatoryString    (measuredValue_unit)                        &&
                                    chargyLib.isMandatoryNumber    (measuredValue_scale)                       &&
                                    chargyLib.isMandatoryString    (measuredValue_valueType)                   &&
                                    chargyLib.isMandatoryNumber    (measuredValue_unitEncoded)                 &&

                                    chargyLib.isMandatoryJSONObject(measuredValue_timestampLocal)              &&
                                    chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_timestamp)    &&
                                    chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_localOffset)  &&
                                    chargyLib.isMandatoryNumber    (measuredValue_timestampLocal_seasonOffset) &&

                                    chargyLib.isMandatoryJSONObject(measurand)                                 &&
                                    chargyLib.isMandatoryString    (measurand_id)                              &&
                                    chargyLib.isMandatoryString    (measurand_name)                            &&

                                    chargyLib.isMandatoryJSONObject(additionalInfo)                            &&
                                    chargyLib.isMandatoryString    (additionalInfo_status)                     &&

                                    chargyLib.isMandatoryJSONObject(additionalInfo_indexes)                    &&
                                    chargyLib.isMandatoryNumber    (additionalInfo_indexes_timer)              &&
                                    chargyLib.isMandatoryString    (additionalInfo_indexes_logBook)            &&

                                    chargyLib.isMandatoryJSONObject(chargePoint)                               &&
                                    chargyLib.isMandatoryString    (chargePoint_softwareVersion)) {

                                        CTRArray.push({
                                            "timestamp":            timestamp,
                                            "meterInfo": {
                                                "firmwareVersion":      meterInfo_firmwareVersion,
                                                "publicKey":            meterInfo_publicKey,
                                                "publicKeySignatures":  meterInfo_publicKeySignatures,
                                                "meterId":              meterInfo_meterId,
                                                "type":                 meterInfo_type,
                                                "manufacturer":         meterInfo_manufacturer
                                            },
                                            "transactionId":        transactionId,
                                            "contract": {
                                                "type":                 contract_type,
                                                "timestampLocal": {
                                                    "timestamp":            contract_timestampLocal_timestamp,
                                                    "localOffset":          contract_timestampLocal_localOffset,
                                                    "seasonOffset":         contract_timestampLocal_seasonOffset
                                                },
                                                "timestamp":            contract_timestamp,
                                                "id":                   contract_id
                                            },
                                            "measurementId":        measurementId,
                                            "measuredValue": {
                                                "timestampLocal": {
                                                    "timestamp":            measuredValue_timestampLocal_timestamp,
                                                    "localOffset":          measuredValue_timestampLocal_localOffset,
                                                    "seasonOffset":         measuredValue_timestampLocal_seasonOffset
                                                },
                                                "value":                measuredValue_value,
                                                "unit":                 measuredValue_unit,
                                                "scale":                measuredValue_scale,
                                                "valueType":            measuredValue_valueType,
                                                "unitEncoded":          measuredValue_unitEncoded
                                            },
                                            "measurand": {
                                                "id":                   measurand_id,
                                                "name":                 measurand_name
                                            },
                                            "additionalInfo": {
                                                "indexes": {
                                                    "timer":                additionalInfo_indexes_timer,
                                                    "logBook":              additionalInfo_indexes_logBook
                                                },
                                                "status":               additionalInfo_status
                                            },
                                            "chargePoint": {
                                                "softwareVersion":      chargePoint_softwareVersion
                                            },
                                            "signature":            signature
                                        });

                                }

                            }

                            //#endregion

                            let n = CTRArray.length-1;

                            CTR["@id"]  = CTRArray[n]!["transactionId"];
                            CTR.begin   = this.chargy.moment.unix(CTRArray[0]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();
                            CTR.end     = this.chargy.moment.unix(CTRArray[n]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format();

                            CTR.contract = {
                                    "@id":       CTRArray[0]!["contract"]["id"],
                                    "@context":  CTRArray[0]!["contract"]["type"]
                            };

                            CTR.chargingStationOperators = [{

                                "@id":              "chargeITmobilityCSO",
                                "description":      { "de": "chargeIT mobility GmbH - Charging Station Operator Services" },

                                "contact": {
                                    "email":    "info@chargeit-mobility.com",
                                    "web":      "https://www.chargeit-mobility.com",
                                    "logoUrl":  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                    "publicKeys": [{
                                        "algorithm":  "secp192r1",
                                        "format":     "DER",
                                        "value":      "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                        //"signatures":   [ ]
                                    },
                                    {
                                        "algorithm":    "secp256k1",
                                        "format":       "DER",
                                        "value":        "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                        //"signatures":   [ ]
                                    }
                                ]},

                                "support": {
                                    "hotline":                  "+49 9321 / 2680 - 700",
                                    "email":                    "service@chargeit-mobility.com",
                                    "web":                      "https://cso.chargeit.charging.cloud/issues"
                                    // "mediationServices":        [ "GraphDefined Mediation" ],
                                    // "publicKeys": [
                                    //     {
                                    //         "algorithm":        "secp256k1",
                                    //         "format":           "DER",
                                    //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                    //         "signatures":       [ ]
                                    //     }
                                    // ]
                                },

                                "privacy": {
                                    "contact":                  "Dr. iur. Christian Borchers, datenschutz süd GmbH",
                                    "email":                    "datenschutz@chargeit-mobility.com",
                                    "web":                      "http://www.chargeit-mobility.com/de/datenschutz/"
                                    // "publicKeys": [
                                    //     {
                                    //         "algorithm":        "secp256k1",
                                    //         "format":           "DER",
                                    //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                    //         "signatures":       [ ]
                                    //     }
                                    // ]
                                },

                                "chargingStations": [
                                    {
                                        "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
                                        // "description": {
                                        //     "de":                   "GraphDefined Charging Station - CI-Tests Pool 3 / Station A"
                                        // },
                                        "firmwareVersion":          CTRArray[0]!["chargePoint"]["softwareVersion"],
                                        "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                        "address": {
                                            "street":               address_street,
                                            "postalCode":           address_zipCode,
                                            "city":                 address_town,
                                            "country":              "Germany"
                                        },
                                        "EVSEs": [
                                            {
                                                "@id":                      evseId,
                                                // "description": {
                                                //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                                // },
                                                // "connectors": [{ }],
                                                "meters": [
                                                    {
                                                        "@id":                      CTRArray[0]!["meterInfo"]["meterId"],
                                                        "vendor":                   CTRArray[0]!["meterInfo"]["manufacturer"],
                                                        "vendorURL":                "http://www.emh-metering.de",
                                                        "model":                    CTRArray[0]!["meterInfo"]["type"],
                                                        "hardwareVersion":          "1.0",
                                                        "firmwareVersion":          CTRArray[0]!["meterInfo"]["firmwareVersion"],
                                                        "signatureFormat":          "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01",
                                                        "publicKeys": [
                                                            {
                                                                "algorithm":        "secp192r1",
                                                                "format":           "DER",
                                                                "value":            CTRArray[0]!["meterInfo"]["publicKey"].startsWith("04")
                                                                                        ?        CTRArray[0]!["meterInfo"]["publicKey"]
                                                                                        : "04" + CTRArray[0]!["meterInfo"]["publicKey"],
                                                                "signatures":       CTRArray[0]!["meterInfo"]["publicKeySignatures"]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]

                            }];

                            CTR.chargingSessions = [{

                                "@id":                          CTRArray[n]!["transactionId"],
                                "@context":                     "https://open.charging.cloud/contexts/SessionSignatureFormats/EMHCrypt01+json",
                                "begin":                        this.chargy.moment.unix(CTRArray[0]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                                "end":                          this.chargy.moment.unix(CTRArray[n]!["measuredValue"]["timestampLocal"]["timestamp"]).utc().format(),
                                "EVSEId":                       evseId,

                                "authorizationStart": {
                                    "@id":                      CTRArray[0]!["contract"]["id"],
                                    "type":                     CTRArray[0]!["contract"]["type"],
                                    "timestamp":                this.chargy.moment.unix(CTRArray[0]!["contract"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                                        CTRArray[0]!["contract"]["timestampLocal"]["localOffset"] +
                                                                                        CTRArray[0]!["contract"]["timestampLocal"]["seasonOffset"]).format(),
                                },

                                "measurements": [{

                                    "energyMeterId":        CTRArray[0]!["meterInfo"]["meterId"],
                                    "@context":             "https://open.charging.cloud/contexts/EnergyMeterSignatureFormats/EMHCrypt01+json",
                                    "name":                 CTRArray[0]!["measurand"]["name"],
                                    "obis":                 chargyLib.parseOBIS(CTRArray[0]!["measurand"]["id"]),
                                    "unit":                 CTRArray[0]!["measuredValue"]["unit"],
                                    "unitEncoded":          CTRArray[0]!["measuredValue"]["unitEncoded"],
                                    "valueType":            CTRArray[0]!["measuredValue"]["valueType"],
                                    "scale":                CTRArray[0]!["measuredValue"]["scale"],

                                    "signatureInfos": {
                                        "hash":                 chargyInterfaces.CryptoHashAlgorithms.SHA256,
                                        "hashTruncation":       24,
                                        "algorithm":            chargyInterfaces.CryptoAlgorithms.ECC,
                                        "curve":                "secp192r1",
                                        "format":               chargyInterfaces.SignatureFormats.rs
                                    },

                                    "values": [ ]

                                }]

                            }];

                            for (const measurement of CTRArray)
                            {
                                CTR["chargingSessions"][0]!["measurements"][0]!["values"].push({
                                    "timestamp":     this.chargy.moment.unix(measurement["measuredValue"]["timestampLocal"]["timestamp"]).utc().utcOffset(
                                                                            measurement["measuredValue"]["timestampLocal"]["localOffset"] +
                                                                            measurement["measuredValue"]["timestampLocal"]["seasonOffset"]).format(),
                                    "value":         parseInt(measurement["measuredValue"]["value"]),
                                    "infoStatus":    measurement["additionalInfo"]["status"],
                                    "secondsIndex":  measurement["additionalInfo"]["indexes"]["timer"],
                                    "paginationId":  measurement["measurementId"],
                                    "logBookIndex":  measurement["additionalInfo"]["indexes"]["logBook"],
                                    "signatures": [
                                        {
                                            "r":  measurement["signature"].substring(0, 48),
                                            "s":  measurement["signature"].substring(48)
                                        }
                                    ]
                                });
                            }

                            CTR["status"] = chargyInterfaces.SessionVerificationResult.Unvalidated;

                            return CTR;

                        }

                        //#endregion

                        return {
                            status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            errors:     errors,
                            warings:    warnings,
                            certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                        }

                    }

                }

                //#endregion

            }
            catch (exception)
            {
                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                    errors:     errors,
                    warings:    warnings,
                    certainty: (numberOfFormatChecks - errors.length - secondaryErrors)/numberOfFormatChecks
                }
            }

        }

        //#endregion

        //#region New chargeIT container format

        if (containerFormat == "https://www.eneco.com/contexts/charging-station-json-v0"             ||
            containerFormat == "https://www.eneco.com/contexts/charging-station-json-v1"             ||
            containerFormat == "https://www.chargeit-mobility.com/contexts/charging-station-json-v0" ||
            containerFormat == "https://www.chargeit-mobility.com/contexts/charging-station-json-v1")
        {

            //#region documentation

            // {
            //     "placeInfo": {
            //         "geoLocation": {
            //             "lat": 49.731421,
            //             "lon": 10.147718
            //         },
            //         "address": {
            //             "street": "Steigweg 24",
            //             "town": "Kitzingen",
            //             "zipCode": "97318"
            //         },
            //         "evseId": "DE*BDO*E2323234064*1"
            //     },
            //     "signedMeterValues": [
            //         {
            //             "payload": "AP;0;3;AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAABABMI5UAEVRZFV4AIAAEEAB7Y6AD4N2AIAAAAAAABQGQ3DKNCGIZATKOJVGU4DAAAAAAAAAAAWAAAAAKYAAAAA====;X7KCDU5IJHGUW64LDYHYR7IXRPPSKCMWAMQOVZVRNGRX6BEIHX3TFKUDJGEMUI5W5CJFTPDEWR7F6===;",
            //             "format": "ALFEN",
            //             "formatVersion": "0",
            //             "encoding": "HEX",
            //             "manufacturer": "Alfen BV"
            //         },
            //         {
            //             "payload": "AP;1;3;AJ2J7LYMGCIWT4AHUJPPFIIVB3FGRV2JQ2HVZG2I;BIHEIWSHAAA2WZUZOYYDCNWTWAFACRC2I4ADGAEDQ4AAAAAQFRGNUAFWZFFV4AIAAEEAB7Y6AA7ASAQAAAAAAABQGQ3DKNCGIZATKOJVGU4DAAAAAAAAAAAWAAAAALAAAAAA====;FXINYN5UF2LKAS633476F7V2GQGBP22KBCZD3TOSJCFLCFGYAAYTVJFIA7637NKQ22CZSEB2AOJJO===;",
            //             "format": "ALFEN",
            //             "formatVersion": "0",
            //             "encoding": "HEX",
            //             "manufacturer": "Alfen BV"
            //         }
            //     ]
            // }

            //#endregion

            try
            {

                const id = SomeJSON["@id"];
                if (!chargyLib.isMandatoryString(id)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    this.chargy.GetLocalizedMessage("Missing or invalid charge transparency record identification!"),
                    certainty:  1
                }

                //#region chargePointInfo

                const evseId                                   = SomeJSON?.chargePointInfo?.evseId;
                if (!chargyLib.isMandatoryString(evseId)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Missing or invalid EVSE Id!",
                    certainty:  1
                }


                const geoLocation_lat                          = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lat;
                if (!chargyLib.isOptionalNumber(geoLocation_lat)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid geo location latitude!",
                    certainty:  1
                }

                const geoLocation_lon                          = SomeJSON.chargePointInfo?.placeInfo?.geoLocation?.lon;
                if (!chargyLib.isOptionalNumber(geoLocation_lon)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid geo location longitude!",
                    certainty:  1
                }


                const address_street                           = SomeJSON.chargePointInfo?.placeInfo?.address?.street;
                if (!chargyLib.isOptionalString(address_street)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid address street!",
                    certainty:  1
                }

                const address_zipCode                          = SomeJSON.chargePointInfo?.placeInfo?.address?.zipCode;
                if (!chargyLib.isOptionalString(address_zipCode)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid address zipCode!",
                    certainty:  1
                }

                const address_town                             = SomeJSON.chargePointInfo?.placeInfo?.address?.town;
                if (!chargyLib.isOptionalString(address_town)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid address town!",
                    certainty:  1
                }

                const address_country                          = SomeJSON.chargePointInfo?.placeInfo?.address?.country;
                if (!chargyLib.isOptionalString(address_country)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid address country!",
                    certainty:  1
                }

                //#endregion

                //#region chargingStationInfo

                const chargingStation_manufacturer               = SomeJSON.chargingStationInfo?.manufacturer;
                if (!chargyLib.isOptionalString(chargingStation_manufacturer)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid charging station manufacturer!",
                    certainty:  1
                }

                const chargingStation_type                       = SomeJSON.chargingStationInfo?.type;
                if (!chargyLib.isOptionalString(chargingStation_type)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid charging station type!",
                    certainty:  1
                }

                const chargingStation_serialNumber               = SomeJSON.chargingStationInfo?.serialNumber;
                if (!chargyLib.isOptionalString(chargingStation_serialNumber)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid charging station serial number!",
                    certainty:  1
                }

                const chargingStation_controllerSoftwareVersion  = SomeJSON.chargingStationInfo?.controllerSoftwareVersion;
                if (!chargyLib.isOptionalString(chargingStation_controllerSoftwareVersion)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid charging station controller software version!",
                    certainty:  1
                }

                const chargingStation_compliance                 = SomeJSON.chargingStationInfo?.compliance;
                if (!chargyLib.isOptionalString(chargingStation_compliance)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid charging station compliance!",
                    certainty:  1
                }

                //#endregion

                const signedMeterValues = SomeJSON?.signedMeterValues as Array<any>;
                if (signedMeterValues == undefined || signedMeterValues == null || !Array.isArray(signedMeterValues)) return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Invalid signed meter values!",
                    certainty:  1
                }

                const smvContext = chargyLib.isMandatoryString(signedMeterValues[0]["@context"])
                                       ? signedMeterValues[0]["@context"]?.trim()
                                       : chargyLib.isMandatoryString(signedMeterValues[0]?.format)
                                             ? signedMeterValues[0]?.format?.trim()
                                             : null;

                for (let i = 1; i < signedMeterValues.length; i++)
                {

                    let context = chargyLib.isMandatoryString(signedMeterValues[i]["@context"])
                                      ? signedMeterValues[i]["@context"]?.trim()
                                      : chargyLib.isMandatoryString(signedMeterValues[i]?.format)
                                            ? signedMeterValues[i]?.format?.trim()
                                            : null;

                    if (smvContext !== context) return {
                        status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                        message:    "Inconsistent signed meter value format!",
                        certainty:  1
                    }

                }


                //#region Generate default-transparency record

                let CTR: chargyInterfaces.IChargeTransparencyRecord = {

                    "@id":              "",
                    "@context":         "https://open.charging.cloud/contexts/CTR+json",

                    "description": {
                        "de":           "Alle Ladevorgänge"
                    },

                    "chargingStationOperators": [
                        {

                            "@id":                      "chargeITmobilityCSO",
                            "@context":                 "",
                            //"eMobilityIds":             [ "DE*BDO", "DE*LVF", "+49*822" ],
                            "description": {
                                "de":                   "chargeIT mobility GmbH - Charging Station Operator Services"
                            },

                            "contact": {
                                "email":                    "info@chargeit-mobility.com",
                                "web":                      "https://www.chargeit-mobility.com",
                                "logoUrl":                  "http://www.chargeit-mobility.com/fileadmin/BELECTRIC_Drive/templates/pics/chargeit_logo_408x70.png",
                                "publicKeys": [
                                    {
                                        "algorithm":        "secp192r1",
                                        "format":           "DER",
                                        "value":            "042313b9e469612b4ca06981bfdecb226e234632b01d84b6a814f63a114b7762c34ddce2e6853395b7a0f87275f63ffe3c",
                                        "signatures": [
                                            {
                                                "keyId":      "...",
                                                "algorithm":  "secp192r1",
                                                "format":     "DER",
                                                "value":      "????"
                                            }
                                        ]
                                    },
                                    {
                                        "algorithm":        "secp256k1",
                                        "format":           "DER",
                                        "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                        "signatures":       [ ]
                                    }
                                ]
                            },

                            "support": {
                                "hotline":                  "+49 9321 / 2680 - 700",
                                "email":                    "service@chargeit-mobility.com",
                                "web":                      "https://cso.chargeit.charging.cloud/issues"
                                // "mediationServices":        [ "GraphDefined Mediation" ],
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256k1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "privacy": {
                                "contact":                  "Dr. iur. Christian Borchers, datenschutz süd GmbH",
                                "email":                    "datenschutz@chargeit-mobility.com",
                                "web":                      "http://www.chargeit-mobility.com/de/datenschutz/"
                                // "publicKeys": [
                                //     {
                                //         "algorithm":        "secp256k1",
                                //         "format":           "DER",
                                //         "value":            "04a8ff0d82107922522e004a167cc658f0eef408c5020f98e7a2615be326e61852666877335f4f8d9a0a756c26f0c9fb3f401431416abb5317cc0f5d714d3026fe",
                                //         "signatures":       [ ]
                                //     }
                                // ]
                            },

                            "chargingStations": [
                                {
                                    "@id":                      evseId.substring(0, evseId.lastIndexOf("*")),
                                    //"@context":                 "",
                                    //"description":              { },
                                    //"firmwareVersion":          "", //CTRArray[0]["chargePoint"]["softwareVersion"],
                                    "geoLocation":              { "lat": geoLocation_lat, "lng": geoLocation_lon },
                                    "address": {
                                        //"@context":             "",
                                        "street":               address_street,
                                        "postalCode":           address_zipCode,
                                        "city":                 address_town,
                                        "country":              "Germany"
                                    },
                                    "EVSEs": [
                                        {
                                            "@id":                      evseId,
                                            //"@context":                 "",
                                            // "description": {
                                            //     "de":                   "GraphDefined EVSE - CI-Tests Pool 3 / Station A / EVSE 1"
                                            // },
                                            //"connectors":               [  ],
                                            "meters":                   [ ]
                                        }
                                    ]
                                }
                            ]

                        }
                    ]

                };

                //#endregion

                if      (smvContext?.startsWith("https://www.chargeit-mobility.com/contexts/bsm-ws36a-json"))
                    return await new BSMCrypt01(this.chargy).tryToParseBSM_WS36aMeasurements(CTR, evseId, chargingStation_controllerSoftwareVersion, signedMeterValues);

                if (smvContext?.startsWith("ALFEN"))
                    return await new Alfen01(this.chargy).tryToParseALFENFormat(signedMeterValues.map(value => value.payload));

                return {
                    status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                }

            }
            catch (exception)
            {
                return {
                    status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                    message:    "Exception occured: " + (exception instanceof Error ? exception.message : exception),
                    certainty:  1
                }
            }

        }

        //#endregion



        return {
            status:  chargyInterfaces.SessionVerificationResult.InvalidSessionFormat
        }

    }

    //#endregion

}
