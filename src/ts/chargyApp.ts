/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
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

import {
    Chargy,
    ChargyInterfaces as chargyInterfaces,
    ChargeTransparencyLiveLink as chargeTransparencyLiveLink,
    ChargeTransparencyRecord as chargeTransparencyRecord,
    PublicKeyInfo as publicKeyInfo,
    readQRCodeTextFromImageData
}                                      from '@open-charging-cloud/chargy-core'
import * as chargyLib                   from '@open-charging-cloud/chargy-core'
import * as L                           from 'leaflet';
import Decimal                          from 'decimal.js';
import corePackageJson                  from '@open-charging-cloud/chargy-core/package.json';
import coreI18n                         from '@open-charging-cloud/chargy-core/i18n.json';
import webAppI18n                       from '../i18n.json';
import {
    decodeBase64Url as decodeDeepLinkBase64Url,
    decodeUtf8 as decodeDeepLinkUtf8,
    findExternalURLRule,
    getDeepLinkFileName,
    parseExternalURLConfig,
    readResponseWithinLimit,
    withDeepLinkVerificationToken,
    type ExternalURLRule
}                                      from './deepLinks';

import '../scss/chargy.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';

type DetectionResult = chargeTransparencyRecord.  IChargeTransparencyRecord   |
                       chargeTransparencyLiveLink.IChargeTransparencyLiveLink |
                       publicKeyInfo.             IPublicKeyInfo              |
                       chargyInterfaces.          ISessionCryptoResult;

type DetectionOptions = {
    prepareUI?: boolean;
    onError?:   (result: chargyInterfaces.ISessionCryptoResult) => void;
};

type SaveFilePicker = (options: {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
}) => Promise<{
    createWritable(): Promise<{
        write(data: string): Promise<void>;
        close(): Promise<void>;
    }>;
}>;

type WindowWithSaveFilePicker = Window & {
    showSaveFilePicker?: SaveFilePicker;
};

const supportedLanguages = [ "de", "en" ] as const;

type SupportedLanguage = typeof supportedLanguages[number];

export class ChargyApp {

    //#region Data

    private readonly leaflet:                   any;
    private readonly map:                       L.Map;

    private readonly elliptic:                  any;
    private readonly moment:                    any;
    private readonly chargy:                    Chargy;
    private readonly asn1:                      any;
    private readonly base32Decode:              any;

    public  appEdition:                         string              = "";
    public  copyright:                          string              = "";
    public  versionsURL:                        string              = "";
    public  defaultFeedbackEMail:               string[]            = [];
    public  defaultFeedbackHotline:             string[]            = [];
    public  defaultIssueURL:                    string              = "";
    public  packageJson:                        any                 = {};
    public  i18n:                               chargyInterfaces.I18NDictionary = {};
    public  UILanguage:                         SupportedLanguage   = "en";

    private currentAppInfos:                    any                 = null;
    private currentVersionInfos:                any                 = null;
    private currentPackage:                     any                 = null;
    private applicationHash:                    string              = "";

    private markers:                            any                 = [];
    private minlat:                             number              =  1000;
    private maxlat:                             number              = -1000;
    private minlng:                             number              =  1000;
    private maxlng:                             number              = -1000;

    private appDiv:                             HTMLDivElement;
    private headlineDiv:                        HTMLDivElement;
    private verifyframeDiv:                     HTMLDivElement;

    private languageSelectorDiv:                HTMLDivElement;
    private languageButton:                     HTMLButtonElement;
    private languageMenuDiv:                    HTMLDivElement;
    private languageFlagImage:                  HTMLImageElement;
    private updateAvailableButton:              HTMLButtonElement;
    private aboutButton:                        HTMLButtonElement;
    private fullScreenButton:                   HTMLButtonElement;

    private updateAvailableScreen:              HTMLDivElement;
    private inputDiv:                           HTMLDivElement;
    private inputInfosDiv:                      HTMLDivElement;
    private aboutScreenDiv:                     HTMLDivElement;
    private imprintScreenDiv:                   HTMLDivElement;
    private applicationHashDiv:                 HTMLDivElement;
    private applicationHashValueDiv:            HTMLDivElement;
    private softwareInfosDiv:                   HTMLDivElement;
    private openSourceLibsDiv:                  HTMLDivElement;
    private chargingSessionScreenDiv:           HTMLDivElement;
    private invalidDataSetsScreenDiv:           HTMLDivElement;
    private inputButtonsDiv:                    HTMLDivElement;
    private backButton:                         HTMLButtonElement;
    private exportButtonDiv:                    HTMLDivElement;
    private exportButton:                       HTMLButtonElement;
    private fileInputButton:                    HTMLButtonElement;
    private fileInput:                          HTMLInputElement;
    private qrScanButton:                       HTMLButtonElement;
    private pasteButton:                        HTMLButtonElement;
    private detailedInfosDiv:                   HTMLDivElement;
    private errorTextDiv:                       HTMLDivElement;
    private feedbackDiv:                        HTMLDivElement;

    private showFeedbackSection:                boolean;
    private feedbackMethodsDiv:                 HTMLDivElement;
    private feedbackEMailAnchor:                HTMLAnchorElement;
    private feedbackHotlineAnchor:              HTMLAnchorElement;
    private showIssueTrackerButton:             HTMLButtonElement;
    private showImprintButton:                  HTMLButtonElement;
    private issueTrackerText:                   HTMLDivElement;

    private chargingTariffDetailsDiv:           HTMLDivElement;
    private chargingTariffDetailsLeftButton:    HTMLButtonElement;

    private chargingPeriodDetailsDiv:           HTMLDivElement;
    private chargingPeriodDetailsLeftButton:    HTMLButtonElement;

    private measurementsDetailsDiv:             HTMLDivElement;
    private measurementsDetailsLeftButton:      HTMLButtonElement;

    private issueTrackerDiv:                    HTMLDivElement;
    private issueTrackerLeftButton:             HTMLButtonElement;
    private privacyStatement:                   HTMLDivElement;
    private showPrivacyStatement:               HTMLButtonElement;
    private privacyStatementAccepted:           HTMLInputElement;
    private sendIssueButton:                    HTMLButtonElement;

    private pkiDetailsDiv:                      HTMLDivElement;
    private pkiDetailsLeftButton:               HTMLButtonElement;

    private qrCodeScannerDiv:                   HTMLDivElement;
    private qrCodeScannerVideo:                 HTMLVideoElement;
    private qrCodeScannerCanvas:                HTMLCanvasElement;
    private qrCodeScannerStatusDiv:             HTMLDivElement;
    private qrCodeScannerErrorDiv:              HTMLDivElement;
    private qrCodeScannerResultDiv:             HTMLDivElement;
    private qrCodeScannerResultText:            HTMLPreElement;
    private qrCodeScannerURLActionsDiv:         HTMLDivElement;
    private qrCodeScannerOpenURLButton:         HTMLButtonElement;
    private qrCodeScannerRescanButton:          HTMLButtonElement;
    private qrCodeScannerCancelButton:          HTMLButtonElement;
    private qrCodeScannerStream:                MediaStream|null     = null;
    private qrCodeScannerAnimationFrame:        number|null          = null;
    private qrCodeScannerIsProcessing:          boolean              = false;
    private qrCodeScannerLastText:              string|null          = null;
    private qrCodeScannerLastURL:               URL|null             = null;

    private currentChargeTransparencyRecord:    chargeTransparencyRecord.IChargeTransparencyRecord|null = null;
    private currentChargeTransparencyLiveLink:  chargeTransparencyLiveLink.IChargeTransparencyLiveLink|null = null;
    private currentGlobalError:                 chargyInterfaces.ISessionCryptoResult|null = null;

    //#endregion

    //#region Constructor

    constructor(appEdition?:           string,
                copyright?:            string,
                versionsURL?:          string,
                showFeedbackSection?:  boolean,
                feedbackEMail?:        string[],
                feedbackHotline?:      string[],
                issueURL?:             string) {

        //#region Set parameters

        this.appEdition                = appEdition          ?? "";
        this.copyright                 = copyright           ?? "";
        this.versionsURL               = versionsURL         ?? "https://chargy.charging.cloud/apps/web/versions";
        this.showFeedbackSection       = showFeedbackSection ?? false;
        this.defaultFeedbackEMail      = feedbackEMail       ?? [];
        this.defaultFeedbackHotline    = feedbackHotline     ?? [];
        this.defaultIssueURL           = issueURL            ?? "";
        this.UILanguage                = this.getInitialUILanguage();

        //#endregion

        //#region Load external data from web server

        void this.loadI18n().then(async () => {
            this.applyTranslations();
            await this.updateQRCodeScannerAvailability();
        });
        void this.loadPackageJSON();

        //#endregion

        //#region Load JavaScript libraries

        this.elliptic                                 = require('elliptic');
        this.moment                                   = require('moment');
        this.asn1                                     = require('asn1.js');
        this.base32Decode                             = require('base32-decode')

        //#endregion

        //#region GUI setup

        this.appDiv                                   = document.getElementById('app')                                      as HTMLDivElement;
        this.headlineDiv                              = document.getElementById('headline')                                 as HTMLDivElement;
        this.verifyframeDiv                           = document.getElementById('verifyframe')                              as HTMLDivElement;

        this.updateAvailableScreen                    = document.getElementById('updateAvailableScreen')                    as HTMLDivElement;
        this.chargingSessionScreenDiv                 = document.getElementById('chargingSessionScreen')                    as HTMLDivElement;
        this.invalidDataSetsScreenDiv                 = document.getElementById('invalidDataSetsScreen')                    as HTMLDivElement;
        this.detailedInfosDiv                         = document.getElementById('detailedInfos')                            as HTMLDivElement;
        this.inputDiv                                 = document.getElementById('input')                                    as HTMLDivElement;
        this.inputInfosDiv                            = document.getElementById('inputInfos')                               as HTMLDivElement;
        this.errorTextDiv                             = document.getElementById('errorText')                                as HTMLDivElement;

        this.applicationHashDiv                       = document.getElementById('applicationHash')                          as HTMLDivElement;
        this.applicationHashValueDiv                  = this.applicationHashDiv.querySelector("#value")                     as HTMLDivElement;

        this.feedbackDiv                              = document.getElementById('feedback')                                 as HTMLDivElement;
        this.feedbackMethodsDiv                       = this.feedbackDiv.       querySelector("#feedbackMethods")           as HTMLDivElement;
        this.showIssueTrackerButton                   = this.feedbackMethodsDiv.querySelector("#showIssueTracker")          as HTMLButtonElement;
        this.feedbackEMailAnchor                      = this.feedbackMethodsDiv.querySelector("#eMail")                     as HTMLAnchorElement;
        this.feedbackHotlineAnchor                    = this.feedbackMethodsDiv.querySelector("#hotline")                   as HTMLAnchorElement;
        this.showImprintButton                        = this.feedbackMethodsDiv.querySelector("#showImprint")               as HTMLButtonElement;

        this.aboutScreenDiv                           = document.getElementById('aboutScreen')                              as HTMLDivElement;
        this.imprintScreenDiv                         = document.getElementById('imprintScreen')                            as HTMLDivElement;
        this.softwareInfosDiv                         = this.aboutScreenDiv.    querySelector("#softwareInfos")             as HTMLDivElement;
        this.openSourceLibsDiv                        = this.aboutScreenDiv.    querySelector("#openSourceLibs")            as HTMLDivElement;

        this.languageSelectorDiv                      = document.getElementById('languageSelector')                         as HTMLDivElement;
        this.languageButton                           = document.getElementById('languageButton')                           as HTMLButtonElement;
        this.languageMenuDiv                          = document.getElementById('languageMenu')                             as HTMLDivElement;
        this.languageFlagImage                        = document.getElementById('languageFlag')                             as HTMLImageElement;
        this.updateAvailableButton                    = document.getElementById('updateAvailableButton')                    as HTMLButtonElement;
        this.aboutButton                              = document.getElementById('aboutButton')                              as HTMLButtonElement;
        this.fullScreenButton                         = document.getElementById('fullScreenButton')                         as HTMLButtonElement;

        this.chargingTariffDetailsDiv                 = document.getElementById('chargingTariffDetails')                    as HTMLDivElement;
        this.chargingTariffDetailsLeftButton          = this.chargingTariffDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingTariffDetailsLeftButton.onclick  = () => {
                                                            this.chargingTariffDetailsDiv.style.display = 'none';
                                                        }

        this.chargingPeriodDetailsDiv                 = document.getElementById('chargingPeriodDetails')                    as HTMLDivElement;
        this.chargingPeriodDetailsLeftButton          = this.chargingPeriodDetailsDiv.querySelector(".overlayLeftButton")   as HTMLButtonElement;
        this.chargingPeriodDetailsLeftButton.onclick  = () => {
                                                            this.chargingPeriodDetailsDiv.style.display = 'none';
                                                        }

        this.measurementsDetailsDiv                   = document.getElementById('measurementsDetails')                      as HTMLDivElement;
        this.measurementsDetailsLeftButton            = this.measurementsDetailsDiv.querySelector(".overlayLeftButton")     as HTMLButtonElement;
        this.measurementsDetailsLeftButton.onclick    = () => {
                                                            this.measurementsDetailsDiv.style.display = 'none';
                                                        }

        this.issueTrackerDiv                          = document.getElementById('issueTracker')                             as HTMLDivElement;
        this.issueTrackerText                         = this.issueTrackerDiv.   querySelector(".overlayText")               as HTMLDivElement;
        this.privacyStatement                         = this.issueTrackerDiv.   querySelector("#privacyStatement")          as HTMLDivElement;
        this.showPrivacyStatement                     = this.issueTrackerDiv.   querySelector("#showPrivacyStatement")      as HTMLButtonElement;
        this.privacyStatementAccepted                 = this.issueTrackerDiv.   querySelector("#privacyStatementAccepted")  as HTMLInputElement;
        this.sendIssueButton                          = this.issueTrackerDiv.   querySelector("#sendIssueButton")           as HTMLButtonElement;
        this.issueTrackerLeftButton                   = this.issueTrackerDiv.   querySelector(".overlayLeftButton")         as HTMLButtonElement;
        this.issueTrackerLeftButton.onclick           = () => {
                                                            this.issueTrackerDiv.style.display = 'none';
                                                        }

        this.pkiDetailsDiv                            = document.getElementById('pkiDetails')                               as HTMLDivElement;
        this.pkiDetailsLeftButton                     = this.pkiDetailsDiv.querySelector(".overlayLeftButton")              as HTMLButtonElement;
        this.pkiDetailsLeftButton.onclick             = () => {
                                                            this.pkiDetailsDiv.style.display = 'none';
                                                        }

        this.fileInputButton                          = document.getElementById('fileInputButton')                          as HTMLButtonElement;
        this.qrScanButton                             = document.getElementById('qrScanButton')                             as HTMLButtonElement;
        this.pasteButton                              = document.getElementById('pasteButton')                              as HTMLButtonElement;

        this.qrCodeScannerDiv                         = document.getElementById('qrCodeScanner')                            as HTMLDivElement;
        this.qrCodeScannerVideo                       = this.qrCodeScannerDiv.querySelector("#qrCodeScannerVideo")          as HTMLVideoElement;
        this.qrCodeScannerCanvas                      = this.qrCodeScannerDiv.querySelector("#qrCodeScannerCanvas")         as HTMLCanvasElement;
        this.qrCodeScannerStatusDiv                   = this.qrCodeScannerDiv.querySelector("#qrCodeScannerStatus")         as HTMLDivElement;
        this.qrCodeScannerErrorDiv                    = this.qrCodeScannerDiv.querySelector(".headline .error")             as HTMLDivElement;
        this.qrCodeScannerResultDiv                   = this.qrCodeScannerDiv.querySelector("#qrCodeScannerResult")         as HTMLDivElement;
        this.qrCodeScannerResultText                  = this.qrCodeScannerDiv.querySelector("#qrCodeScannerResultText")     as HTMLPreElement;
        this.qrCodeScannerURLActionsDiv               = this.qrCodeScannerDiv.querySelector("#qrCodeScannerURLActions")     as HTMLDivElement;
        this.qrCodeScannerOpenURLButton               = this.qrCodeScannerDiv.querySelector("#qrCodeScannerOpenURLButton")  as HTMLButtonElement;
        this.qrCodeScannerRescanButton                = this.qrCodeScannerDiv.querySelector("#qrCodeScannerRescanButton")   as HTMLButtonElement;
        this.qrCodeScannerCancelButton                = this.qrCodeScannerDiv.querySelector(".overlayLeftButton")           as HTMLButtonElement;

        this.inputButtonsDiv                          = document.getElementById('inputButtons')                             as HTMLDivElement;
        this.backButton                               = this.inputButtonsDiv.   querySelector("#backButton")                as HTMLButtonElement;

        this.exportButtonDiv                          = document.getElementById('exportButtonDiv')                          as HTMLDivElement;
        this.exportButton                             = this.exportButtonDiv.   querySelector("#exportButton")              as HTMLButtonElement;

        //#endregion

        this.chargy                                   = new Chargy(
                                                            this.i18n,
                                                            this.UILanguage,
                                                            this.elliptic,
                                                            this.moment,
                                                            this.asn1,
                                                            this.base32Decode,
                                                            this.showPKIDetails.bind(this)
                                                        );

        void this.setUILanguage(this.UILanguage, false);
        this.setupLanguageSelector();


        //#region OnWindowResize

        window.onresize = () => {
            this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
        }

        // Call it once on application start
        window.dispatchEvent(new Event("resize"));

        //#endregion

        //#region Set infos of the feedback section

        this.UpdateFeedbackSection();

        //#endregion

        void this.handleDeepLinkVerificationData();

        //#region The Issue tracker

        this.showPrivacyStatement.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.privacyStatement.style.display = "block";
            this.issueTrackerText.scrollTop = this.issueTrackerText.scrollHeight;
        }

