/*
 * Copyright (c) 2018-2024 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
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
import { Alfen }              from './Alfen'
import { OCMF }               from './OCMF'
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'

export class SAFEXML  {

    private readonly chargy: Chargy;

    constructor(chargy: Chargy) {
        this.chargy  = chargy;
    }

    //#region tryToParseSAFEXML(XMLDocument)

    public async tryToParseSAFEXML(XMLDocument: Document) : Promise<chargyInterfaces.IChargeTransparencyRecord|chargyInterfaces.ISessionCryptoResult>
    {

        // The SAFE transparency software v1.0 does not understand its own
        // XML namespace. Therefore we have to guess the format.

        try
        {

            let commonFormat             = "";
            let commonPublicKey          = "";
            let commonPublicKeyEncoding  = "";
            let signedValues:string[]    = [];

            let values = XMLDocument.querySelectorAll("values");
            if (values.length == 1)
            {
                const valueList = values[0]?.querySelectorAll("value");

                if (valueList        != null &&
                    valueList.length >= 1)
                {
                    for (let i=0; i<valueList.length; i++)
                    {

                        let signedDataEncoding  = "";
                        let signedDataFormat    = "";
                        let signedDataValue     = "";
                        let publicKeyEncoding   = "";
                        let publicKeyValue      = "";

                        //#region <signedData>...</signedData>

                        const signedData = valueList[i]?.querySelector("signedData");
                        if (signedData != null)
                        {

                            signedDataEncoding = signedData.attributes.getNamedItem("encoding") !== null ? signedData.attributes.getNamedItem("encoding")!.value.trim().toLowerCase() : "";
                            signedDataFormat   = signedData.attributes.getNamedItem("format")   !== null ? signedData.attributes.getNamedItem("format")!.value.trim().toLowerCase()   : "";
                            signedDataValue    = signedData.textContent                         !== null ? signedData.textContent.trim()                                              : "";

                            switch (signedDataEncoding)
                            {

                                case "":
                                case "plain":
                                    signedDataValue = Buffer.from(signedDataValue, 'utf8').toString().trim();
                                    break;

                                case "base32":
                                    signedDataValue = Buffer.from(this.chargy.base32Decode(signedDataValue, 'RFC4648')).toString().trim();
                                    break;

                                case "base64":
                                    signedDataValue = Buffer.from(signedDataValue, 'base64').toString().trim();
                                    break;

                                case "hex": // Some people put whitespaces, '-' or ':' into the hex format!
                                    signedDataValue = Buffer.from(signedDataValue.replace(/[^a-fA-F0-9]/g, ''), 'hex').toString().trim();
                                    break;

                                default:
                                    return {
                                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                        message:   "Unkown signed data encoding within the given SAFE XML!",
                                        certainty: 0
                                    }

                            }

                            switch (signedDataFormat)
                            {

                                case "alfen":
                                    if (commonFormat == "")
                                        commonFormat = "alfen";
                                    else if (commonFormat != "alfen")
                                        return {
                                            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                            message:   "Invalid mixture of different signed data formats within the given SAFE XML!",
                                            certainty: 0
                                        }
                                    break;

                                case "edl":
                                    if (commonFormat == "")
                                        commonFormat = "edl";
                                    else if (commonFormat != "edl")
                                        return {
                                            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                            message:   "Invalid mixture of different signed data formats within the given SAFE XML!",
                                            certainty: 0
                                        }
                                    break;

                                case "ocmf":
                                    if (commonFormat == "")
                                        commonFormat = "ocmf";
                                    else if (commonFormat != "ocmf")
                                        return {
                                            status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                            message:   "Invalid mixture of different signed data formats within the given SAFE XML!",
                                            certainty: 0
                                        }
                                    break;

                                default:
                                    return {
                                        status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                        message:   "Unkown signed data formats within the given SAFE XML!",
                                        certainty: 0
                                    }

                            }

                            if (chargyLib.IsNullOrEmpty(signedDataValue))
                                return {
                                    status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                    message:   "The signed data value within the given SAFE XML must not be empty!",
                                    certainty: 0
                                }

                            signedValues.push(signedDataValue);

                        }
                        else
                            return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "The signed data tag within the given SAFE XML must not be empty!",
                                certainty: 0
                            }

                        //#endregion

                        //#region <publicKey>...</publicKey>

                        // Note: The public key is optional!
                        const publicKey  = valueList[i]?.querySelector("publicKey");
                        if (publicKey)
                        {

                            publicKeyEncoding = publicKey.attributes.getNamedItem("encoding")?.value.trim().toLowerCase() ?? "";
                            publicKeyValue    = publicKey.textContent?.trim()                                             ?? "";

                            // switch (publicKeyEncoding)
                            // {

                            //     case "":
                            //     case "plain":
                            //         //publicKeyValue = Buffer.from(publicKeyValue, 'utf8').toString('hex').trim();
                            //         break;

                            //     case "base32":
                            //         publicKeyValue = Buffer.from(this.chargy.base32Decode(publicKeyValue, 'RFC4648')).toString('hex').trim();
                            //         break;

                            //     case "base64":
                            //         publicKeyValue = Buffer.from(publicKeyValue, 'base64').toString('hex').trim();
                            //         break;

                            //     case "hex":
                            //         //publicKeyValue = Buffer.from(publicKeyValue, 'hex').toString('hex').trim();
                            //         break;

                            //     default:
                            //         return {
                            //             status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                            //             message:   "Unkown public key encoding within the given SAFE XML!",
                            //             certainty: 0
                            //         }

                            // }

                            if (chargyLib.IsNullOrEmpty(publicKeyValue)) return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "The public key within the given SAFE XML must not be empty!",
                                certainty: 0
                            }

                            else if (commonPublicKey == "")
                                commonPublicKey          = publicKeyValue;

                            else if (commonPublicKeyEncoding == "")
                                commonPublicKeyEncoding  = publicKeyEncoding;

                            else if (publicKeyValue != commonPublicKey) return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different public keys within the given SAFE XML!",
                                certainty: 0
                            }

                            else if (publicKeyEncoding != commonPublicKeyEncoding) return {
                                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                message:   "Invalid mixture of different public key encodings within the given SAFE XML!",
                                certainty: 0
                            }

                        }

                        //#endregion

                    }
                }
            }

            switch (commonFormat)
            {

                case "alfen":
                    return await new Alfen(this.chargy).
                                     TryToParseALFENFormat(signedValues,
                                                           {});

                case "ocmf":
                    return await new OCMF(this.chargy).
                                     TryToParseOCMFDocuments(signedValues,
                                                             commonPublicKey,
                                                             commonPublicKeyEncoding,
                                                             {});

            }

            return {
                status:    chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"),
                certainty: 0
            }

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

}