        this.privacyStatementAccepted.onchange = () => {
            this.sendIssueButton.disabled  = !this.privacyStatementAccepted.checked;
        }

        this.sendIssueButton.onclick = (ev: MouseEvent) => {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                const newIssueForm = document.getElementById('newIssueForm') as HTMLFormElement;

                const queryRequired = (selector: string): Element => {

                    const element = newIssueForm.querySelector(selector);

                    if (element == null)
                        throw new Error("Missing issue form element: " + selector);

                    return element;

                };

                const queryInput = (selector: string): HTMLInputElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLInputElement))
                        throw new Error("Issue form element is not an input: " + selector);

                    return element;

                };

                const querySelect = (selector: string): HTMLSelectElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLSelectElement))
                        throw new Error("Issue form element is not a select: " + selector);

                    return element;

                };

                const queryTextArea = (selector: string): HTMLTextAreaElement => {

                    const element = queryRequired(selector);

                    if (!(element instanceof HTMLTextAreaElement))
                        throw new Error("Issue form element is not a textarea: " + selector);

                    return element;

                };

                const packageJson = this.packageJson as { version?: unknown };
                const data: chargyInterfaces.IssueReportPayload = {
                    timestamp:                  new Date().toISOString(),
                    chargyVersion:              typeof packageJson.version === "string" ? packageJson.version : "",
                    platform:                   process.platform,
                    invalidCTR:                 queryInput("#invalidCTR").checked,
                    InvalidStationData:         queryInput("#InvalidStationData").checked,
                    invalidSignatures:          queryInput("#invalidSignatures").checked,
                    invalidCertificates:        queryInput("#invalidCertificates").checked,
                    transparencenySoftwareBug:  queryInput("#transparencenySoftwareBug").checked,
                    DSGVO:                      queryInput("#DSGVO").checked,
                    BITV:                       queryInput("#BITV").checked,
                    description:                queryTextArea("#issueDescription").value,
                    name:                       queryInput("#issueName").value,
                    phone:                      queryInput("#issuePhone").value,
                    eMail:                      queryInput("#issueEMail").value
                };

                if (querySelect("#includeCTR").value == "yes")
                {
                    try
                    {

                        const ctr = JSON.stringify(this.chargy.currentCTR);

                        if (ctr !== "{}")
                            data["chargeTransparencyRecord"] = ctr;

                    }
                    catch
                    {
                        // Optional diagnostic attachment; the issue report itself can still be sent.
                    }
                }

                //#endregion

                //#region Send issue to API

                const sendIssue = new XMLHttpRequest();

                sendIssue.open("SUBMIT",
                               this.defaultIssueURL,
                               true);
                sendIssue.setRequestHeader('Content-type', 'application/json');

                sendIssue.onreadystatechange = () => {

                    // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
                    if (sendIssue.readyState == 4) {

                        if (sendIssue.status == 201) { // HTTP 201 - Created
                            (document.getElementById('issueTracker') as HTMLDivElement).style.display  = 'none';
                            //ToDo: Show thank you for your issue!
                        }

                        else
                        {
                            alert(this.getLocalizedText("issueSubmitFailed"));
                        }

                    }

                }

                sendIssue.send(JSON.stringify(data));

                //#endregion

            }
            catch (exception)
            {
                alert(this.getLocalizedText("issueSubmitFailed") + ": " + (exception instanceof Error ? exception.message : String(exception)));
            }

        }

        //#endregion


        //#region Handle the 'Update available'-button

        this.updateAvailableButton.onclick = () => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.imprintScreenDiv.style.display          = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";
        }

        //#endregion

        //#region Handle the 'About'-button

        this.aboutButton.onclick = async () => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "block";
            this.imprintScreenDiv.style.display          = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";

            //#region Check application hash signatures, when given...

            if (this.currentAppInfos     != null &&
                this.currentVersionInfos != null &&
                this.currentPackage      != null &&
                this.applicationHash     != "")
            {

                const sigHeadDiv = this.applicationHashDiv.children[2];

                if (sigHeadDiv != null)
                {

                    // Bad hash value
                    if (this.currentPackage.cryptoHashes.SHA512.replace("0x", "") !== this.applicationHash)
                        sigHeadDiv.innerHTML = "<i class=\"fas fa-times-circle\"></i> " + this.getLocalizedText("invalidHashValue");

                    // At least the same hash value...
                    else
                    {

                        if (this.currentPackage.signatures == null || this.currentPackage.signatures.length == 0)
                        {
                            sigHeadDiv.innerHTML = "<i class=\"fas fa-check-circle\"></i> " + this.getLocalizedText("validHashValue");
                        }

                        // Some crypto signatures found...
                        else
                        {

                            sigHeadDiv.innerHTML = this.getLocalizedText("confirmedBy");

                            const signaturesDiv = this.applicationHashDiv.children[3];

                            if (signaturesDiv != null)
                            {
                                for (const signature of this.currentPackage.signatures)
                                {

                                    const signatureDiv = signaturesDiv.appendChild(document.createElement('div'));

                                    signatureDiv.innerHTML = await this.checkApplicationHashSignature(this.currentAppInfos,
                                                                                                      this.currentVersionInfos,
                                                                                                      this.currentPackage,
                                                                                                      signature);

                                }
                            }

                        }

                    }

                }

            }

            //#endregion

        }

        //#endregion

        //#region Handle the 'Full Screen'-button

        this.fullScreenButton.onclick = () => {
            if (document.fullscreenElement)
            {
                this.measurementsDetailsDiv.classList.remove("fullScreen");
                chargyLib.closeFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
            else
            {
                this.measurementsDetailsDiv.classList.add("fullScreen");
                chargyLib.openFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            }
        }

        //#endregion


        //#region Handle the 'back'-button

        this.backButton.onclick  = () => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.imprintScreenDiv.style.display          = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "none";
            this.exportButtonDiv.style.display           = "none";
            this.fileInput.value                         = "";
            this.detailedInfosDiv.innerHTML              = "";
            this.currentChargeTransparencyRecord         = null;
            this.currentChargeTransparencyLiveLink       = null;
            this.currentGlobalError                      = null;

            this.minlat =  1000;
            this.maxlat = -1000;
            this.minlng =  1000;
            this.maxlng = -1000;

        }

        //#endregion

        //#region Handle the 'export'-button

        this.exportButton.onclick  = async () => {

            try
            {

                const json      = JSON.stringify(this.chargy.currentCTR, null, 4);
                const fileName  = "chargy-export.json";

                const showSaveFilePicker = (window as WindowWithSaveFilePicker).showSaveFilePicker;

                if (typeof showSaveFilePicker === "function") {
                    const fileHandle = await showSaveFilePicker({
                        suggestedName: fileName,
                        types: [
                            {
                                description: "JSON file",
                                accept: {
                                    "application/json": [".json"]
                                }
                            }
                        ]
                    });

                    const writable = await fileHandle.createWritable();
                    await writable.write(json);
                    await writable.close();
                    return;
                }

                const blob = new Blob([ json ], { type: "application/json;charset=utf-8" });
                const url  = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.click();

                URL.revokeObjectURL(url);

            }
            catch (exception) {
                const message = exception instanceof Error
                    ? exception.message
                    : String(exception);

                alert(`${this.getLocalizedText("exportFailed")}${message}`);
            }

        }

        //#endregion


        //#region Modify external links to be opened in the external web browser

        const linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;

        for (let i = 0; i < linkButtons.length; i++) {

            const linkButton = linkButtons[i];

            if (linkButton)
            {
                linkButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {

                    ev.preventDefault();
                    const link = linkButton.getAttribute("href");

                    if (link && (link.startsWith("http://") || link.startsWith("https://")))
                        window.open(link, '_blank');

                }
            }

        }

        //#endregion


        //#region Handle the 'fileInput'-button

        this.fileInput  = document.getElementById('fileInput')  as HTMLInputElement;
        this.fileInputButton.onclick = () => {
            this.fileInput.value = '';
            this.fileInput.click();
        }

        this.fileInput.onchange = async (ev: Event) => {

            const input = ev.target;

            if (input instanceof HTMLInputElement &&
                input.files != null)
            {
                await this.readFilesFromDiskInBrowser(input.files);
            }

        }

        //#endregion

        //#region Handle Drag'n'Drop of charge transparency files

        this.inputDiv.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement).classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            if (event.dataTransfer != null)
                event.dataTransfer.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement).classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement).classList.remove('over');
        }, false);

        this.inputDiv.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement).classList.remove('over');
            if (event.dataTransfer?.files != null)
                void this.readFilesFromDiskInBrowser(event.dataTransfer.files);
        }, false);

        //#endregion

        //#region Handle the 'paste'-button

        this.pasteButton.onclick = async ()  => {
            await this.readClipboard();
        }

        //#endregion

        //#region Handle the 'qrScan'-button

        this.qrScanButton.onclick = async (ev: MouseEvent) => {
            ev.preventDefault();
            await this.openQRCodeScanner();
        }

        this.qrCodeScannerCancelButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.closeQRCodeScanner();
        }

        this.qrCodeScannerRescanButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.resumeQRCodeScanner();
        }

        this.qrCodeScannerOpenURLButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();

            if (this.qrCodeScannerLastURL != null)
            {
                window.open(this.qrCodeScannerLastURL.href, "_blank", "noopener");
                this.setQRCodeScannerStatus(this.getLocalizedText("urlWasOpened"));
            }
        }

        void this.updateQRCodeScannerAvailability();
        navigator.mediaDevices.addEventListener("devicechange", () => {
            void this.updateQRCodeScannerAvailability();
        });

        //#endregion


        this.leaflet = L;
        this.map   = L.map(document.getElementById('map') as HTMLElement);
        this.map.setView([50.9279287, 11.5731785], 12);

        const accessToken = 'pk.eyJ1IjoiYWh6ZiIsImEiOiJOdEQtTkcwIn0.Cn0iGqUYyA6KPS8iVjN68w';

        L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${accessToken}`, {
            attribution:  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
            tileSize:      512,
            maxZoom:        18,
            zoomOffset:     -1,
            id:           'mapbox/light-v10'
        }).addTo(this.map);


        //#region Calculate application hash

        void this.calcApplicationHash();

        //#endregion

    }

    //#endregion


    //#region UI language handling

    private getInitialUILanguage(): SupportedLanguage {

        const storedLanguage = localStorage.getItem("ChargyUILanguage");

        if (this.isSupportedLanguage(storedLanguage))
            return storedLanguage;

        const browserLanguages = [
            navigator.language,
            ...(navigator.languages)
        ].map(language => language.toLowerCase());

        for (const supportedLanguage of supportedLanguages)
            if (browserLanguages.includes(supportedLanguage))
                return supportedLanguage;

        for (const supportedLanguage of supportedLanguages)
            if (browserLanguages.some(language => language.startsWith(supportedLanguage + "-")))
                return supportedLanguage;

        return "en";

    }

    private isSupportedLanguage(language: string|null|undefined): language is SupportedLanguage {

        return supportedLanguages.includes(language as SupportedLanguage);

    }

    private getLocalizedText(key:        string,
                             fallback?:  string): string {

        const multiLanguage = this.i18n[key];

        if (multiLanguage != null)
        {
            const localized = multiLanguage[this.UILanguage];
            if (localized != null)
                return localized;

            const english = multiLanguage["en"];
            if (english != null)
                return english;
        }

        return fallback ?? key;

    }

    private getLocalizedDataText(data: chargyInterfaces.IMultilanguageText|undefined): string|undefined {

        if (data == null)
            return undefined;

        return data[this.UILanguage] ??
               data["en"];

    }

    private setupLanguageSelector(): void {

        this.languageButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            const isOpen = this.languageMenuDiv.classList.toggle("open");
            this.languageButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
        };

        for (const languageMenuButton of Array.from(this.languageMenuDiv.querySelectorAll<HTMLButtonElement>("button[data-language]")))
        {
            languageMenuButton.onclick = async (ev: MouseEvent) => {
                ev.preventDefault();
                ev.stopPropagation();

                const language = languageMenuButton.dataset["language"];
                if (this.isSupportedLanguage(language))
                    await this.setUILanguage(language);
            };
        }

        document.addEventListener("click", () => {
            this.languageMenuDiv.classList.remove("open");
            this.languageButton.setAttribute("aria-expanded", "false");
        });

    }

    private async setUILanguage(language: SupportedLanguage,
                                persist:  boolean = true): Promise<void> {

        this.UILanguage = language;
        this.chargy.SetUILanguage(language);
        this.moment.locale(language);
        chargyLib.setUILocale(language);

        if (persist)
            localStorage.setItem("ChargyUILanguage", language);

        this.applyTranslations();
        await this.rerenderCurrentView();

    }

    private applyTranslations(): void {

        document.documentElement.lang = this.UILanguage;

        for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n-key]")))
        {
            const key = element.dataset["i18nKey"];
            if (key != null)
                element.innerHTML = this.getLocalizedText(key, element.innerHTML);
        }

        for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n-title-key]")))
        {
            const key = element.dataset["i18nTitleKey"];
            if (key != null)
                element.title = this.getLocalizedText(key, element.title);
        }

        for (const element of Array.from(document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder-key]")))
        {
            const key = element.dataset["i18nPlaceholderKey"];
            if (key != null)
                element.placeholder = this.getLocalizedText(key, element.placeholder);
        }

        this.languageButton.title = this.getLocalizedText("languageButtonTitle", this.languageButton.title);
        this.languageButton.setAttribute("aria-label", this.languageButton.title);
        this.languageMenuDiv.classList.remove("open");
        this.languageButton.setAttribute("aria-expanded", "false");

        this.languageFlagImage.src = "images/flags/" + this.UILanguage + ".svg";

        for (const languageMenuButton of Array.from(this.languageMenuDiv.querySelectorAll<HTMLButtonElement>("button[data-language]")))
        {
            const isActive = languageMenuButton.dataset["language"] === this.UILanguage;
            languageMenuButton.classList.toggle("active", isActive);
            languageMenuButton.setAttribute("aria-pressed", isActive ? "true" : "false");
        }

    }

    private async rerenderCurrentView(): Promise<void> {

        if (this.currentChargeTransparencyRecord != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            await this.showChargeTransparencyRecord(this.currentChargeTransparencyRecord);
            return;
        }

        if (this.currentChargeTransparencyLiveLink != null &&
            this.chargingSessionScreenDiv.style.display !== "none")
        {
            await this.showChargeTransparencyLiveLink(this.currentChargeTransparencyLiveLink);
            return;
        }

        if (this.currentGlobalError != null &&
            this.errorTextDiv.style.display !== "none")
        {
            this.doGlobalError(this.currentGlobalError);
        }

    }

    //#endregion


    //#region (private) loadI18n()

    private async loadI18n() {
        Object.assign(this.i18n, coreI18n, webAppI18n);
    }

    //#endregion

    //#region (private) loadPackageJSON()

    private async loadPackageJSON() {
        try {

            const response = await fetch('package.json');

            if (!response.ok)
                throw new Error('Network response was not ok');

            const data = await response.json();
            Object.assign(this.packageJson, data);

            const coreDependencies = corePackageJson.dependencies as Record<string, string>;
            const packageVersion   = (packageName: string) =>
                (this.packageJson.dependencies?.[packageName] ?? coreDependencies[packageName])?.replace(/[^0-9\.]/g, "") ?? "";

            //#region Set infos of the about section

                (this.softwareInfosDiv. querySelector("#appEdition")             as HTMLSpanElement).innerHTML = this.appEdition;
                (this.softwareInfosDiv. querySelector("#appVersion")             as HTMLSpanElement).innerHTML = this.packageJson.version;
                (this.softwareInfosDiv. querySelector("#copyright")              as HTMLSpanElement).innerHTML = this.copyright;

                (this.openSourceLibsDiv.querySelector("#chargyVersion")          as HTMLSpanElement).innerHTML = this.packageJson.version;
                (this.openSourceLibsDiv.querySelector("#chargyCoreVersion")      as HTMLSpanElement).innerHTML = corePackageJson.version;

            if (this.packageJson.devDependencies)
            {
                (this.openSourceLibsDiv.querySelector("#SASS")                   as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["sass"]?.                   replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#typeScript")             as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["typescript"]?.             replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#webpack")                as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["webpack"]?.                replace(/[^0-9\.]/g, "");
            }

            if (this.packageJson.dependencies)
            {
                (this.openSourceLibsDiv.querySelector("#fontAwesome")            as HTMLSpanElement).innerHTML = packageVersion("@fortawesome/fontawesome-free");
                (this.openSourceLibsDiv.querySelector("#elliptic")               as HTMLSpanElement).innerHTML = packageVersion("elliptic");
                (this.openSourceLibsDiv.querySelector("#momentJS")               as HTMLSpanElement).innerHTML = packageVersion("moment");
                (this.openSourceLibsDiv.querySelector("#pdfjsdist")              as HTMLSpanElement).innerHTML = packageVersion("pdfjs-dist");
                (this.openSourceLibsDiv.querySelector("#seekBzip")               as HTMLSpanElement).innerHTML = packageVersion("seek-bzip");
                (this.openSourceLibsDiv.querySelector("#fileType")               as HTMLSpanElement).innerHTML = packageVersion("file-type");
                (this.openSourceLibsDiv.querySelector("#jsQR")                   as HTMLSpanElement).innerHTML = packageVersion("jsqr");
                (this.openSourceLibsDiv.querySelector("#asn1JS")                 as HTMLSpanElement).innerHTML = packageVersion("asn1.js");
                (this.openSourceLibsDiv.querySelector("#buffer")                 as HTMLSpanElement).innerHTML = packageVersion("buffer");
                (this.openSourceLibsDiv.querySelector("#base32Decode")           as HTMLSpanElement).innerHTML = packageVersion("base32-decode");
                (this.openSourceLibsDiv.querySelector("#leafletJS")              as HTMLSpanElement).innerHTML = packageVersion("leaflet");
                (this.openSourceLibsDiv.querySelector("#leafletAwesomeMarkers")  as HTMLSpanElement).innerHTML = packageVersion("leaflet.awesome-markers");
                (this.openSourceLibsDiv.querySelector("#chartJS")                as HTMLSpanElement).innerHTML = packageVersion("chart.js");
                (this.openSourceLibsDiv.querySelector("#decimalJS")              as HTMLSpanElement).innerHTML = packageVersion("decimal.js");
            }

            //#endregion



        } catch (error) {
            console.error('There has been a problem with fetching "package.json":', error);
        }
    }

    //#endregion


    //#region Deep-link verification data

    private getDeepLinkVerificationData(): string|null
    {

        const verifyParameter = new URLSearchParams(window.location.search).get("verify");

        if (verifyParameter == null ||
            verifyParameter.trim() === "")
        {
            return null;
        }

        return verifyParameter;

    }

    private getDeepLinkVerificationURL(): URL|null
    {

        const searchParameters  = new URLSearchParams(window.location.search);
        const verifyURLParameter = searchParameters.get("verifyURL") ?? searchParameters.get("verifyUrl");

        if (verifyURLParameter == null ||
            verifyURLParameter.trim() === "")
        {
            return null;
        }

        try
        {

            const verifyURL = new URL(verifyURLParameter);

            return verifyURL.protocol === "https:" ||
                   verifyURL.protocol === "http:"
                       ? verifyURL
                       : null;

        }
        catch
        {
            return null;
        }

    }

    private getDeepLinkVerificationToken(): string|null
    {

        const tokenParameter = new URLSearchParams(window.location.search).get("token");

        if (tokenParameter == null ||
            tokenParameter.trim() === "")
        {
            return null;
        }

        return tokenParameter;

    }

    private getDeepLinkVerificationBearerToken(): string|null
    {

        const bearerTokenParameter = new URLSearchParams(window.location.search).get("bearerToken");

        if (bearerTokenParameter == null ||
            bearerTokenParameter.trim() === "")
        {
            return null;
        }

        return bearerTokenParameter;

    }

    private withDeepLinkVerificationToken(verifyURL: URL,
                                          token:     string|null): URL
    {

        return withDeepLinkVerificationToken(verifyURL, token);

    }

    private decodeBase64Url(base64Value: string): Uint8Array
    {

        return decodeDeepLinkBase64Url(base64Value);

    }

    private decodeUtf8(bytes: Uint8Array): string|null
    {

        return decodeDeepLinkUtf8(bytes);

    }

    private parseExternalURLConfig(configText: string): ExternalURLRule[]
    {

        return parseExternalURLConfig(configText);

    }

    private async loadExternalURLRules(): Promise<ExternalURLRule[]>
    {

        const response = await fetch("externalURLs.conf", {
            cache:        "no-store",
            credentials:  "same-origin"
        });

        if (!response.ok)
            return [];

        return this.parseExternalURLConfig(await response.text());

    }

    private findExternalURLRule(verifyURL: URL,
                                rules:     ExternalURLRule[]): ExternalURLRule|null
    {

        return findExternalURLRule(verifyURL, rules);

    }

    private getDeepLinkFileName(verifyURL: URL,
                                contentType: string): string
    {

        return getDeepLinkFileName(verifyURL, contentType);

    }

    private async readResponseWithinLimit(response:        Response,
                                          maxPayloadBytes: number): Promise<Uint8Array>
    {

        return readResponseWithinLimit(response, maxPayloadBytes);

    }

    private async handleDeepLinkVerificationURL(verifyURL:    URL,
                                                token:        string|null,
                                                bearerToken:  string|null): Promise<void>
    {

        const rules = await this.loadExternalURLRules();
        const rule  = this.findExternalURLRule(verifyURL, rules);

        if (rule == null)
        {
            throw new Error("External verification URL is not allowed.");
        }

        const downloadURL = this.withDeepLinkVerificationToken(verifyURL, token);

        if (!downloadURL.href.startsWith(rule.prefix))
            throw new Error("External verification URL token merge moved URL outside the allowed prefix.");

        const headers = new Headers();

        if (bearerToken != null)
            headers.set("Authorization", "Bearer " + bearerToken);

        const response = await fetch(downloadURL.href, {
            cache:        "no-store",
            credentials:  "omit",
            headers:      headers,
            redirect:     "follow"
        });

        if (!response.ok)
            throw new Error("External verification URL could not be loaded.");

        if (!response.url.startsWith(rule.prefix))
            throw new Error("External verification URL redirected outside the allowed prefix.");

        const contentType = response.headers.get("content-type") ?? "application/octet-stream";
        const data        = await this.readResponseWithinLimit(response, rule.maxPayloadBytes);

        await this.detectAndConvertContentFormat({
            name:  this.getDeepLinkFileName(verifyURL, contentType),
            path:  downloadURL.href,
            type:  contentType,
            data:  data
        });

    }

    private async handleDeepLinkVerificationData(): Promise<void>
    {

        const encodedData = this.getDeepLinkVerificationData();
        const verifyURL   = this.getDeepLinkVerificationURL();
        const token       = this.getDeepLinkVerificationToken();
        const bearerToken = this.getDeepLinkVerificationBearerToken();

        if (encodedData == null &&
            verifyURL    == null)
        {
            return;
        }

        try
        {

            if (encodedData == null &&
                verifyURL    != null)
            {
                await this.handleDeepLinkVerificationURL(verifyURL, token, bearerToken);
                return;
            }

            if (encodedData == null)
                return;

            const decodedBytes = this.decodeBase64Url(encodedData);
            const decodedText  = this.decodeUtf8(decodedBytes);

            if (decodedText != null)
            {
                await this.detectAndConvertContentFormat(decodedText);
                return;
            }

            await this.detectAndConvertContentFormat({
                name: "deeplink.bin",
                type: "application/octet-stream",
                data: decodedBytes
            });

        }
        catch (exception)
        {
            this.doGlobalError({
                status:     chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                message:    this.getLocalizedText("UnknownOrInvalidChargeTransparencyRecord"),
                exception:  exception,
                certainty:  0
            });
        }

    }

    //#endregion


    //#region UpdateFeedbackSection()

    public UpdateFeedbackSection(FeedbackEMail?:   string[],
                                 FeedbackHotline?: string[]) {

        if (!this.showFeedbackSection)
        {
          //  this.feedbackDiv.style.display = "none";
            return;
        }

        this.feedbackDiv.style.display = "block";

        //#region Issue Tracker

        if (this.defaultIssueURL !== "")
        {

            this.showIssueTrackerButton.style.display = "block";

            this.showIssueTrackerButton.onclick = (ev: MouseEvent) => {
                this.issueTrackerDiv.style.display    = 'block';
                this.privacyStatement.style.display   = "none";
                this.issueTrackerText.scrollTop       = 0;
            }
        }
        else
            this.showIssueTrackerButton.style.display = "none";

        //#endregion

        //#region Imprint

        this.showImprintButton.style.display = "block";
        this.showImprintButton.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.imprintScreenDiv.style.display          = "block";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";
        }

        //#endregion

        //#region Feedback E-Mail

        const feedbackEMail   = FeedbackEMail   ?? this.defaultFeedbackEMail;

        if (feedbackEMail && feedbackEMail.length == 2)
        {
            this.feedbackEMailAnchor.style.display = "block";
            this.feedbackEMailAnchor.href          = "mailto:" + feedbackEMail[0] + feedbackEMail[1];
            this.feedbackEMailAnchor.innerHTML    += feedbackEMail[0];
        }
        else
            this.feedbackEMailAnchor.style.display = "none";

        //#endregion

        //#region Feedback Hotline

        const feedbackHotline = FeedbackHotline ?? this.defaultFeedbackHotline;

        if (feedbackHotline && feedbackHotline.length == 2)
        {
            this.feedbackHotlineAnchor.style.display = "block";
            this.feedbackHotlineAnchor.href          = "tel:" + feedbackHotline[0];
            this.feedbackHotlineAnchor.innerHTML    += feedbackHotline[1];
        }
        else
            this.feedbackHotlineAnchor.style.display = "none";

        //#endregion

    }

    //#endregion

    private getSessionCryptoResultText(result?: chargyInterfaces.ISessionCryptoResult|null): string
    {

        let text = this.getLocalizedText("UnknownOrInvalidChargeTransparencyRecord");

        if (result?.message !== undefined)
            text = result.message.trim();

        if (result !== null          &&
            result !== undefined     &&
            result.errors            &&
            result.errors.length > 0 &&
            result.errors[0] !== undefined)
        {
            text = result.errors[0].trim();
        }

        return text;

    }

    //#region doGlobalError(...)

    private doGlobalError(result:    chargyInterfaces.ISessionCryptoResult,
                          context?:  unknown)
    {

        this.currentGlobalError                = result;
        this.currentChargeTransparencyRecord   = null;
        this.currentChargeTransparencyLiveLink = null;

        const text = this.getSessionCryptoResultText(result);

        this.inputDiv.style.flexDirection            = "";
        this.inputInfosDiv.style.display             = 'flex';
        this.aboutScreenDiv.style.display            = "none";
        this.imprintScreenDiv.style.display          = "none";
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        console.log(text);
        console.log(context);

        // this.ipcRenderer.sendSync('setVerificationResult', result);

    }

    //#endregion

    //#region readClipboard()

    private getSupportedClipboardType(types: ReadonlyArray<string>): string | undefined
    {

        const exactTypePriority = [
            "application/chargy",
            "application/json",
            "application/ld+json",
            "application/xml",
            "text/xml",
            "text/plain",
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp",
            "image/bmp",
            "image/svg+xml"
        ];

        for (const preferredType of exactTypePriority)
        {

            const matchingType = types.find(type => type.toLowerCase() === preferredType);

            if (matchingType != null)
                return matchingType;

        }

        return types.find(type => {
            const normalizedType = type.toLowerCase();
            return normalizedType.endsWith("+json") ||
                   normalizedType.endsWith("+xml")  ||
                   normalizedType.startsWith("image/");
        });

    }

    private getClipboardFileName(mimeType: string): string
    {

        const normalizedType = mimeType.toLowerCase();

        if (normalizedType === "application/pdf")
            return "clipboard.pdf";

        if (normalizedType === "application/json" ||
            normalizedType === "application/ld+json" ||
            normalizedType.endsWith("+json"))
        {
            return "clipboard.json";
        }

        if (normalizedType === "application/xml" ||
            normalizedType === "text/xml"        ||
            normalizedType.endsWith("+xml"))
        {
            return "clipboard.xml";
        }

        if (normalizedType === "image/svg+xml")
            return "clipboard.svg";

        if (normalizedType === "image/jpeg" ||
            normalizedType === "image/jpg")
        {
            return "clipboard.jpg";
        }

        if (normalizedType.startsWith("image/"))
            return "clipboard." + normalizedType.substring("image/".length);

        return "clipboard.txt";

    }

    private isClipboardTextType(mimeType: string): boolean
    {

        const normalizedType = mimeType.toLowerCase();

        return normalizedType === "application/chargy"  ||
               normalizedType === "application/json"    ||
               normalizedType === "application/ld+json" ||
               normalizedType === "application/xml"     ||
               normalizedType === "text/xml"            ||
               normalizedType === "text/plain"          ||
               normalizedType.endsWith("+json")         ||
               normalizedType.endsWith("+xml");

    }

    private async readClipboard()
    {
        try
        {

            const text = await navigator.clipboard.readText();

            if (text.trim() !== "")
            {
                await this.detectAndConvertContentFormat(text);
                return;
            }

            if (typeof navigator.clipboard.read === "function")
            {

                const clipboardItems = await navigator.clipboard.read();

                for (const item of clipboardItems)
                {

                    const clipboardType = this.getSupportedClipboardType(item.types);

                    if (clipboardType != null)
                    {

                        const blob = await item.getType(clipboardType);

                        if (this.isClipboardTextType(clipboardType))
                        {
                            await this.detectAndConvertContentFormat(await blob.text());
                            return;
                        }

                        await this.detectAndConvertContentFormat({
                                  name:  this.getClipboardFileName(clipboardType),
                                  type:  clipboardType,
                                  data:  await blob.arrayBuffer()
                              });

                        return;

                    }

                }

            }

            await this.detectAndConvertContentFormat("");

        }
        catch (exception)
        {
            if (exception instanceof DOMException &&
                exception.message === "Document is not focused.")
            {
                return;
            }

            this.doGlobalError({
                status:    chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord"),
                certainty: 0
            });
        }
    }

    //#endregion

    //#region QR code scanner

    private async updateQRCodeScannerAvailability(): Promise<void>
    {

        const mediaDevices = navigator.mediaDevices;

        if (typeof mediaDevices.getUserMedia !== "function")
        {
            this.setQRCodeScannerButtonAvailability(false, this.getLocalizedText("cameraAccessUnsupported"));
            return;
        }

        if (typeof mediaDevices.enumerateDevices !== "function")
        {
            this.setQRCodeScannerButtonAvailability(true, this.getLocalizedText("scanQRCodeWithCamera"));
            return;
        }

        try
        {

            const devices   = await mediaDevices.enumerateDevices();
            const hasCamera = devices.some(device => device.kind === "videoinput");

            this.setQRCodeScannerButtonAvailability(
                hasCamera,
                hasCamera
                    ? this.getLocalizedText("scanQRCodeWithCamera")
                    : this.getLocalizedText("noCameraAvailable")
            );

        }
        catch
        {
            this.setQRCodeScannerButtonAvailability(true, this.getLocalizedText("scanQRCodeWithCamera"));
        }

    }

    private setQRCodeScannerButtonAvailability(isAvailable:  boolean,
                                               title:        string): void
    {

        this.qrScanButton.disabled = !isAvailable;
        this.qrScanButton.title    = title;

    }

    private async openQRCodeScanner(): Promise<void>
    {

        if (this.qrScanButton.disabled)
            return;

        this.resetQRCodeScannerDialog(this.getLocalizedText("cameraStarting"));

        try
        {

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" }
                }
            });

            this.qrCodeScannerStream             = stream;
            this.qrCodeScannerVideo.srcObject    = stream;
            this.qrCodeScannerDiv.style.display  = "block";

            await this.qrCodeScannerVideo.play();

            this.resumeQRCodeScanner();

        }
        catch (exception)
        {
            this.closeQRCodeScanner();
            this.doGlobalError({
                status:     chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                message:    this.getLocalizedText("cameraCouldNotStart"),
                exception:  exception,
                certainty:  0
            });
        }

    }

    private closeQRCodeScanner(): void
    {

        if (this.qrCodeScannerAnimationFrame != null)
        {
            cancelAnimationFrame(this.qrCodeScannerAnimationFrame);
            this.qrCodeScannerAnimationFrame = null;
        }

        this.qrCodeScannerVideo.pause();
        this.qrCodeScannerVideo.srcObject = null;

        if (this.qrCodeScannerStream != null)
        {
            for (const track of this.qrCodeScannerStream.getTracks())
                track.stop();

            this.qrCodeScannerStream = null;
        }

        this.qrCodeScannerDiv.style.display = "none";
        this.qrCodeScannerIsProcessing      = false;
        this.qrCodeScannerLastText          = null;
        this.qrCodeScannerLastURL           = null;

    }

    private resumeQRCodeScanner(): void
    {

        this.qrCodeScannerIsProcessing = false;
        this.qrCodeScannerLastText     = null;
        this.qrCodeScannerLastURL      = null;
        this.resetQRCodeScannerDialog(this.getLocalizedText("cameraReady"));

        if (this.qrCodeScannerAnimationFrame == null)
            this.scanQRCodeFrame();

    }

    private resetQRCodeScannerDialog(statusText: string): void
    {

        this.qrCodeScannerErrorDiv.textContent             = "";
        this.qrCodeScannerStatusDiv.textContent            = statusText;
        this.qrCodeScannerResultDiv.style.display          = "none";
        this.qrCodeScannerURLActionsDiv.style.display      = "none";
        this.qrCodeScannerResultText.textContent           = "";

    }

    private setQRCodeScannerStatus(statusText: string): void
    {
        this.qrCodeScannerStatusDiv.textContent = statusText;
    }

    private scanQRCodeFrame(): void
    {

        if (this.qrCodeScannerDiv.style.display !== "block")
        {
            this.qrCodeScannerAnimationFrame = null;
            return;
        }

        if (!this.qrCodeScannerIsProcessing &&
             this.qrCodeScannerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
             this.qrCodeScannerVideo.videoWidth  > 0 &&
             this.qrCodeScannerVideo.videoHeight > 0)
        {
            const canvas  = this.qrCodeScannerCanvas;
            const context = canvas.getContext("2d", { willReadFrequently: true });

            if (context != null)
            {
                canvas.width  = this.qrCodeScannerVideo.videoWidth;
                canvas.height = this.qrCodeScannerVideo.videoHeight;

                context.drawImage(this.qrCodeScannerVideo, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const qrText    = readQRCodeTextFromImageData({
                                      data:   imageData.data,
                                      width:  imageData.width,
                                      height: imageData.height
                                  });

                if (qrText != null &&
                    qrText !== this.qrCodeScannerLastText)
                {
                    this.qrCodeScannerLastText = qrText;
                    void this.handleScannedQRCodeText(qrText);
                }
            }
        }

        this.qrCodeScannerAnimationFrame = requestAnimationFrame(() => { this.scanQRCodeFrame(); });

    }

    private async handleScannedQRCodeText(qrText: string): Promise<void>
    {

        this.qrCodeScannerIsProcessing = true;
        this.setQRCodeScannerStatus(this.getLocalizedText("qrCodeDetected"));

        const detected = await this.detectAndConvertContentFormat(
            {
                name: "qr-code.txt",
                type: "text/plain",
                data: new TextEncoder().encode(qrText)
            },
            {
                prepareUI: false,
                onError:   result => { this.showQRCodeScannerRejectedText(qrText, result); }
            }
        );

        if (detected)
            this.closeQRCodeScanner();

    }

    private showQRCodeScannerRejectedText(qrText: string,
                                          result: chargyInterfaces.ISessionCryptoResult): void
    {

        const url = this.tryParseQRCodeURL(qrText);

        this.qrCodeScannerErrorDiv.textContent        = this.getSessionCryptoResultText(result);
        this.qrCodeScannerResultDiv.style.display     = "flex";
        this.qrCodeScannerResultText.textContent      = qrText;
        this.qrCodeScannerURLActionsDiv.style.display = url != null
                                                            ? "block"
                                                            : "none";
        this.qrCodeScannerLastURL                     = url;

        this.setQRCodeScannerStatus(
            url != null
                ? this.getLocalizedText("qrCodeContainsURL")
                : this.getLocalizedText("qrCodeContainsNoRecord")
        );

    }

    private tryParseQRCodeURL(qrText: string): URL|null
    {

        try
        {

            const url = new URL(qrText.trim());

            return url.protocol === "https:" || url.protocol === "http:"
                       ? url
                       : null;

        }
        catch
        {
            return null;
        }

    }

    //#endregion

    //#region readFile(s)FromDisk()

    private async readFilesFromDiskInBrowser(files: Blob|File|FileList)
    {

        const filesToLoad = files instanceof FileList
                                ? Array.from(files)
                                : [ files ];

        const loadedFiles = new Array<chargyInterfaces.IFileInfo>();

        for (const file of filesToLoad) {

            try {

                const data = await file.arrayBuffer();
                const name = file instanceof File && file.name.trim() !== ""
                                 ? file.name
                                 : "unknown";

                loadedFiles.push({
                    name: name,
                    path: "file://" + name,
                    type: file.type,
                    data: data
                });

            }
            catch (exception) {

                loadedFiles.push({
                    name:       file instanceof File ? file.name : "unknown",
                    type:       file.type,
                    error:      this.getLocalizedText("invalidChargeTransparencyRecord"),
                    exception:  exception
                });

            }

        }

        if (loadedFiles.length > 0)
            await this.detectAndConvertContentFormat(loadedFiles);

    }

    //#endregion


    //#region calcApplicationHash           (...)

    private async calcApplicationHash()
    {

        const files = [
            'index.html',
            'css/chargy.css',
            'chargyWebApp-bundle.js',
            'package.json'
        ];

        try
        {

            const hashes        = await Promise.all(files.map(url => chargyLib.hashFile(url)));
            const combinedHash  = await crypto.subtle.digest('SHA-512', chargyLib.ConcatenateBuffers(hashes));

            this.applicationHash                    = chargyLib.buf2hex(combinedHash);
            this.applicationHashValueDiv.innerHTML  = this.applicationHash.match(/.{1,8}/g)?.join(" ") ?? "";

        } catch (error) {
            console.error("An error occurred:", error);
            return "";
        }

    }

    //#endregion

    //#region checkApplicationHashSignature (...)

    private async checkApplicationHashSignature(app:        any,
                                                version:    any,
                                                _package:   any,
                                                signature:  any): Promise<string>
    {

        if (app == null || version == null || _package == null || signature == null)
            return "<i class=\"fas fa-times-circle\"></i>Ungültige Signatur!";

        try {

            const toCheck = {
                "name":                 app.name,
                "description":          app.description,

                "version": {
                    "version":              this.packageJson.version,
                    "releaseDate":          version.releaseDate,
                    "description":          version.description,
                    "tags":                 version.tags,

                    "package": {
                        "name":                 _package.name,
                        "description":          _package.description,
                        "additionalInfo":       _package.additonalInfo,
                        "platform":             _package.platform,
                        "isInstaller":          _package.isInstaller, // Note: Might be null! Keep null values!
                        "cryptoHashValue":      this.applicationHash,

                        "signature": {
                            "signer":               signature.signer,
                            "timestamp":            signature.timestamp,
                            "comment":              signature.comment,
                            "algorithm":            signature.algorithm,
                            "format":               signature.format
                        }

                    }

                }

            };

            //ToDo: Checking the timestamp might be usefull!

            const Input        = JSON.stringify(toCheck);
            const sha256value  = await chargyLib.sha256(Input);
            const result       = new this.elliptic.ec('secp256k1').
                                        keyFromPublic(signature.publicKey, 'hex').
                                        verify       (sha256value,
                                                      signature.signature);

            if (result)
                return "<i class=\"fas fa-check-circle\"></i>" + signature.signer;


        }
        catch (exception)
        { }

        return "<i class=\"fas fa-times-circle\"></i>" + signature.signer;

    }

    //#endregion


    //#region detectAndConvertContentFormat (FileInfos)

    private async detectAndConvertContentFormat(FileInfos:  Array<chargyInterfaces.IFileInfo>|chargyInterfaces.IFileInfo|string,
                                                options?:   DetectionOptions): Promise<boolean> {

        if (options?.prepareUI !== false)
        {
            this.inputInfosDiv.style.display = 'none';
            this.errorTextDiv.style.display  = 'none';
        }

        let result:DetectionResult;

        try
        {

            if (typeof FileInfos === 'string')
                result = await this.chargy.DetectAndConvertContentFormat(
                                   [{
                                       name:  "clipboard",
                                       data:  new TextEncoder().encode(FileInfos)
                                   }]
                               );

            else if (chargyInterfaces.isIFileInfo(FileInfos))
                result = await this.chargy.DetectAndConvertContentFormat([ FileInfos ]);

            else
                result = await this.chargy.DetectAndConvertContentFormat(FileInfos);

        }
        catch (exception)
        {
            result = {
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:    this.getLocalizedText("UnknownOrInvalidChargeTransparencyRecord"),
                exception:  exception,
                certainty:  0
            };
        }


        if (chargeTransparencyRecord.IsAChargeTransparencyRecord(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            await this.showChargeTransparencyRecord(result);

            return true;

        }

        if (chargeTransparencyLiveLink.IsAChargeTransparencyLiveLink(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            await this.showChargeTransparencyLiveLink(result);

            return true;

        }

        if (publicKeyInfo.IsAPublicKeyInfo(result))
        {

            if (options?.prepareUI === false)
            {
                this.inputInfosDiv.style.display = 'none';
                this.errorTextDiv.style.display  = 'none';
            }

            // await this.showPublicKeyInfo(result);

            return true;

        }

        if (options?.onError !== undefined)
            options.onError(result);
        else
            this.doGlobalError(result);

        return false;

    }

    //#endregion

    //#region showChargeTransparencyLiveLink(LiveLink)

    private showChargeTransparencyLiveLink(LiveLink: chargeTransparencyLiveLink.IChargeTransparencyLiveLink)
    {

        this.currentChargeTransparencyLiveLink       = LiveLink;
        this.currentChargeTransparencyRecord         = null;
        this.currentGlobalError                      = null;

        this.inputDiv.style.flexDirection            = "column";
        this.aboutScreenDiv.style.display            = "none";
        this.imprintScreenDiv.style.display          = "none";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
        this.exportButtonDiv.style.display           = "none";

        const descriptionDiv       = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id          = "description";
        descriptionDiv.innerText   = this.getLocalizedDataText(LiveLink.description) ?? "Charge Transparency Live-Link";

        if (LiveLink.timestamp)
        {
            const timestampDiv     = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            timestampDiv.id        = "begin";
            timestampDiv.className = "dates";
            timestampDiv.innerText = this.getLocalizedText("Timestamp") + " " + chargyLib.time2human(LiveLink.timestamp);
        }

        const liveLinksDiv         = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        liveLinksDiv.id            = "chargingSessions";

        const liveLinkDiv          = chargyLib.CreateDiv(liveLinksDiv, "chargingSession");
        liveLinkDiv.classList.add("chargeTransparencyLiveLink");

        const tableDiv             = liveLinkDiv.appendChild(document.createElement('div'));
        tableDiv.className         = "table";

        if (LiveLink.geoLocation)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "locationInfos",
                '<i class="fas fa-map-marker-alt"></i>',
                "Position " + [
                    LiveLink.geoLocation.lat,
                    LiveLink.geoLocation.lng
                ].join(", ")
            );

        if (LiveLink.connector)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "chargingStationInfos",
                '<i class="fas fa-plug"></i>',
                [
                    LiveLink.connector.standard,
                    LiveLink.connector.format,
                    LiveLink.connector.powerType,
                    LiveLink.connector.maxPower
                ].filter(value => value != null && value !== "").join(", ")
            );

        if (LiveLink.transports && LiveLink.transports.length > 0)
        {
            const transportsDiv = document.createElement('div');
            transportsDiv.className = "liveLinkTransports";

            for (const transport of LiveLink.transports)
                transportsDiv.appendChild(this.createLiveLinkTransportDiv(transport));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "productInfos",
                '<i class="fas fa-satellite-dish"></i>',
                transportsDiv
            );
        }

        if (LiveLink.imageURLs && LiveLink.imageURLs.length > 0)
        {
            const imagesDiv = document.createElement('div');

            for (const imageURL of LiveLink.imageURLs)
                imagesDiv.appendChild(this.createLiveLinkAnchor(imageURL, imageURL));

            this.appendLiveLinkInfoRow(
                tableDiv,
                "imageInfos",
                '<i class="fas fa-image"></i>',
                imagesDiv
            );
        }

        if (LiveLink.signatures)
            this.appendLiveLinkInfoRow(
                tableDiv,
                "signatureInfos",
                '<i class="fas fa-file-signature"></i>',
                LiveLink.signatures.length === 1
                    ? "1 Signatur"
                    : LiveLink.signatures.length.toString() + " Signaturen"
            );

    }

    private appendLiveLinkInfoRow(tableDiv:   HTMLDivElement,
                                  className:  string,
                                  iconHTML:   string,
                                  content:    string|HTMLElement): void
    {

        const rowDiv         = tableDiv.appendChild(document.createElement('div'));
        rowDiv.className     = className;

        const iconDiv        = rowDiv.appendChild(document.createElement('div'));
        iconDiv.className    = "icon";
        iconDiv.innerHTML    = iconHTML;

        const textDiv        = rowDiv.appendChild(document.createElement('div'));
        textDiv.className    = "text";

        if (typeof content === "string")
            textDiv.innerText = content;
        else
            textDiv.appendChild(content);

    }

    private createLiveLinkTransportDiv(transport: chargeTransparencyLiveLink.Transport): HTMLDivElement {

        const transportDiv = document.createElement('div');
        transportDiv.className = "liveLinkTransport";

        const transportTypeDiv = transportDiv.appendChild(document.createElement('div'));
        transportTypeDiv.className = "type";
        transportTypeDiv.innerText = transport.type;

        if (transport.url)
            transportDiv.appendChild(this.createLiveLinkAnchor(transport.url, transport.url));

        if (transport.urls)
        {
            for (const urlInfo of transport.urls)
            {
                const url       = typeof urlInfo === "string" ? urlInfo : urlInfo.url;
                const labelInfo = typeof urlInfo === "string"
                                      ? ""
                                      : [
                                            urlInfo.priority != null ? "Priorität " + urlInfo.priority.toString() : "",
                                            urlInfo.weight   != null ? "Gewicht "   + urlInfo.weight.  toString() : ""
                                        ].filter(value => value !== "").join(", ");

                transportDiv.appendChild(this.createLiveLinkAnchor(url, labelInfo !== "" ? url + " (" + labelInfo + ")" : url));
            }
        }

        if (transport.totp)
        {
            const totpDiv = transportDiv.appendChild(document.createElement('div'));
            totpDiv.className = "totp";
            totpDiv.innerText = "TOTP: " + transport.totp.timeStep.toString() + " s";
        }

        return transportDiv;

    }

    private createLiveLinkAnchor(url: string,
                                 text: string): HTMLAnchorElement {

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        anchor.innerText = text;

        return anchor;

    }

    //#endregion

    //#region showChargeTransparencyRecord  (CTR)

    private async showChargeTransparencyRecord(CTR: chargeTransparencyRecord.IChargeTransparencyRecord)
    {

        this.currentChargeTransparencyRecord         = CTR;
        this.currentChargeTransparencyLiveLink       = null;
        this.currentGlobalError                      = null;

        //#region Prepare View

        this.inputDiv.style.flexDirection            = "column";
        this.aboutScreenDiv.style.display            = "none";
        this.imprintScreenDiv.style.display          = "none";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
        this.exportButtonDiv.style.display           = "flex";

        //#endregion


        //#region Show CTR infos

        const descriptionDiv      = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id         = "description";
        descriptionDiv.innerText  = this.getLocalizedDataText(CTR.description) ?? this.chargy.GetLocalizedMessage("All charging sessions");

        const ctrBeginText        = CTR.begin ? chargyLib.parseUTC(CTR.begin).format('dddd, D. MMMM YYYY') : null;
        const ctrEndText          = CTR.end   ? chargyLib.parseUTC(CTR.end).  format('dddd, D. MMMM YYYY') : null;

        if (ctrBeginText) {
            const beginDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            beginDiv.id        = "begin";
            beginDiv.className = "dates";
            beginDiv.innerHTML = (ctrBeginText == ctrEndText ? this.chargy.GetLocalizedMessage("on") : this.chargy.GetLocalizedMessage("from")) + " " + ctrBeginText;
        }

        if (ctrEndText && ctrEndText != ctrBeginText) {
            const endDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            endDiv.id          = "end";
            endDiv.className   = "dates";
            endDiv.innerHTML   = this.chargy.GetLocalizedMessage("till") + " " + ctrEndText;
        }

        //#endregion

        //#region Show global contract infos

        // if (CTR.contract)
        // {
        // }

        //#endregion

        //#region Show all charging sessions...

        if (CTR.chargingSessions)
        {

            const chargingSessionsDiv  = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            chargingSessionsDiv.id   = "chargingSessions";

            for (const chargingSession of CTR.chargingSessions)
            {

                const chargingSessionDiv    = chargyLib.CreateDiv(chargingSessionsDiv, "chargingSession");
                chargingSession.GUI         = chargingSessionDiv;
                chargingSessionDiv.onclick  = async (ev: MouseEvent) => {

                    //#region Highlight the selected charging session...

                    const AllChargingSessionsDivs = document.getElementsByClassName("chargingSession");

                    for(let i=0; i<AllChargingSessionsDivs.length; i++)
                        AllChargingSessionsDivs[i]?.classList.remove("activated");

                    //(this as HTMLDivElement)?.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement).classList.add("activated");

                    //#endregion

                    await this.showChargingSessionDetails(chargingSession);

                };

                //#region Show session time infos

                try
                {

                    if (chargingSession.begin)
                    {

                        const dateDiv  = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        //dateDiv.innerHTML = UTC2human(chargingSession.begin);
                        dateDiv.innerHTML = chargyLib.time2human(chargingSession.begin);

                        if (chargingSession.end)
                        {

                            const endUTC   = chargyLib.parseUTC(chargingSession.end);
                            const duration = this.moment.duration(endUTC.valueOf() - chargyLib.parseUTC(chargingSession.begin).valueOf());

                            dateDiv.innerHTML += " - " +
                                                (Math.floor(duration.asDays()) > 0 ? endUTC.format("dddd") + " " : "") +
                                                endUTC.format('HH:mm:ss') +
                                                " Uhr";

                        }

                    }

                }
                catch (exception)
                { 
                    console.log("Could not show session time infos of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion

                const tableDiv              = chargingSessionDiv.appendChild(document.createElement('div'));
                      tableDiv.className    = "table";

                //#region Show energy infos

                try
                {

                    const productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className             = "productInfos";

                    const productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className             = "icon";
                    productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                    const productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.className                 = "text";
                    productDiv.innerHTML = chargingSession.product != null ? chargingSession.product["@id"] + "<br />" : "";

                    if (chargingSession.begin && chargingSession.end)
                    {

                        const duration = this.moment.duration(chargyLib.parseUTC(chargingSession.end).valueOf() - chargyLib.parseUTC(chargingSession.begin).valueOf());

                        productDiv.innerHTML += "Ladedauer ";
                        if      (Math.floor(duration.asDays())    > 1) productDiv.innerHTML += duration.days()    + " Tage "    + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asDays())    > 0) productDiv.innerHTML += duration.days()    + " Tag "     + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asHours())   > 0) productDiv.innerHTML += duration.hours()   + " Std. "    + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                        else if (Math.floor(duration.asMinutes()) > 0) productDiv.innerHTML += duration.minutes() + " Minuten " + duration.seconds() + " Sekunden";
                        else if (Math.floor(duration.asSeconds()) > 0) productDiv.innerHTML += duration.seconds() + " Sekunden";


                        if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.time != undefined)
                        {
                            switch (chargingSession.chargingProductRelevance.time)
                            {

                                case chargyInterfaces.InformationRelevance.Unknown:
                                case chargyInterfaces.InformationRelevance.Ignored:
                                case chargyInterfaces.InformationRelevance.Important:
                                    break;

                                case chargyInterfaces.InformationRelevance.Informative:
                                    productDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                    break;

                                default:
                                    productDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.time + ")</span>";
                                    break;

                            }
                        }

                    }

                    if (chargingSession.measurements)
                    {
                        for (const measurement of chargingSession.measurements)
                        {
                            //<i class="far fa-chart-bar"></i>
                            if (measurement.values && measurement.values.length > 0)
                            {

                                if (measurement.phenomena && measurement.phenomena.length > 0)
                                {

                                    measurement.name         = measurement.phenomena[0].name;
                                    measurement.obis         = measurement.phenomena[0].obis;
                                    measurement.unit         = measurement.phenomena[0].unit;
                                    measurement.unitEncoded  = measurement.phenomena[0].unitEncoded;
                                    measurement.valueType    = measurement.phenomena[0].valueType;
                                    measurement.scale        = measurement.phenomena[0].scale;

                                    if (measurement.scale == undefined || measurement.scale == null)
                                        measurement.scale = 0;

                                }

                                const first  = measurement?.values[0]?.value                           ?? new Decimal(0);
                                const last   = measurement?.values[measurement.values.length-1]?.value ?? first;
                                let   amount = parseFloat(((last.minus(first)).times(Math.pow(10, measurement.scale))).toFixed(10));

                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        break;

                                    // "WATT_HOURS" or "Wh"
                                    default:
                                        amount = parseFloat((amount / 1000).toFixed(10));
                                        break;

                                }

                                productDiv.innerHTML += "<br />" + chargyLib.measurementName2human(measurement.name) + " " + amount.toString() + " kWh";// (" + measurement.values.length + " Messwerte)";


                                if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.energy != undefined)
                                {
                                    switch (chargingSession.chargingProductRelevance.energy)
                                    {

                                        case chargyInterfaces.InformationRelevance.Unknown:
                                        case chargyInterfaces.InformationRelevance.Ignored:
                                        case chargyInterfaces.InformationRelevance.Important:
                                            break;

                                        case chargyInterfaces.InformationRelevance.Informative:
                                            productDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                            break;

                                        default:
                                            productDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.energy + ")</span>";
                                            break;

                                    }
                                }

                            }

                        }
                    }

                }
                catch (exception)
                { 
                    console.log("Could not show energy infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show parking infos

                try
                {

                    if (chargingSession.parking && chargingSession.parking.length > 0)
                    {

                        const parkingInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        parkingInfoDiv.className             = "parkingInfos";

                        const parkingIconDiv                   = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingIconDiv.className             = "icon";
                        parkingIconDiv.innerHTML             = '<i class="fas fa-parking"></i>';

                        const parkingDiv                       = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingDiv.className                 = "text";
                       // parkingDiv.innerHTML = chargingSession.parking != null ? chargingSession.product["@id"] + "<br />" : "";

                        const lastParking = chargingSession.parking[chargingSession.parking.length-1];

                        if (lastParking?.end != null)
                        {

                            const parkingBegin = chargyLib.parseUTC(chargingSession.parking[0]?.begin ?? "-");
                            const parkingEnd   = chargyLib.parseUTC(lastParking.end);
                            const duration     = this.moment.duration(parkingEnd.valueOf() - parkingBegin.valueOf());

                            parkingDiv.innerHTML += "Parkdauer ";
                            if      (Math.floor(duration.asDays())    > 1) parkingDiv.innerHTML += duration.days()    + " Tage " + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asDays())    > 0) parkingDiv.innerHTML += duration.days()    + " Tag "  + duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asHours())   > 0) parkingDiv.innerHTML += duration.hours()   + " Std. " + duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asMinutes()) > 0) parkingDiv.innerHTML += duration.minutes() + " Min. " + duration.seconds() + " Sek.";
                            else if (Math.floor(duration.asSeconds()) > 0) parkingDiv.innerHTML += duration.seconds();


                            if (chargingSession.chargingProductRelevance != undefined && chargingSession.chargingProductRelevance.parking != undefined)
                            {
                                switch (chargingSession.chargingProductRelevance.parking)
                                {

                                    case chargyInterfaces.InformationRelevance.Unknown:
                                    case chargyInterfaces.InformationRelevance.Ignored:
                                    case chargyInterfaces.InformationRelevance.Important:
                                        break;

                                    case chargyInterfaces.InformationRelevance.Informative:
                                        parkingDiv.innerHTML += " <span class=\"relevance\">(informativ)</span>";
                                        break;

                                    default:
                                        parkingDiv.innerHTML += " <span class=\"relevance\">(" + chargingSession.chargingProductRelevance.parking + ")</span>";
                                        break;

                                }
                            }

                        }

                    }

                }
                catch (exception)
                { 
                    console.log("Could not show parking infos of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion

                //#region Show authorization start/stop information

                try
                {

                    const authorizationStartDiv            = tableDiv.appendChild(document.createElement('div'));
                        authorizationStartDiv.className  = "authorizationStart";

                    const authorizationStartIconDiv                   = authorizationStartDiv.appendChild(document.createElement('div'));
                    authorizationStartIconDiv.className             = "icon";
                    switch (chargingSession.authorizationStart.type)
                    {

                        case "cryptoKey":
                            authorizationStartIconDiv.innerHTML     = '<i class="fas fa-key"></i>';
                            break;

                        case "eMAId":
                        case "EVCOId":
                            authorizationStartIconDiv.innerHTML     = '<i class="fas fa-mobile-alt"></i>';
                            break;

                        default:
                            authorizationStartIconDiv.innerHTML     = '<i class="fas fa-id-card"></i>';
                            break;

                    }

                    const authorizationStartIdDiv                     = authorizationStartDiv.appendChild(document.createElement('div'));
                    authorizationStartIdDiv.className                 = "id";
                    authorizationStartIdDiv.innerHTML = chargingSession.authorizationStart["@id"];


                    if (chargingSession.authorizationStop != null)
                    {

                        const authorizationStopDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStopDiv.className  = "authorizationStop";

                        const authorizationStopIconDiv                   = authorizationStopDiv.appendChild(document.createElement('div'));
                        authorizationStopIconDiv.className             = "icon";
                        switch (chargingSession.authorizationStop.type)
                        {

                            case "cryptoKey":
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-key"></i>';
                                break;

                            case "eMAId":
                            case "EVCOId":
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-mobile-alt"></i>';
                                break;

                            default:
                                authorizationStopIconDiv.innerHTML     = '<i class="fas fa-id-card"></i>';
                                break;

                        }

                        const authorizationStopIdDiv                     = authorizationStopDiv.appendChild(document.createElement('div'));
                        authorizationStopIdDiv.className               = "id";
                        authorizationStopIdDiv.innerHTML = chargingSession.authorizationStop["@id"];

                    }                        

                } catch (exception)
                {
                    console.log("Could not show authorization start/stop infos of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion

                //#region Show charging station infos...

                try
                {

                    if ((chargingSession.EVSEId            || chargingSession.EVSE            ||
                         chargingSession.chargingStationId || chargingSession.chargingStation ||
                         chargingSession.chargingPoolId    || chargingSession.chargingPool) &&

                         chargingSession.EVSEId            != "DE*GEF*EVSE*CHARGY*1" &&
                         chargingSession.chargingStationId != "DE*GEF*STATION*CHARGY*1")

                    {

                        const chargingStationInfoDiv            = tableDiv.appendChild(document.createElement('div'));
                        chargingStationInfoDiv.className      = "chargingStationInfos";

                        const chargingStationIconDiv            = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationIconDiv.className      = "icon";
                        chargingStationIconDiv.innerHTML      = '<i class="fas fa-charging-station"></i>';

                        const chargingStationDiv                = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationDiv.classList.add("text");

                        if (chargingSession.EVSEId || chargingSession.EVSE) {

                            // if (chargingSession.EVSE == null || typeof chargingSession.EVSE !== 'object')
                            //     chargingSession.EVSE = this.chargy.GetEVSE(chargingSession.EVSEId);
                            if (!chargingSession.EVSE)
                            {
                                const evse = this.chargy.GetEVSE(chargingSession.EVSEId);
                                if (evse)
                                    chargingSession.EVSE = evse;
                            }

                            chargingStationDiv.classList.add("EVSE");
                            chargingStationDiv.innerHTML      = (chargingSession.EVSE?.description != null
                                                                    ? (this.getLocalizedDataText(chargingSession.EVSE.description) ?? "-") + "<br />"
                                                                    : "") +
                                                                (chargingSession.EVSEId != null
                                                                    ? chargingSession.EVSEId
                                                                    : chargingSession.EVSE!["@id"]);

                            if (chargingSession.EVSE)
                            {

                                chargingSession.chargingStation   = chargingSession.EVSE.chargingStation;
                                chargingSession.chargingStationId = chargingSession.EVSE.chargingStationId;

                                if (chargingSession.EVSE.chargingStation)
                                {
                                    chargingSession.chargingPool      = chargingSession.EVSE.chargingStation.chargingPool;
                                    chargingSession.chargingPoolId    = chargingSession.EVSE.chargingStation.chargingPoolId;
                                    address                           = chargingSession.EVSE.chargingStation.address;
                                }

                            }

                        }

                        else if (chargingSession.chargingStationId || chargingSession.chargingStation) {

                            // if (chargingSession.chargingStation == null || chargingSession.chargingStation == undefined || typeof chargingSession.chargingStation !== 'object')
                            //     chargingSession.chargingStation = this.chargy.GetChargingStation(chargingSession.chargingStationId ?? "");
                            if (!chargingSession.chargingStation)
                            {
                                const station = this.chargy.GetChargingStation(chargingSession.chargingStationId ?? "");
                                if (station)
                                    chargingSession.chargingStation = station;
                            }

                            if (chargingSession.chargingStation)
                            {

                                chargingStationDiv.classList.add("chargingStation");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingStation.description != null
                                                                        ? (this.getLocalizedDataText(chargingSession.chargingStation.description) ?? "-") + "<br />"
                                                                        : "") +
                                                                    (chargingSession.chargingStationId != null
                                                                        ? chargingSession.chargingStationId
                                                                        : chargingSession.chargingStation["@id"]);

                                chargingSession.chargingPool      = chargingSession.chargingStation.chargingPool;
                                chargingSession.chargingPoolId    = chargingSession.chargingStation.chargingPoolId;

                            }
                            else
                                chargingStationDiv.remove();

                        }

                        else if (chargingSession.chargingPoolId || chargingSession.chargingPool) {

                            // if (chargingSession.chargingPool == null || chargingSession.chargingPool == undefined || typeof chargingSession.chargingPool !== 'object')
                            //     chargingSession.chargingPool = this.chargy.GetChargingPool(chargingSession.chargingPoolId ?? "");
                            if (!chargingSession.chargingPool)
                            {
                                const pool = this.chargy.GetChargingPool(chargingSession.chargingPoolId ?? "");
                                if (pool)
                                    chargingSession.chargingPool = pool;
                            }

                            if (chargingSession.chargingPool)
                            {

                                chargingStationDiv.classList.add("chargingPool");
                                chargingStationDiv.innerHTML      = (chargingSession.chargingPool.description != null
                                                                        ? (this.getLocalizedDataText(chargingSession.chargingPool.description) ?? "-") + "<br />"
                                                                        : "") +
                                                                    (chargingSession.chargingPoolId != null
                                                                        ? chargingSession.chargingPoolId
                                                                        : chargingSession.chargingPool["@id"]);

                            }
                            else
                                chargingStationDiv.remove();

                        }

                    }

                } catch (exception)
                {
                    console.log("Could not show charging station infos of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion

                //#region Show location infos...

                try
                {

                    var address:chargyInterfaces.IAddress|undefined = undefined;

                    if (chargingSession.chargingStation != null && chargingSession.chargingStation.address != null)
                        address = chargingSession.chargingStation.address;

                    else if (chargingSession.chargingPool != null && chargingSession.chargingPool.address != null)
                        address = chargingSession.chargingPool.address;

                    if (address != null)
                    {

                        const locationInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className  = "locationInfos";

                        const locationIconDiv        = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className  = "icon";
                        locationIconDiv.innerHTML  = '<i class="fas fa-map-marker-alt"></i>';

                        const locationDiv            = locationInfoDiv.appendChild(document.createElement('div'));
                        locationDiv.classList.add("text");
                        locationDiv.innerHTML      =   (address.street      != null ? " " + address.street        : "") +
                                                       (address.houseNumber != null ? " " + address.houseNumber   : "") +

                                                       (address.postalCode  != null || address.city != null ? "," : "") +
                                                       (address.postalCode  != null ? " " + address.postalCode    : "") +
                                                       (address.city        != null ? " " + address.city : "");

                    }

                } catch (exception)
                {
                    console.log("Could not show location infos of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion

                //#region Show total costs...

                try
                {

                    if (chargingSession.totalCosts != null)
                    {

                        const costsInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        costsInfoDiv.className  = "costsInfos";

                        const costsIconDiv        = costsInfoDiv.appendChild(document.createElement('div'));
                        costsIconDiv.className  = "icon";
                        costsIconDiv.innerHTML  = '<i class="fa-solid fa-euro-sign"></i>';

                        const textDiv             = costsInfoDiv.appendChild(document.createElement('div'));
                        textDiv.classList.add("text");

                        const costsDiv            = textDiv.appendChild(document.createElement('div'));
                        costsDiv.classList.add("costs");

                        if (chargingSession.totalCosts.total != 0)
                        {

                            const totalCostsDiv      = costsDiv.appendChild(document.createElement('div'));
                            totalCostsDiv.classList.add("totalCosts");

                            const totalCostsCost     = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCost.classList.add("totalCost");
                            totalCostsCost.innerHTML     = chargingSession.totalCosts.total.toString();

                            const totalCostsCurrency = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCurrency.classList.add("totalCostCurrency");
                            totalCostsCurrency.innerHTML = chargingSession.totalCosts.currency;

                        }

                    }

                } catch (exception)
                {
                    console.log("Could not show costs of charging session '" + chargingSession["@id"] + "':" + String(exception));
                }

                //#endregion


                //#region Add marker to map

                // First clear the map...
                while(this.markers.length > 0)
                    this.map.removeLayer(this.markers.pop());

                const leaflet       = require('leaflet');
                const markers       = require('leaflet.awesome-markers');

                const redMarker     = leaflet.AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'exclamation',
                    markerColor:          'red',
                    iconColor:            '#ecc8c3'
                });

                const orangeMarker  = leaflet.AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'question',
                    markerColor:          'orange',
                    iconColor:            '#ae6a0a'
                });

                const greenMarker   = leaflet.AwesomeMarkers?.icon({
                    prefix:               'fa',
                    icon:                 'charging-station',
                    //markerColor:          'green',
                    //iconColor:            '#c2ec8e'
                    markerColor:          'cadetblue',
                    iconColor:            '#c1e9e0'
                });

                let markerIcon      = redMarker;

                if (chargingSession.verificationResult)
                {
                    switch (chargingSession.verificationResult.status) {

                        case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                            markerIcon = orangeMarker;
                            break;

                        case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                        case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                        case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                            markerIcon = redMarker;
                            break;

                        case chargyInterfaces.SessionVerificationResult.ValidSignature:
                            markerIcon = greenMarker;
                            break;

                    }
                }

             //   if (markerIcon == null)
             //       markerIcon = L.divIcon({className: 'my-div-icon', html: "here"});

                let geoLocation = null;

                if (chargingSession.chargingPool                != null &&
                    chargingSession.chargingPool.geoLocation    != null)
                {
                    geoLocation = chargingSession.chargingPool.geoLocation;
                }

                if (chargingSession.chargingStation             != null &&
                    chargingSession.chargingStation.geoLocation != null)
                {
                    geoLocation = chargingSession.chargingStation.geoLocation;
                }

                if (geoLocation     != null &&
                    geoLocation.lat != 0    &&
                    geoLocation.lng != 0 )
                {

                    const marker = markerIcon == null
                                       ? leaflet.marker([geoLocation.lat, geoLocation.lng]).addTo(this.map)
                                       : leaflet.marker([geoLocation.lat, geoLocation.lng], { icon: markerIcon }).addTo(this.map);

                    if (markerIcon != null)
                        this.markers.push(marker);

                    if (this.minlat > geoLocation.lat)
                        this.minlat = geoLocation.lat;

                    if (this.maxlat < geoLocation.lat)
                        this.maxlat = geoLocation.lat;

                    if (this.minlng > geoLocation.lng)
                        this.minlng = geoLocation.lng;

                    if (this.maxlng < geoLocation.lng)
                        this.maxlng = geoLocation.lng;

                    if (chargingSession.verificationResult)
                    {
                        switch (chargingSession.verificationResult.status)
                        {

                            case chargyInterfaces.SessionVerificationResult.Unvalidated:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Unvalidated"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("UnknownOrInvalidChargingSessionFormat"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Public key not found"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Invalid public key"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("Invalid signature"));
                                break;

                            case chargyInterfaces.SessionVerificationResult.ValidSignature:
                                marker.bindPopup(this.chargy.GetLocalizedMessage("ValidChargingSession"));
                                break;

                        }
                    }

                }

                //#endregion

                //#region Show verification status

                const verificationStatusDiv = chargingSessionDiv.appendChild(document.createElement('div'));
                verificationStatusDiv.className = "verificationStatus";

                if (chargingSession.verificationResult)
                {
                    switch (chargingSession.verificationResult.status)
                    {

                        case chargyInterfaces.SessionVerificationResult.Unvalidated:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-question-circle"></i> ' + this.chargy.GetLocalizedMessage("Unvalidated");
                            break;

                        case chargyInterfaces.SessionVerificationResult.UnknownCTRFormat:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("Unknown charge transparency data format!");
                            break;

                        case chargyInterfaces.SessionVerificationResult.NoChargeTransparencyRecordsFound:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("No charge transparency records found!");
                            break;


                        case chargyInterfaces.SessionVerificationResult.UnknownSessionFormat:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                        case chargyInterfaces.SessionVerificationResult.PublicKeyNotFound:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("Public key not found");
                            break;

                        case chargyInterfaces.SessionVerificationResult.InvalidPublicKey:
                        case chargyInterfaces.SessionVerificationResult.InvalidSignature:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                        case chargyInterfaces.SessionVerificationResult.ValidSignature:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-check-circle"></i> '    + this.chargy.GetLocalizedMessage("ValidChargingSession");
                            break;

                        default:
                            verificationStatusDiv.innerHTML = '<i class="fas fa-times-circle"></i> '    + this.chargy.GetLocalizedMessage("InvalidChargingSession");
                            break;

                    }
                }

                //#endregion

            }

            // If there is at least one charging session show its details at once...
            if (CTR.chargingSessions.length >= 1)
                CTR.chargingSessions[0]?.GUI?.click();

            if (this.minlat ==  1000 &&
                this.maxlat == -1000 &&
                this.minlng ==  1000 &&
                this.maxlng == -1000)
            {
                this.map.setView([0, 0], 1);
            }
            else
                this.map.fitBounds([[this.minlat, this.minlng], [this.maxlat, this.maxlng]],
                                   { padding: [40, 40] });

        }

        //#endregion


        //#region Show invalid data sets

        if (CTR.invalidDataSets && CTR.invalidDataSets.length > 0)
        {

            this.invalidDataSetsScreenDiv.style.display  = "flex";

            const headlineDiv       = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            headlineDiv.id          = "description";
            headlineDiv.innerHTML   = this.getLocalizedText("invalidDataSets");

            const invalidDataSetsDiv  = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            invalidDataSetsDiv.id   = "invalidDataSets";

            for (const invalidDataSet of CTR.invalidDataSets)
            {

                const result = invalidDataSet.result;

                if (chargeTransparencyRecord.IsASessionCryptoResult(result))
                {

                    const invalidDataSetDiv = chargyLib.CreateDiv(invalidDataSetsDiv, "invalidDataSet");

                    const filenameDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(filenameDiv, "key",   this.getLocalizedText("fileNameLabel"));
                    chargyLib.CreateDiv(filenameDiv, "value", invalidDataSet.name);

                    const resultDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(resultDiv,   "key",   this.getLocalizedText("errorLabel"));
                    const valueDiv  = chargyLib.CreateDiv(resultDiv, "value");

                    if (result.message)
                        valueDiv.innerHTML  = result.message;

                    else
                        switch (result.status)
                        {

                            case chargyInterfaces.SessionVerificationResult.InvalidSessionFormat:
                                valueDiv.innerHTML  = this.getLocalizedText("invalidTransparencyFormat");
                                break;

                            default:
                                valueDiv.innerHTML  = result.status;

                        }

                }

            }

        }

        //#endregion

    }

    //#endregion

    //#region showChargingSessionDetails    (chargingSession)

    private showChargingSessionDetails(chargingSession: chargeTransparencyRecord.IChargingSession)
    {

        try
        {

            this.detailedInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (const measurement of chargingSession.measurements)
                {

                    measurement.chargingSession         = chargingSession;

                    const detailedInfosHeadlineDiv      = this.detailedInfosDiv.appendChild(document.createElement('div'));
                    detailedInfosHeadlineDiv.className  = "headline";
                    detailedInfosHeadlineDiv.innerHTML  = this.chargy.GetLocalizedMessage("Charging Session Information");

                    //#region Show Charging Station Infos

                    if (measurement.chargingSession.chargingStation != null &&
                       (measurement.chargingSession.chargingStation["@id"] !== "DE*GEF*STATION*CHARGY*1" ||
                        measurement.chargingSession.chargingStation.manufacturer                         ||
                        measurement.chargingSession.chargingStation.model                                ||
                        measurement.chargingSession.chargingStation.serialNumber                         ||
                        measurement.chargingSession.chargingStation.firmwareVersion                      ||
                        measurement.chargingSession.chargingStation.legalCompliance))
                    {

                        const chargingStationInfosDiv  = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingStationInfos");
                                                         chargyLib.CreateDiv(chargingStationInfosDiv,  "headline2",
                                                                             this.chargy.GetLocalizedMessage("Charging Station"));

                        if (measurement.chargingSession.chargingStation["@id"] &&
                            measurement.chargingSession.chargingStation["@id"].length > 0 &&
                            measurement.chargingSession.chargingStation["@id"] !== "DE*GEF*STATION*CHARGY*1")
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "chargingStationId",
                                                 this.chargy.GetLocalizedMessage("Identification"),
                                                 measurement.chargingSession.chargingStation["@id"]);
                        }

                        if (measurement.chargingSession.chargingStation.manufacturer &&
                            measurement.chargingSession.chargingStation.manufacturer.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "manufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 measurement.chargingSession.chargingStation.manufacturer);
                        }

                        if (measurement.chargingSession.chargingStation.model &&
                            measurement.chargingSession.chargingStation.model.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "model",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 measurement.chargingSession.chargingStation.model);
                        }

                        if (measurement.chargingSession.chargingStation.serialNumber &&
                            measurement.chargingSession.chargingStation.serialNumber.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "serialNumber",
                                                 this.chargy.GetLocalizedMessage("Serial Number"),
                                                 measurement.chargingSession.chargingStation.serialNumber);
                        }

                        if (measurement.chargingSession.chargingStation.firmwareVersion &&
                            measurement.chargingSession.chargingStation.firmwareVersion.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "firmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 measurement.chargingSession.chargingStation.firmwareVersion);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance &&
                            measurement.chargingSession.chargingStation.legalCompliance.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "legalCompliance",
                                                 this.chargy.GetLocalizedMessage("Legal Compliance"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.freeText);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity.length > 0 &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity[0]?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.conformity[0]. freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "conformity",
                                                 this.chargy.GetLocalizedMessage("Conformity"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.conformity[0].freeText);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration.length > 0 &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]. freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "calibration",
                                                 this.chargy.GetLocalizedMessage("Calibration"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.calibration[0].freeText);
                        }

                    }

                    //#endregion

                    //#region Show Energy Meter Infos...

                    //#region Show Energy Meter details...

                    const energyMeterInfosDiv = chargyLib.CreateDiv(this.detailedInfosDiv, "energyMeterInfos");
                                                chargyLib.CreateDiv(energyMeterInfosDiv, "headline2",
                                                                    this.chargy.GetLocalizedMessage("Energy Meter"));

                    const meter = this.chargy.GetMeter(measurement.energyMeterId);
                    if (meter != null)
                    {

                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterId",
                                                 this.chargy.GetLocalizedMessage("Serial Number"),
                                                 measurement.energyMeterId);

                        if (meter.manufacturer && meter.manufacturer.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterManufacturer",
                                                 this.chargy.GetLocalizedMessage("Manufacturer"),
                                                 meter.manufacturerURL && meter.manufacturerURL.length > 0
                                                     ? "<a href=\"javascript:OpenLink('" + meter.manufacturerURL + "')\">" + meter.manufacturer + "</a>"
                                                     : meter.manufacturer);

                        if (meter.model && meter.model.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterModel",
                                                 this.chargy.GetLocalizedMessage("Model"),
                                                 meter.modelURL && meter.modelURL.length > 0
                                                     ? "<a href=\"javascript:OpenLink('" + meter.modelURL + "')\">" + meter.model + "</a>"
                                                     : meter.model);

                        if (meter.hardwareVersion && meter.hardwareVersion.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterHardwareVersion",
                                                 this.chargy.GetLocalizedMessage("Hardware Version"),
                                                 meter.hardwareVersion);

                        if (meter.firmwareVersion && meter.firmwareVersion.length > 0)
                            chargyLib.CreateDiv2(energyMeterInfosDiv, "meterFirmwareVersion",
                                                 this.chargy.GetLocalizedMessage("Firmware Version"),
                                                 meter.firmwareVersion);

                    }

                    //#endregion

                    //#region ...or just show the Energy Meter Identification

                    else
                        chargyLib.CreateDiv2(energyMeterInfosDiv, "meterId",
                                             this.chargy.GetLocalizedMessage("Meter serial number"),
                                             measurement.energyMeterId);

                    //#endregion

                    //#region Show measurement infos

                    chargyLib.CreateDiv2(energyMeterInfosDiv, "measurement",
                                         this.chargy.GetLocalizedMessage("Measurement"),
                                         measurement.phenomena?.[0]?.name ?? measurement.name);

                    chargyLib.CreateDiv2(energyMeterInfosDiv, "OBIS",
                                         this.chargy.GetLocalizedMessage("OBIS code"),
                                         measurement.phenomena?.[0]?.obis ?? measurement.obis);

                    //#endregion

                    //#endregion

                    //#region Show charging tariffs...

                    if (chargingSession.chargingTariffs && chargingSession.chargingTariffs.length > 0)
                    {

                        // Should we also test whether the charging periods are valid?

                        const tariffInfosDiv = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingTariffsInfos");
                                               chargyLib.CreateDiv(tariffInfosDiv,  "headline2",
                                                                   this.chargy.GetLocalizedMessage("Charging Tariffs"));

                        const tariffTableDiv       = tariffInfosDiv.appendChild(document.createElement('div'));
                        tariffTableDiv.classList.add("tariffsTable");

                        for (const tariff of chargingSession.chargingTariffs)
                        {

                            var chargingPeriodRow      = tariffTableDiv.appendChild(document.createElement('div'));
                            chargingPeriodRow.classList.add("chargingTariffRow");
                            chargingPeriodRow.onclick  = () => {
                                this.showChargingTariffDetails(tariff);
                            };

                            const tariffShortName        = chargingPeriodRow.appendChild(document.createElement('div'));
                            tariffShortName.classList.add("shortName");
                            tariffShortName.innerHTML  = tariff.shortName && Object.keys(tariff.shortName).length > 0
                                                                ? tariff.shortName[this.UILanguage] ?? tariff["@id"] ?? ""
                                                                : tariff["@id"] ?? "";

                            if (tariff.summary && Object.keys(tariff.summary).length > 0)
                            {
                                const tariffSummary        = chargingPeriodRow.appendChild(document.createElement('div'));
                                tariffSummary.classList.add("summary");
                                tariffSummary.innerText  = tariff.summary[this.UILanguage] ?? "";
                            }

                        }

                    }

                    //#endregion

                    //#region Show charging periods (when more than one exists)

                    if (chargingSession.chargingPeriods && chargingSession.chargingPeriods.length > 1)
                    {

                        const totalCostsDiv          = chargyLib.CreateDiv(this.detailedInfosDiv,  "chargingPeriodsInfos");
                                                       chargyLib.CreateDiv(totalCostsDiv,  "headline2",
                                                                           this.chargy.GetLocalizedMessage("Charging Periods"));

                        const chargingPeriodsTableDiv  = totalCostsDiv.appendChild(document.createElement('div'));
                        chargingPeriodsTableDiv.classList.add("chargingPeriodsTable");

                        for (let i=0; i<chargingSession.chargingPeriods.length; i++)
                        {

                            const chargingPeriod = chargingSession.chargingPeriods[i];

                            if (chargingPeriod)
                            {

                                var chargingPeriodRow        = chargingPeriodsTableDiv.appendChild(document.createElement('div'));
                                chargingPeriodRow.classList.add("chargingPeriodRow");
                                chargingPeriodRow.onclick    = () => {
                                    this.showChargingPeriodDetails(chargingPeriod);
                                };

                                const startTimestmapDiv      = chargingPeriodRow.appendChild(document.createElement('div'));
                                startTimestmapDiv.classList.add("startTimestamp");
                                startTimestmapDiv.innerHTML  = chargyLib.parseUTC(chargingPeriod.startTimestamp).format('DD.MM.YYYY HH:mm:ss');

                                const duration = this.moment.duration(
                                                     chargyLib.parseUTC(chargingPeriod.endTimestamp  ??
                                                     chargingPeriod.stopTimestamp ??
                                                     chargingSession.chargingPeriods[i+1]?.startTimestamp ??
                                                     "").valueOf()
                                                      -
                                                     chargyLib.parseUTC(chargingPeriod.startTimestamp).valueOf()
                                                 );

                                const durationDiv            = chargingPeriodRow.appendChild(document.createElement('div'));
                                durationDiv.classList.add("duration");
                                durationDiv.innerHTML        = duration.hours() + "h " + duration.minutes() + "m" + duration.seconds() + "s";

                            }

                        }

                    }

                    //#endregion

                    //#region Show charging total costs

                    if (chargingSession.totalCosts)
                    {

                        const totalCostsDiv     = chargyLib.CreateDiv(this.detailedInfosDiv,  "totalCosts");
                                                  chargyLib.CreateDiv(totalCostsDiv,  "headline2",
                                                                      this.chargy.GetLocalizedMessage("Total Costs"));

                        const costsTableDiv       = totalCostsDiv.appendChild(document.createElement('div'));
                        costsTableDiv.classList.add("costsTable");

                        if (chargingSession.totalCosts.reservation?.cost != null)
                        {

                            const reservationCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            reservationCostsRow.classList.add("costsRow");

                            const reservationCostsType     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsType.classList.add("type");
                            reservationCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Reservation");

                            const reservationCostsAmount   = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsAmount.classList.add("amount");
                            reservationCostsAmount.innerHTML  = chargingSession.totalCosts.reservation.amount.toString();

                            const reservationCostsUnit     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsUnit.classList.add("unit");
                            reservationCostsUnit.innerHTML    = chargingSession.totalCosts.reservation.unit;

                            const reservationCostsCost     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCost.classList.add("cost");
                            reservationCostsCost.innerHTML   = chargingSession.totalCosts.reservation.cost.toString();

                            const reservationCostsCurrency = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCurrency.classList.add("currency");
                            reservationCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.energy?.cost != null)
                        {

                            const energyCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            energyCostsRow.classList.add("costsRow");

                            const energyCostsType     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsType.classList.add("type");
                            energyCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Energy");

                            const energyCostsAmount   = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsAmount.classList.add("amount");
                            energyCostsAmount.innerHTML  = chargingSession.totalCosts.energy.amount.toString();

                            const energyCostsUnit     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsUnit.classList.add("unit");
                            energyCostsUnit.innerHTML    = chargingSession.totalCosts.energy.unit;

                            const energyCostsCost     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCost.classList.add("cost");
                            energyCostsCost.innerHTML   = chargingSession.totalCosts.energy.cost.toString();

                            const energyCostsCurrency = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCurrency.classList.add("currency");
                            energyCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.time?.cost != null)
                        {

                            const timeCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            timeCostsRow.classList.add("costsRow");

                            const timeCostsType     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsType.classList.add("type");
                            timeCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Time");

                            const timeCostsAmount   = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsAmount.classList.add("amount");
                            timeCostsAmount.innerHTML  = chargingSession.totalCosts.time.amount.toString();

                            const timeCostsUnit     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsUnit.classList.add("unit");
                            timeCostsUnit.innerHTML    = chargingSession.totalCosts.time.unit;

                            const timeCostsCost     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCost.classList.add("cost");
                            timeCostsCost.innerHTML   = chargingSession.totalCosts.time.cost.toString();

                            const timeCostsCurrency = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCurrency.classList.add("currency");
                            timeCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.idle?.cost != null)
                        {

                            const idleCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            idleCostsRow.classList.add("costsRow");

                            const idleCostsType     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsType.classList.add("type");
                            idleCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Idle");

                            const idleCostsAmount   = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsAmount.classList.add("amount");
                            idleCostsAmount.innerHTML  = chargingSession.totalCosts.idle.amount.toString();

                            const idleCostsUnit     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsUnit.classList.add("unit");
                            idleCostsUnit.innerHTML    = chargingSession.totalCosts.idle.unit;

                            const idleCostsCost     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCost.classList.add("cost");
                            idleCostsCost.innerHTML   = chargingSession.totalCosts.idle.cost.toString();

                            const idleCostsCurrency = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCurrency.classList.add("currency");
                            idleCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                        if (chargingSession.totalCosts.flat?.cost != null)
                        {

                            const flatCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            flatCostsRow.classList.add("costsRow");

                            const flatCostsType     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsType.classList.add("type");
                            flatCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Flat");

                            const flatCostsAmount   = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsAmount.classList.add("amount");

                            const flatCostsUnit     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsUnit.classList.add("unit");

                            const flatCostsCost     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCost.classList.add("cost");
                            flatCostsCost.innerHTML   = chargingSession.totalCosts.flat.cost.toString();

                            const flatCostsCurrency = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCurrency.classList.add("currency");
                            flatCostsCurrency.innerHTML   = chargingSession.totalCosts.currency;

                        }

                    }

                    //#endregion

                    //#region Show measurement values...

                    if (measurement.values.length > 0)
                    {

                        let   measurementCounter    = 0;
                        let   previousValue         = new Decimal(0);

                        const measurementValuesDiv  = chargyLib.CreateDiv(this.detailedInfosDiv, "measurementValues");
                                                      chargyLib.CreateDiv(measurementValuesDiv, "headline2",
                                                                          this.chargy.GetLocalizedMessage("Meter Values"));

                        for (const measurementValue of measurement.values)
                        {

                            measurementCounter++;
                            measurementValue.measurement  = measurement;

                            const measurementValueDiv     = chargyLib.CreateDiv(measurementValuesDiv, "measurementValue");
                            measurementValueDiv.onclick   = () => {
                                this.showMeasurementCryptoDetails(measurementValue);
                            };

                            //#region Show the timestamp

                            chargyLib.CreateDiv(measurementValueDiv, "timestamp",
                                                chargyLib.parseUTC(measurementValue.timestamp).format('HH:mm:ss') + " Uhr");

                            //#endregion

                            //#region Show current energy value

                            let currentValue  = measurementValue.value.times(Math.pow(10, measurementValue.measurement.scale));

                            // Display the energy value differently from its native energy meter representation.
                            // This can be a regulatory requirement based on the calibration law.
                            if (measurementValue.value_displayPrefix &&
                                measurementValue.value_displayPrecision)
                            {
                                if (measurement.unit === "kWh" || measurement.unit === "KILO_WATT_HOURS")
                                {
                                    switch (measurementValue.value_displayPrefix)
                                    {
                                        case chargyInterfaces.DisplayPrefixes.KILO:
                                            currentValue = new Decimal((currentValue                ).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.MEGA:
                                            currentValue = new Decimal((currentValue.div(      1000)).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.GIGA:
                                            currentValue = new Decimal((currentValue.div(   1000000)).toFixed(measurementValue.value_displayPrecision));
                                            break;
                                        default:
                                            currentValue = new Decimal((currentValue.times(    1000)).toFixed(measurementValue.value_displayPrecision));
                                    }
                                }
                                else // Wh
                                {
                                    switch (measurementValue.value_displayPrefix)
                                    {
                                        case chargyInterfaces.DisplayPrefixes.KILO:
                                            currentValue = new Decimal((currentValue.div(      1000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.MEGA:
                                            currentValue = new Decimal((currentValue.div(   1000000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        case chargyInterfaces.DisplayPrefixes.GIGA:
                                            currentValue = new Decimal((currentValue.div(1000000000).toFixed(measurementValue.value_displayPrecision)));
                                            break;
                                        default:
                                            currentValue = new Decimal((currentValue               ).toFixed(measurementValue.value_displayPrecision));
                                    }
                                }
                            }
                            else
                            {
                                //currentValue = new Decimal(currentValue.toFixed(Math.abs(measurementValue.measurement.scale)));
                            }

                            // Show energy value
                            chargyLib.CreateDiv(measurementValueDiv, "value1",
                                                currentValue.toString());

                            //#endregion

                            //#region Show energy unit (kWh or Wh...)

                            // Display the energy unit differently from its native energy meter representation.
                            // This can be a regulatory requirement based on the calibration law.
                            if (measurementValue.value_displayPrefix)
                            {
                                switch (measurementValue.value_displayPrefix)
                                {

                                    case chargyInterfaces.DisplayPrefixes.KILO:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.MEGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "MWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.GIGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "GWh");
                                        break;

                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }
                            else
                            {
                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    // "WATT_HOURS"
                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }

                            //#endregion

                            //#region Show energy difference

                            // Difference (will use the same DisplayPrefix like the plain value!)
                            chargyLib.CreateDiv(measurementValueDiv, "value2",
                                      measurementCounter > 1
                                          ? (currentValue.minus(previousValue).toNumber() >= 0 ? "+" : "") +
                                            (measurementValue.value_displayPrecision
                                                 ? parseFloat((currentValue.minus(previousValue)).toFixed(Math.abs(measurementValue.value_displayPrecision)))
                                                 //: parseFloat((currentValue.minus(previousValue)).toFixed(Math.abs(measurementValue.measurement.scale))))
                                                 : parseFloat((currentValue.minus(previousValue)).toString()))
                                          : "0");

                            // Unit
                            if (measurementCounter <= 1)
                                chargyLib.CreateDiv(measurementValueDiv, "unit2",  "");

                            else if (measurementValue.value_displayPrefix)
                            {
                                switch (measurementValue.value_displayPrefix)
                                {

                                    case chargyInterfaces.DisplayPrefixes.GIGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "GWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.MEGA:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "MWh");
                                        break;

                                    case chargyInterfaces.DisplayPrefixes.KILO:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2", "kWh");
                                        break;

                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit2",  "Wh");
                                        break;

                                }
                            }
                            else
                            {
                                switch (measurement.unit)
                                {

                                    case "kWh":
                                    case "KILO_WATT_HOURS":
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "kWh");
                                        break;

                                    // "WATT_HOURS"
                                    default:
                                        chargyLib.CreateDiv(measurementValueDiv, "unit1", "Wh");
                                        break;

                                }
                            }

                            previousValue = currentValue;

                            //#endregion

                            //#region Show signature status

                            let icon = '<i class="fas fa-times-circle"></i> Ungültige Signatur';

                            if (measurementValue.result)
                                switch (measurementValue.result.status)
                                {

                                    case chargyInterfaces.VerificationResult.ValidationError:

                                        icon = '<i class="fas fa-times-circle"></i> ';

                                        // Format validation errors...
                                        if      (measurementValue.errors                    &&
                                                 measurementValue.errors.length         > 0 &&
                                                 measurementValue.errors[0]            != null)
                                            icon += measurementValue.errors[0];

                                        // Validation errors...
                                        else if (measurementValue.result.errors             &&
                                                 measurementValue.result.errors.length  > 0 &&
                                                 measurementValue.result.errors[0]     != null)
                                            icon += measurementValue.result.errors[0];

                                        else
                                            icon += this.chargy.GetLocalizedMessage("GeneralError");

                                        break;

                                    case chargyInterfaces.VerificationResult.UnknownCTRFormat:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Unknown charge transparency data format!");
                                        break;

                                    case chargyInterfaces.VerificationResult.EnergyMeterNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Energy meter not found");
                                        break;

                                    case chargyInterfaces.VerificationResult.PublicKeyNotFound:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Public key not found");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidPublicKey:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid public key");
                                        break;


                                    case chargyInterfaces.VerificationResult.InvalidSignature:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid signature");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidStartValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid start value");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidIntermediateValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid intermediate value");
                                        break;

                                    case chargyInterfaces.VerificationResult.InvalidStopValue:
                                        icon = '<i class="fas fa-times-circle"></i> ' + this.chargy.GetLocalizedMessage("Invalid stop value");
                                        break;


                                    case chargyInterfaces.VerificationResult.NoOperation:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Meter value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.StartValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Start value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.IntermediateValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("Intermediate value") + '</div>';
                                        break;

                                    case chargyInterfaces.VerificationResult.StopValue:
                                        icon = '<div class="noValidation">' + this.chargy.GetLocalizedMessage("End value") + '</div>';
                                        break;


                                    case chargyInterfaces.VerificationResult.ValidSignature:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid signature");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidStartValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid start value");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidIntermediateValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid intermediate value");
                                        break;

                                    case chargyInterfaces.VerificationResult.ValidStopValue:
                                        icon = '<i class="fas fa-check-circle"></i> ' + this.chargy.GetLocalizedMessage("Valid stop value");
                                        break;

                                }

                            chargyLib.CreateDiv(
                                measurementValueDiv,
                                "verificationStatus",
                                icon
                            );

                            //#endregion

                        }

                    }

                    //#endregion

                }
            }

        }
        catch (exception)
        {
            this.doGlobalError({
                status:     chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                message:    this.chargy.GetLocalizedMessage("Unknown or invalid charge transparency record!"),
                exception:  exception,
                certainty:  0
            });
        }

    }

    //#endregion

    //#region showChargingTariffDetails     (measurementValue)

    private showChargingTariffDetails(measurementValue:  chargyInterfaces.IChargingTariff) : void
    {

        function doError(text: string)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.chargingTariffDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')                   as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')                   as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.chargingTariffDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')        as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

    //#region showChargingPeriodDetails     (chargingPeriod)

    private showChargingPeriodDetails(chargingPeriod:  chargyInterfaces.IChargingPeriod) : void
    {

        function doError(text: string)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.chargingTariffDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')                   as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')                   as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.chargingPeriodDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

    //#region showMeasurementCryptoDetails  (measurementValue)

    private showMeasurementCryptoDetails(measurementValue:  chargeTransparencyRecord.IMeasurementValue) : void
    {

        function doError(text: string)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.measurementsDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')     as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')     as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        if (!measurementValue.measurement ||
            !measurementValue.method)
        {
            doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
            return;
        }

        //#region Show data and result on overlay

        this.measurementsDetailsDiv.style.display = 'block';

        const dataDiv                   = this.measurementsDetailsDiv.querySelector('.data')                      as HTMLDivElement;
        const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        cryptoDataDiv.innerHTML         = '';
        bufferDiv.innerHTML             = '';
        hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        void measurementValue.method.ViewMeasurement(
                 measurementValue,
                 errorDiv,
                 introDiv,

                 cryptoDataDiv,
                 bufferDiv,
                 hashedBufferDiv,
                 publicKeyDiv,
                 signatureExpectedDiv,

                 signatureCheckDiv
             );

    }

    //#endregion

    //#region showPKIDetails                (pkiData)

    private showPKIDetails(pkiData:  any) : void
    {

        function doError(text: string)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.pkiDetailsDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.       querySelector('.error')     as HTMLDivElement;
        const introDiv                  = headlineDiv.       querySelector('.intro')     as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        // if (!measurementValue?.measurement ||
        //     !measurementValue.method)
        // {
        //     doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
        //     return;
        // }

        //#region Show data and result on overlay

        this.pkiDetailsDiv.style.display = 'block';

        // const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
        // const cryptoDataDiv             = dataDiv.        querySelector('#cryptoData')                as HTMLDivElement;
        // const bufferDiv                 = dataDiv.        querySelector('#buffer .value')             as HTMLDivElement;
        // const hashedBufferDiv           = dataDiv.        querySelector('#hashedBuffer .value')       as HTMLDivElement;
        // const publicKeyDiv              = dataDiv.        querySelector('#publicKey .value')          as HTMLDivElement;
        // const signatureExpectedDiv      = dataDiv.        querySelector('#signatureExpected .value')  as HTMLDivElement;

        // cryptoDataDiv.innerHTML         = '';
        // bufferDiv.innerHTML             = '';
        // hashedBufferDiv.innerHTML       = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // publicKeyDiv.innerHTML          = '<span class="error">0x00000000000000000000000000000000000</stlye>';
        // signatureExpectedDiv.innerHTML  = '<span class="error">0x00000000000000000000000000000000000</stlye>';

        //#endregion

        //#region Footer

        //const footerDiv                 = this.measurementsDetailsDiv.querySelector('.footer')                    as HTMLDivElement;
        //const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        //signatureCheckDiv.innerHTML     = '';

        //#endregion

        // measurementValue.method.ViewMeasurement(measurementValue,
        //                                         errorDiv,
        //                                         introDiv,

        //                                         cryptoDataDiv,
        //                                         bufferDiv,
        //                                         hashedBufferDiv,
        //                                         publicKeyDiv,
        //                                         signatureExpectedDiv,

        //                                         signatureCheckDiv);

    }

    //#endregion

}


// Remember to set the application file name for generating the application hash!
// Remember to set Content-Security-Policy for customer support URLs!
// Remember to set Customer Privacy Statement!
// Remember to set Customer Mapbox Access Token and MapId!

const app = new ChargyApp(
                "",
                "&copy; 2018-2026 GraphDefined GmbH",
                "https://chargy.charging.cloud/apps/web/versions",
                true, // Show Feedback Section
                ["support@open.charging.cloud", "?subject=Chargy%20WebApp%20Support"],
                undefined, //["+4993219319101",         "+49 9321 9319 101"],
                "https://chargy.charging.cloud/desktop/issues"
            );
