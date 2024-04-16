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
import * as chargyInterfaces  from './chargyInterfaces'
import * as chargyLib         from './chargyLib'
import * as L                 from 'leaflet';
import Decimal                from 'decimal.js';
import '../scss/chargy.scss';

export class ChargyApp {

    //#region Data

    private readonly leaflet:              any;
    private readonly map:                  L.Map;

    private readonly elliptic:             any;
    private readonly moment:               any;
    private readonly chargy:               Chargy;
    private readonly asn1:                 any;
    private readonly base32Decode:         any;

    public  appEdition:                    string              = "";
    public  copyright:                     string              = "";
    public  versionsURL:                   string              = "";
    public  defaultFeedbackEMail:          string[]            = [];
    public  defaultFeedbackHotline:        string[]            = [];
    public  defaultIssueURL:               string              = "";
    public  packageJson:                   any                 = {};
    public  i18n:                          any                 = {};
    public  UILanguage:                    string              = "de";

    private currentAppInfos:               any                 = null;
    private currentVersionInfos:           any                 = null;
    private currentPackage:                any                 = null;
    private applicationHash:               string              = "";

    private markers:                       any                 = [];
    private minlat:                        number              = +1000;
    private maxlat:                        number              = -1000;
    private minlng:                        number              = +1000;
    private maxlng:                        number              = -1000;

    private appDiv:                        HTMLDivElement;
    private headlineDiv:                   HTMLDivElement;
    private verifyframeDiv:                HTMLDivElement;

    private updateAvailableButton:         HTMLButtonElement;
    private aboutButton:                   HTMLButtonElement;
    private fullScreenButton:              HTMLButtonElement;
    private appQuitButton:                 HTMLButtonElement;

    private updateAvailableScreen:         HTMLDivElement;
    private inputDiv:                      HTMLDivElement;
    private inputInfosDiv:                 HTMLDivElement;
    private aboutScreenDiv:                HTMLDivElement;
    private applicationHashDiv:            HTMLDivElement;
    private applicationHashValueDiv:       HTMLDivElement;
    private chargingSessionScreenDiv:      HTMLDivElement;
    private invalidDataSetsScreenDiv:      HTMLDivElement;
    private inputButtonsDiv:               HTMLDivElement;
    private backButton:                    HTMLButtonElement;
    private exportButtonDiv:               HTMLDivElement;
    private exportButton:                  HTMLButtonElement;
    private fileInputButton:               HTMLButtonElement;
    private fileInput:                     HTMLInputElement;
    private pasteButton:                   HTMLButtonElement;
    private detailedInfosDiv:              HTMLDivElement;
    private errorTextDiv:                  HTMLDivElement;
    private feedbackDiv:                   HTMLDivElement;
    private overlayDiv:                    HTMLDivElement;
    private overlayLeftButton:             HTMLButtonElement;
    private overlayRightButton:            HTMLButtonElement;
    private issueTrackerDiv:               HTMLDivElement;
    private privacyStatement:              HTMLDivElement;

    private showFeedbackSection:           Boolean;
    private feedbackMethodsDiv:            HTMLDivElement;
    private feedbackEMailAnchor:           HTMLAnchorElement;
    private feedbackHotlineAnchor:         HTMLAnchorElement;
    private showIssueTrackerButton:        HTMLButtonElement;
    private issueTrackerText:              HTMLDivElement;
    private sendIssueButton:               HTMLButtonElement;
    private issueBackButton:               HTMLButtonElement;

    private showPrivacyStatement:          HTMLButtonElement;
    private privacyStatementAccepted:      HTMLInputElement;
    private softwareInfosDiv:              HTMLDivElement;
    private openSourceLibsDiv:             HTMLDivElement;

    //#endregion

    constructor(appEdition?:           string,
                copyright?:            string,
                versionsURL?:          string,
                showFeedbackSection?:  Boolean,
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

        //#endregion

        //#region Load external data from web server

        this.loadI18n();
        this.loadPackageJSON();

        //#endregion

        //#region Load JavaScript libraries

        this.elliptic                  = require('elliptic');
        this.moment                    = require('moment');
        this.asn1                      = require('asn1.js');
        this.base32Decode              = require('base32-decode')

        //#endregion

        //#region Set up the GUI

        this.appDiv                    = document.getElementById('app')                                      as HTMLDivElement;
        this.headlineDiv               = document.getElementById('headline')                                 as HTMLDivElement;
        this.verifyframeDiv            = document.getElementById('verifyframe')                              as HTMLDivElement;

        this.updateAvailableScreen     = document.getElementById('updateAvailableScreen')                    as HTMLDivElement;
        this.chargingSessionScreenDiv  = document.getElementById('chargingSessionScreen')                    as HTMLDivElement;
        this.invalidDataSetsScreenDiv  = document.getElementById('invalidDataSetsScreen')                    as HTMLDivElement;
        this.detailedInfosDiv          = document.getElementById('detailedInfos')                            as HTMLDivElement;
        this.inputDiv                  = document.getElementById('input')                                    as HTMLDivElement;
        this.inputInfosDiv             = document.getElementById('inputInfos')                               as HTMLDivElement;
        this.errorTextDiv              = document.getElementById('errorText')                                as HTMLDivElement;
        this.overlayDiv                = document.getElementById('overlay')                                  as HTMLDivElement;

        this.applicationHashDiv        = document.getElementById('applicationHash')                          as HTMLDivElement;
        this.applicationHashValueDiv   = this.applicationHashDiv.querySelector("#value")                     as HTMLDivElement;

        this.feedbackDiv               = document.getElementById('feedback')                                 as HTMLDivElement;
        this.feedbackMethodsDiv        = this.feedbackDiv.       querySelector("#feedbackMethods")           as HTMLDivElement;
        this.showIssueTrackerButton    = this.feedbackMethodsDiv.querySelector("#showIssueTracker")          as HTMLButtonElement;
        this.feedbackEMailAnchor       = this.feedbackMethodsDiv.querySelector("#eMail")                     as HTMLAnchorElement;
        this.feedbackHotlineAnchor     = this.feedbackMethodsDiv.querySelector("#hotline")                   as HTMLAnchorElement;

        this.issueTrackerDiv           = document.getElementById('issueTracker')                             as HTMLDivElement;
        this.issueTrackerText          = this.issueTrackerDiv.   querySelector("#issueTrackerText")          as HTMLDivElement;
        this.privacyStatement          = this.issueTrackerDiv.   querySelector("#privacyStatement")          as HTMLDivElement;
        this.issueBackButton           = this.issueTrackerDiv.   querySelector("#issueBackButton")           as HTMLButtonElement;
        this.showPrivacyStatement      = this.issueTrackerDiv.   querySelector("#showPrivacyStatement")      as HTMLButtonElement;
        this.privacyStatementAccepted  = this.issueTrackerDiv.   querySelector("#privacyStatementAccepted")  as HTMLInputElement;
        this.sendIssueButton           = this.issueTrackerDiv.   querySelector("#sendIssueButton")           as HTMLButtonElement;

        this.aboutScreenDiv            = document.getElementById('aboutScreen')                              as HTMLDivElement;
        this.softwareInfosDiv          = this.aboutScreenDiv.    querySelector("#softwareInfos")             as HTMLDivElement;
        this.openSourceLibsDiv         = this.aboutScreenDiv.    querySelector("#openSourceLibs")            as HTMLDivElement;

        this.updateAvailableButton     = document.getElementById('updateAvailableButton')                    as HTMLButtonElement;
        this.aboutButton               = document.getElementById('aboutButton')                              as HTMLButtonElement;
        this.fullScreenButton          = document.getElementById('fullScreenButton')                         as HTMLButtonElement;
        this.appQuitButton             = document.getElementById('appQuitButton')                            as HTMLButtonElement;
        this.overlayLeftButton         = document.getElementById('overlayLeftButton')                        as HTMLButtonElement;
        this.overlayRightButton        = document.getElementById('overlayRightButton')                       as HTMLButtonElement;
        this.fileInputButton           = document.getElementById('fileInputButton')                          as HTMLButtonElement;
        this.pasteButton               = document.getElementById('pasteButton')                              as HTMLButtonElement;

        this.inputButtonsDiv           = document.getElementById('inputButtons')                             as HTMLDivElement;
        this.backButton                = this.inputButtonsDiv.   querySelector("#backButton")                as HTMLButtonElement;

        this.exportButtonDiv           = document.getElementById('exportButtonDiv')                          as HTMLDivElement;
        this.exportButton              = this.exportButtonDiv.   querySelector("#exportButton")              as HTMLButtonElement;

        //#endregion

        this.chargy                    = new Chargy(this.i18n,
                                                    this.UILanguage,
                                                    this.elliptic,
                                                    this.moment,
                                                    this.asn1,
                                                    this.base32Decode);


        //#region OnWindowResize

        window.onresize = (ev: UIEvent) => {
            this.verifyframeDiv.style.maxHeight = (this.appDiv.clientHeight - this.headlineDiv.clientHeight).toString() + "px";
        }

        // Call it once on application start
        window.dispatchEvent(new Event("resize"));

        //#endregion

        //#region Set infos of the feedback section

        this.UpdateFeedbackSection();

        //#endregion

        //#region The Issue tracker

        this.showPrivacyStatement.onclick = (ev: MouseEvent) => {
            ev.preventDefault();
            this.privacyStatement.style.display = "block";
            this.issueTrackerText.scrollTop = this.issueTrackerText.scrollHeight;
        }

        this.privacyStatementAccepted.onchange = (ev: Event) => {
            this.sendIssueButton.disabled  = !this.privacyStatementAccepted.checked;
        }

        this.sendIssueButton.onclick = (ev: MouseEvent) => {

            ev.preventDefault();

            try
            {

                //#region Collect issue data...

                const newIssueForm  = document.getElementById('newIssueForm') as HTMLFormElement;
                let   data:any      = {};

                data["timestamp"]                  = new Date().toISOString();
                data["chargyVersion"]              = this.packageJson.version;
                data["platform"]                   = process.platform;

                data["invalidCTR"]                 = (newIssueForm.querySelector("#invalidCTR")                as HTMLInputElement).checked;
                data["InvalidStationData"]         = (newIssueForm.querySelector("#InvalidStationData")        as HTMLInputElement).checked;
                data["invalidSignatures"]          = (newIssueForm.querySelector("#invalidSignatures")         as HTMLInputElement).checked;
                data["invalidCertificates"]        = (newIssueForm.querySelector("#invalidCertificates")       as HTMLInputElement).checked;
                data["transparencenySoftwareBug"]  = (newIssueForm.querySelector("#transparencenySoftwareBug") as HTMLInputElement).checked;
                data["DSGVO"]                      = (newIssueForm.querySelector("#DSGVO")                     as HTMLInputElement).checked;
                data["BITV"]                       = (newIssueForm.querySelector("#BITV")                      as HTMLInputElement).checked;

                data["description"]                = (newIssueForm.querySelector("#issueDescription")          as HTMLTextAreaElement).value;

                if ((newIssueForm.querySelector("#includeCTR") as HTMLSelectElement).value == "yes")
                {
                    try
                    {

                        const stringify  = require('safe-stable-stringify');
                        const ctr        = stringify(this.chargy.currentCTR);

                        if (ctr !== "{}")
                            data["chargeTransparencyRecord"] = ctr;

                    }
                    catch (exception)
                    { }
                }

                data["name"]                       = (newIssueForm.querySelector("#issueName")                 as HTMLInputElement).value;
                data["phone"]                      = (newIssueForm.querySelector("#issuePhone")                as HTMLInputElement).value;
                data["eMail"]                      = (newIssueForm.querySelector("#issueEMail")                as HTMLInputElement).value;

                //#endregion

                //#region Send issue to API

                let sendIssue = new XMLHttpRequest();

                sendIssue.open("SUBMIT",
                               this.defaultIssueURL,
                               true);
                sendIssue.setRequestHeader('Content-type', 'application/json');

                sendIssue.onreadystatechange = function () {

                    // 0 UNSENT | 1 OPENED | 2 HEADERS_RECEIVED | 3 LOADING | 4 DONE
                    if (this.readyState == 4) {

                        if (this.status == 201) { // HTTP 201 - Created
                            (document.getElementById('issueTracker') as HTMLDivElement).style.display  = 'none';
                            //ToDo: Show thank you for your issue!
                        }

                        else
                        {
                            alert("Leider ist ein Fehler bei der Datenübertragung aufgetreten. Bitte probieren Sie es erneut!");
                        }

                    }

                }

                sendIssue.send(JSON.stringify(data));

                //#endregion

            }
            catch (exception)
            {
                alert("Leider ist ein Fehler bei der Datenübertragung aufgetreten. Bitte probieren Sie es erneut!");
            }

        }

        this.issueBackButton.onclick = (ev: MouseEvent) => {
            this.issueTrackerDiv.style.display = 'none';
        }

        //#endregion


        //#region Handle the 'Update available'-button

        this.updateAvailableButton.onclick = (ev: MouseEvent) => {
            this.updateAvailableScreen.style.display     = "block";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "block";
            this.exportButtonDiv.style.display           = "none";
        }

        //#endregion

        //#region Handle the 'About'-button

        this.aboutButton.onclick = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = "none";
            this.aboutScreenDiv.style.display            = "block";
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
                        sigHeadDiv.innerHTML = "<i class=\"fas fa-times-circle\"></i> Ungültiger Hashwert!";

                    // At least the same hash value...
                    else
                    {

                        if (this.currentPackage.signatures == null || this.currentPackage.signatures.length == 0)
                        {
                            sigHeadDiv.innerHTML = "<i class=\"fas fa-check-circle\"></i> Gültiger Hashwert";
                        }

                        // Some crypto signatures found...
                        else
                        {

                            sigHeadDiv.innerHTML = "Bestätigt durch...";

                            const signaturesDiv = this.applicationHashDiv.children[3];

                            if (signaturesDiv != null)
                            {
                                for (const signature of this.currentPackage.signatures)
                                {

                                    const signatureDiv = signaturesDiv.appendChild(document.createElement('div'));

                                    if (signatureDiv != null)
                                        signatureDiv.innerHTML = this.checkApplicationHashSignature(this.currentAppInfos,
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

        const d = document as any;
        this.fullScreenButton.onclick = (ev: MouseEvent) => {
            if (d.fullScreen || d.mozFullScreen || d.webkitIsFullScreen)
            {
                this.overlayDiv.classList.remove("fullScreen");
                chargyLib.closeFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
            else
            {
                this.overlayDiv.classList.add("fullScreen");
                chargyLib.openFullscreen();
                this.fullScreenButton.innerHTML = '<i class="fas fa-compress"></i>';
            }
        }

        //#endregion

        //#region Handle the 'App Quit'-button

        this.appQuitButton.onclick = (ev: MouseEvent) => {
            window.close();
        }

        //#endregion


        //#region Handle the 'back'-button

        this.backButton.onclick  = (ev: MouseEvent) => {

            this.updateAvailableScreen.style.display     = "none";
            this.inputDiv.style.flexDirection            = "";
            this.inputInfosDiv.style.display             = 'flex';
            this.aboutScreenDiv.style.display            = "none";
            this.chargingSessionScreenDiv.style.display  = "none";
            this.invalidDataSetsScreenDiv.style.display  = "none";
            this.inputButtonsDiv.style.display           = "none";
            this.exportButtonDiv.style.display           = "none";
            this.fileInput.value                         = "";
            this.detailedInfosDiv.innerHTML              = "";

            this.minlat = +1000;
            this.maxlat = -1000;
            this.minlng = +1000;
            this.maxlng = -1000;

        }

        //#endregion

        //#region Handle the 'export'-button

        this.exportButton.onclick  = async (ev: MouseEvent) => {

            try
            {

                // const path = this.ipcRenderer.sendSync('showSaveDialog')

                // if (path != null)
                //     require('original-fs').writeFileSync(path,
                //                                          JSON.stringify(this.chargy.currentCTR, null, '\t'),
                //                                          'utf-8');

            }
            catch(exception)
            {
                alert('Failed to save the charge transparency record!' + exception);
            }

        }

        //#endregion

        //#region Handle the 'Overlay Left'-button

        this.overlayLeftButton.onclick = (ev: MouseEvent) => {
            this.overlayDiv.style.display = 'none';
        }

        //#endregion


        //#region Modify external links to be opened in the external web browser

        //const shell        = require('electron').shell;
        const linkButtons  = document.getElementsByClassName('linkButton') as HTMLCollectionOf<HTMLButtonElement>;

        for (let i = 0; i < linkButtons.length; i++) {

            const linkButton = linkButtons[i];

            if (linkButton != null)
            {
                linkButton.onclick = function (this: GlobalEventHandlers, ev: MouseEvent) {
                    ev.preventDefault();
                    const link = linkButton.getAttribute("href");
                    if (link && (link.startsWith("http://") || link.startsWith("https://"))) {
                        //shell.openExternal(link);
                    }
                }
            }

        }

        //#endregion


        //#region Handle the 'fileInput'-button

        this.fileInput  = document.getElementById('fileInput')  as HTMLInputElement;
        this.fileInputButton.onclick = (ev: MouseEvent) => {
            this.fileInput.value = '';
            this.fileInput.click();
        }

        this.fileInput.onchange = (ev: Event) => {

            //@ts-ignore
            var files = ev?.target?.files;

            if (files != null)
                this.readFilesFromDiskInBrowser(files[0]);

        }

        //#endregion

        //#region Handle Drag'n'Drop of charge transparency files

        this.inputDiv.addEventListener('dragenter', (event: DragEvent) => {
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragover',  (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            (event.currentTarget as HTMLDivElement)?.classList.add('over');
        }, false);

        this.inputDiv.addEventListener('dragleave', (event: DragEvent) => {
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
        }, false);

        this.inputDiv.addEventListener('drop',      (event: DragEvent) => {
            event.stopPropagation();
            event.preventDefault();
            (event.currentTarget as HTMLDivElement)?.classList.remove('over');
            if (event.dataTransfer?.files != null)
                this.readFilesFromDiskInBrowser(event.dataTransfer.files[0] as Blob);
        }, false);

        //#endregion

        //#region Handle the 'paste'-button

        this.pasteButton.onclick = async (ev: MouseEvent)  => {
            await this.readClipboard();
        }

        //#endregion


        this.leaflet = L;
        this.map   = L.map(document.getElementById('map') as HTMLElement);
        this.map.setView([49.7325504, 10.1424442], 10);

        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution:  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
            tileSize:      512,
            maxZoom:        18,
            zoomOffset:     -1,
            id:           'mapbox/light-v10',
            accessToken:  'pk.eyJ1IjoiYWh6ZiIsImEiOiJOdEQtTkcwIn0.Cn0iGqUYyA6KPS8iVjN68w'
        }).addTo(this.map);


        //#region Calculate application hash

        this.calcApplicationHash();

        //#endregion

    }





    private async loadI18n() {
        try {

            const response = await fetch('i18n.json');

            if (!response.ok)
                throw new Error('Network response was not ok');

            const data = await response.json();
            Object.assign(this.i18n, data);

        } catch (error) {
            console.error('There has been a problem with fetching "i18n.json":', error);
        }
    }

    private async loadPackageJSON() {
        try {

            const response = await fetch('package.json');

            if (!response.ok)
                throw new Error('Network response was not ok');

            const data = await response.json();
            Object.assign(this.packageJson, data);

            //#region Set infos of the about section

                (this.softwareInfosDiv. querySelector("#appEdition")             as HTMLSpanElement).innerHTML = this.appEdition;
                (this.softwareInfosDiv. querySelector("#appVersion")             as HTMLSpanElement).innerHTML = this.packageJson.version;
                (this.softwareInfosDiv. querySelector("#copyright")              as HTMLSpanElement).innerHTML = this.copyright;

                (this.openSourceLibsDiv.querySelector("#chargyVersion")          as HTMLSpanElement).innerHTML = this.packageJson.version;

            if (this.packageJson.devDependencies)
            {
                (this.openSourceLibsDiv.querySelector("#SASS")                   as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["sass"]?.                   replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#typeScript")             as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["typescript"]?.             replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#webpack")                as HTMLSpanElement).innerHTML = this.packageJson.devDependencies["webpack"]?.                replace(/[^0-9\.]/g, "");
            }

            if (this.packageJson.dependencies)
            {
                (this.openSourceLibsDiv.querySelector("#elliptic")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["elliptic"]?.               replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#momentJS")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["moment"]?.                 replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#pdfjsdist")              as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["pdfjs-dist"]?.             replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#decompress")             as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress"]?.             replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#decompressBZIP2")        as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress-bzip2"]?.       replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#decompressGZ")           as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decompress-gz"]?.          replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#fileType")               as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["file-type"]?.              replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#asn1JS")                 as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["asn1.js"]?.                replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#base32Decode")           as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["base32-decode"]?.          replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#safeStableStringify")    as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["safe-stable-stringify"]?.  replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#leafletJS")              as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["leaflet"]?.                replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#leafletAwesomeMarkers")  as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["leaflet.awesome-markers"]?.replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#chartJS")                as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["chart.js"]?.               replace(/[^0-9\.]/g, "");
                (this.openSourceLibsDiv.querySelector("#decimalJS")              as HTMLSpanElement).innerHTML = this.packageJson.dependencies   ["decimal.js"]?.             replace(/[^0-9\.]/g, "");
            }

            //#endregion



        } catch (error) {
            console.error('There has been a problem with fetching "package.json":', error);
        }
    }





    //#region UpdateFeedbackSection()

    public UpdateFeedbackSection(FeedbackEMail?:   String[],
                                 FeedbackHotline?: String[]) {

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

    //#region doGlobalError(...)

    private doGlobalError(result:   chargyInterfaces.ISessionCryptoResult,
                          context?: any)
    {

        let text = "Unbekannter Transparenzdatensatz!";

        if (result?.message !== null &&
            result?.message !== undefined)
        {
            text = result.message.trim();
        }

        if (result !== null                    &&
            result !== undefined               &&
            result.errors                      &&
            result.errors        !== undefined &&
            result.errors        !== null      &&
            result.errors.length   > 0         &&
            result.errors[0]     !== undefined)
        {
            text = result.errors[0].trim();
        }

        this.inputDiv.style.flexDirection            = "";
        this.inputInfosDiv.style.display             = 'flex';
        this.chargingSessionScreenDiv.style.display  = 'none';
        this.chargingSessionScreenDiv.innerHTML      = '';
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.errorTextDiv.style.display              = 'inline-block';
        this.errorTextDiv.innerHTML                  = '<i class="fas fa-times-circle"></i> ' + text;

        // console.log(text);
        // console.log(context);

        // this.ipcRenderer.sendSync('setVerificationResult', result);

    }

    //#endregion

    //#region readClipboard()

    private async readClipboard()
    {
        try
        {
            let text = await navigator.clipboard.readText();
            this.detectAndConvertContentFormat(text);
        }
        catch (exception)
        {
            if (exception instanceof DOMException &&
                exception.message === "Document is not focused.")
            {
                // ignore!
            }
            else
            {
                this.doGlobalError({
                    status:    chargyInterfaces.SessionVerificationResult.UnknownSessionFormat,
                    message:   this.chargy.GetLocalizedMessage("UnknownOrInvalidChargeTransparencyRecord"),
                    certainty: 0
                });
            }
        }
    }

    //#endregion

    //#region readFile(s)FromDisk()

    private stringToArrayBuffer(str: string): ArrayBuffer {

        var buf     = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);

        for (var i=0, strLen=str.length; i < strLen; i++)
            bufView[i] = str.charCodeAt(i);

        return buf;

    }

    private readFilesFromDiskInBrowser(file: Blob)
    {

        const reader  = new FileReader();
        const that    = this;

        reader.onload = function(loadEvent) {

            const fileContent = loadEvent.target?.result; // Hier ist der Inhalt der Datei
            const filename    = { name: "abc.txt", path: "file://abc.txt", type: "text/plain" };

            let loadedFiles = new Array<chargyInterfaces.IFileInfo>();

            if (typeof(fileContent) === 'string')
                loadedFiles.push({
                    "name":  filename.name,
                    "path":  filename.path,
                    "type":  filename.type,
                    "data":  that.stringToArrayBuffer(fileContent)
                });

            else if (fileContent)
                loadedFiles.push({
                    "name":  filename.name,
                    "path":  filename.path,
                    "type":  filename.type,
                    "data":  fileContent
                });

            that.detectAndConvertContentFormat(loadedFiles);

        };

        reader.onerror = function() {
            console.error("Beim Lesen der Datei ist ein Fehler aufgetreten.");
        };

        reader.readAsArrayBuffer(file);

    }


    private readFilesFromDisk(files: string[]|FileList): void {
        if (files != null && files.length > 0)
        {

            //#region Map file names

            const filesToLoad = new Array<chargyInterfaces.IFileInfo>();

            for (let i = 0; i < files.length; i++)
            {

                let file = files[i];

                if (file != undefined)
                {
                    if (typeof file == 'string')
                        filesToLoad.push({ name: file });
                    else
                        filesToLoad.push(file)
                }

            }

            //#endregion

            let fs          = require('original-fs');
            let loadedFiles = new Array<chargyInterfaces.IFileInfo>();

            for (const filename of filesToLoad)
            {
                if (filename.name.trim() != "" && filename.name != "." && filename.name[0] != '-')
                {
                    try
                    {

                        loadedFiles.push({
                                       "name":  filename.name,
                                       "path":  filename.path,
                                       "type":  filename.type,
                                       "data":  fs.readFileSync((filename.path ?? filename.name).replace("file://", ""))
                                    });

                    }
                    catch (exception) {
                        loadedFiles.push({
                            "name":       filename.name,
                            "path":       filename.path,
                            "error":     "Fehlerhafter Transparenzdatensatz!",
                            "exception":  exception
                         });
                    }
                }
            }


            if (loadedFiles.length > 0)
                this.detectAndConvertContentFormat(loadedFiles);

        }
    }

    //#endregion


    //#region calcApplicationHash(...)

    private async calcApplicationHash()
    {

        const files = [
            'index.html',
            'css/chargy.css',
            'chargyWebApp-bundle.js',
            'i18n.json',
            'package.json'
        ];

        try
        {

            const hashes        = await Promise.all(files.map(url => chargyLib.hashFile(url)));
            const combinedHash  = await crypto.subtle.digest('SHA-512', chargyLib.ConcatenateBuffers(hashes));

            this.applicationHash                    = chargyLib.buf2hex(combinedHash);
            this.applicationHashValueDiv.innerHTML  = this.applicationHash.match(/.{1,8}/g)?.join(" ") ?? "";

        } catch (error) {
            console.error(`An error occurred: ${error}`);
            return "";
        }

    }

    //#endregion

    //#region checkApplicationHashSignature(...)

    private checkApplicationHashSignature(app:        any,
                                          version:    any,
                                          _package:   any,
                                          signature:  any): string
    {

        if (app == null || version == null || _package == null || signature == null)
            return "<i class=\"fas fa-times-circle\"></i>Ungültige Signatur!";

        try {

            var toCheck = {
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

            var Input       = JSON.stringify(toCheck);
            var sha256value = require('crypto').createHash('sha256').
                                                update(Input, 'utf8').
                                                digest('hex');

            var result = new this.elliptic.ec('secp256k1').
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


    //#region detectAndConvertContentFormat(FileInfos)

    private async detectAndConvertContentFormat(FileInfos: Array<chargyInterfaces.IFileInfo>|chargyInterfaces.IFileInfo|string) {

        this.inputInfosDiv.style.display  = 'none';
        this.errorTextDiv.style.display   = 'none';

        //@ts-ignore
        let result:IChargeTransparencyRecord|ISessionCryptoResult = null;

        if (typeof FileInfos === 'string')
            result = await this.chargy.DetectAndConvertContentFormat([{
                                                                         name: "clipboard",
                                                                         data: new TextEncoder().encode(FileInfos)
                                                                      }]);

        else if (chargyInterfaces.isIFileInfo(FileInfos))
            result = await this.chargy.DetectAndConvertContentFormat([ FileInfos ]);

        else
            result = await this.chargy.DetectAndConvertContentFormat(FileInfos);


        if (chargyInterfaces.IsAChargeTransparencyRecord(result))
        {

            // if (!this.ipcRenderer.sendSync('noGUI'))
                 await this.showChargeTransparencyRecord(result);

            // this.ipcRenderer.sendSync('setVerificationResult', result.chargingSessions?.map(session => session.verificationResult));

        }

        else
            this.doGlobalError(result ??
                               {
                                   status:   chargyInterfaces.SessionVerificationResult.InvalidSessionFormat,
                                   message:  "Unbekannter Transparenzdatensatz!"
                               });

    }

    //#endregion

    //#region showChargeTransparencyRecord(CTR)

    private async showChargeTransparencyRecord(CTR: chargyInterfaces.IChargeTransparencyRecord)
    {

        if (CTR == null)
            return;

        //#region Prepare View

        this.inputDiv.style.flexDirection            = "column";
        this.chargingSessionScreenDiv.style.display  = "flex";
        this.chargingSessionScreenDiv.innerText      = "";
        this.invalidDataSetsScreenDiv.style.display  = "none";
        this.invalidDataSetsScreenDiv.innerText      = "";
        this.inputButtonsDiv.style.display           = "flex";
        this.exportButtonDiv.style.display           = "flex";

        //#endregion


        //#region Show CTR infos

        let descriptionDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
        descriptionDiv.id  = "description";
        descriptionDiv.innerText = chargyLib.firstValue(CTR.description) ?? this.chargy.GetLocalizedMessage("All charging sessions");

        const ctrBeginText  = CTR.begin ? chargyLib.parseUTC(CTR.begin).format('dddd, D. MMMM YYYY') : null;
        const ctrEndText    = CTR.end   ? chargyLib.parseUTC(CTR.end).  format('dddd, D. MMMM YYYY') : null;

        if (ctrBeginText) {
            let beginDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            beginDiv.id        = "begin";
            beginDiv.className = "dates";
            beginDiv.innerHTML = (ctrBeginText == ctrEndText ? this.chargy.GetLocalizedMessage("on") : this.chargy.GetLocalizedMessage("from")) + " " + ctrBeginText;
        }

        if (ctrEndText && ctrEndText != ctrBeginText) {
            let endDiv = this.chargingSessionScreenDiv.appendChild(document.createElement('div'));
            endDiv.id          = "end";
            endDiv.className   = "dates";
            endDiv.innerHTML   = this.chargy.GetLocalizedMessage("till") + " " + ctrEndText;
        }

        //#endregion

        //#region Show global contract infos

        if (CTR.contract)
        {
        }

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
                chargingSessionDiv.onclick  = (ev: MouseEvent) => {

                    //#region Highlight the selected charging session...

                    const AllChargingSessionsDivs = document.getElementsByClassName("chargingSession");

                    if (AllChargingSessionsDivs != null)
                        for(var i=0; i<AllChargingSessionsDivs.length; i++)
                            AllChargingSessionsDivs[i]?.classList.remove("activated");

                    //(this as HTMLDivElement)?.classList.add("activated");
                    (ev.currentTarget as HTMLDivElement)?.classList.add("activated");

                    //#endregion

                    this.showChargingSessionDetails(chargingSession);

                };

                //#region Show session time infos

                try
                {

                    if (chargingSession.begin)
                    {

                        let dateDiv  = chargingSessionDiv.appendChild(document.createElement('div'));
                        dateDiv.className = "date";
                        //dateDiv.innerHTML = UTC2human(chargingSession.begin);
                        dateDiv.innerHTML = chargyLib.time2human(chargingSession.begin);

                        if (chargingSession.end)
                        {

                            let endUTC   = chargyLib.parseUTC(chargingSession.end);
                            let duration = this.moment.duration(endUTC - chargyLib.parseUTC(chargingSession.begin));

                            dateDiv.innerHTML += " - " +
                                                (Math.floor(duration.asDays()) > 0 ? endUTC.format("dddd") + " " : "") +
                                                endUTC.format('HH:mm:ss') +
                                                " Uhr";

                        }

                    }

                }
                catch (exception)
                { 
                    console.log("Could not show session time infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                const tableDiv              = chargingSessionDiv.appendChild(document.createElement('div'));
                      tableDiv.className    = "table";

                //#region Show energy infos

                try
                {

                    let productInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                    productInfoDiv.className             = "productInfos";

                    let productIconDiv                   = productInfoDiv.appendChild(document.createElement('div'));
                    productIconDiv.className             = "icon";
                    productIconDiv.innerHTML             = '<i class="fas fa-chart-pie"></i>';

                    let productDiv                       = productInfoDiv.appendChild(document.createElement('div'));
                    productDiv.className                 = "text";
                    productDiv.innerHTML = chargingSession.product != null ? chargingSession.product["@id"] + "<br />" : "";

                    if (chargingSession.begin && chargingSession.end)
                    {

                        let duration = this.moment.duration(chargyLib.parseUTC(chargingSession.end) - chargyLib.parseUTC(chargingSession.begin));

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
                        for (let measurement of chargingSession.measurements)
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

                        var parkingInfoDiv                   = tableDiv.appendChild(document.createElement('div'));
                        parkingInfoDiv.className             = "parkingInfos";

                        var parkingIconDiv                   = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingIconDiv.className             = "icon";
                        parkingIconDiv.innerHTML             = '<i class="fas fa-parking"></i>';

                        var parkingDiv                       = parkingInfoDiv.appendChild(document.createElement('div'));
                        parkingDiv.className                 = "text";
                       // parkingDiv.innerHTML = chargingSession.parking != null ? chargingSession.product["@id"] + "<br />" : "";

                        const lastParking = chargingSession.parking[chargingSession.parking.length-1];

                        if (lastParking?.end != null)
                        {

                            let parkingBegin = chargyLib.parseUTC(chargingSession.parking[0]?.begin ?? "-");
                            let parkingEnd   = chargyLib.parseUTC(lastParking.end);
                            let duration     = this.moment.duration(parkingEnd - parkingBegin);

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
                    console.log("Could not show parking infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show authorization start/stop information

                try {

                    if (chargingSession.authorizationStart != null)
                    {

                        var authorizationStartDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStartDiv.className  = "authorizationStart";

                        var authorizationStartIconDiv                   = authorizationStartDiv.appendChild(document.createElement('div'));
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

                        var authorizationStartIdDiv                     = authorizationStartDiv.appendChild(document.createElement('div'));
                        authorizationStartIdDiv.className               = "id";
                        authorizationStartIdDiv.innerHTML = chargingSession.authorizationStart["@id"];

                    }

                    if (chargingSession.authorizationStop != null)
                    {

                        var authorizationStopDiv            = tableDiv.appendChild(document.createElement('div'));
                            authorizationStopDiv.className  = "authorizationStop";

                        var authorizationStopIconDiv                   = authorizationStopDiv.appendChild(document.createElement('div'));
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

                        var authorizationStopIdDiv                     = authorizationStopDiv.appendChild(document.createElement('div'));
                        authorizationStopIdDiv.className               = "id";
                        authorizationStopIdDiv.innerHTML = chargingSession.authorizationStop["@id"];

                    }                        

                } catch (exception)
                {
                    console.log("Could not show authorization start/stop infos of charging session '" + chargingSession["@id"] + "':" + exception);
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

                        var chargingStationInfoDiv            = tableDiv.appendChild(document.createElement('div'));
                        chargingStationInfoDiv.className      = "chargingStationInfos";

                        var chargingStationIconDiv            = chargingStationInfoDiv.appendChild(document.createElement('div'));
                        chargingStationIconDiv.className      = "icon";
                        chargingStationIconDiv.innerHTML      = '<i class="fas fa-charging-station"></i>';

                        var chargingStationDiv                = chargingStationInfoDiv.appendChild(document.createElement('div'));
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
                            chargingStationDiv.innerHTML      = (chargingSession.EVSE   != null && chargingSession.EVSE.description != null
                                                                    ? chargyLib.firstValue(chargingSession.EVSE.description) + "<br />"
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
                                chargingStationDiv.innerHTML      = (chargingSession.chargingStation   != null && chargingSession.chargingStation.description != null
                                                                        ? chargyLib.firstValue(chargingSession.chargingStation.description) + "<br />"
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
                                chargingStationDiv.innerHTML      = (chargingSession.chargingPool   != null && chargingSession.chargingPool.description != null
                                                                        ? chargyLib.firstValue(chargingSession.chargingPool.description) + "<br />"
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
                    console.log("Could not show charging station infos of charging session '" + chargingSession["@id"] + "':" + exception);
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

                        var locationInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        locationInfoDiv.className  = "locationInfos";

                        var locationIconDiv        = locationInfoDiv.appendChild(document.createElement('div'));
                        locationIconDiv.className  = "icon";
                        locationIconDiv.innerHTML  = '<i class="fas fa-map-marker-alt"></i>';

                        var locationDiv            = locationInfoDiv.appendChild(document.createElement('div'));
                        locationDiv.classList.add("text");
                        locationDiv.innerHTML      =   (address.street      != null ? " " + address.street        : "") +
                                                       (address.houseNumber != null ? " " + address.houseNumber   : "") +

                                                       (address.postalCode  != null || address.city != null ? "," : "") +
                                                       (address.postalCode  != null ? " " + address.postalCode    : "") +
                                                       (address.city        != null ? " " + address.city : "");

                    }

                } catch (exception)
                {
                    console.log("Could not show location infos of charging session '" + chargingSession["@id"] + "':" + exception);
                }

                //#endregion

                //#region Show total costs...

                try
                {

                    if (chargingSession.costs != null)
                    {

                        var costsInfoDiv        = tableDiv.appendChild(document.createElement('div'));
                        costsInfoDiv.className  = "costsInfos";

                        var costsIconDiv        = costsInfoDiv.appendChild(document.createElement('div'));
                        costsIconDiv.className  = "icon";
                        costsIconDiv.innerHTML  = '<i class="fa-solid fa-euro-sign"></i>';

                        var textDiv             = costsInfoDiv.appendChild(document.createElement('div'));
                        textDiv.classList.add("text");

                        var costsDiv            = textDiv.appendChild(document.createElement('div'));
                        costsDiv.classList.add("costs");

                        if (chargingSession.costs.total != 0)
                        {

                            var totalCostsDiv      = costsDiv.appendChild(document.createElement('div'));
                            totalCostsDiv.classList.add("totalCosts");

                            var totalCostsCost     = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCost.classList.add("totalCost");
                            totalCostsCost.innerHTML     = chargingSession.costs.total.toString();

                            var totalCostsCurrency = totalCostsDiv.appendChild(document.createElement('div'));
                            totalCostsCurrency.classList.add("totalCostCurrency");
                            totalCostsCurrency.innerHTML = chargingSession.costs.currency;

                        }

                    }

                } catch (exception)
                {
                    console.log("Could not show costs of charging session '" + chargingSession["@id"] + "':" + exception);
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
                    markerColor:          'green',
                    iconColor:            '#c2ec8e'
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

            if (this.minlat == +1000 &&
                this.maxlat == -1000 &&
                this.minlng == +1000 &&
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
            headlineDiv.innerHTML   = "Ungültige Datensätze";

            let invalidDataSetsDiv  = this.invalidDataSetsScreenDiv.appendChild(document.createElement('div'));
            invalidDataSetsDiv.id   = "invalidDataSets";

            for (const invalidDataSet of CTR.invalidDataSets)
            {

                const result = invalidDataSet.result;

                if (chargyInterfaces.IsASessionCryptoResult(result))
                {

                    const invalidDataSetDiv = chargyLib.CreateDiv(invalidDataSetsDiv, "invalidDataSet");

                    const filenameDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(filenameDiv, "key",   "Dateiname");
                    chargyLib.CreateDiv(filenameDiv, "value", invalidDataSet.name);

                    const resultDiv = chargyLib.CreateDiv(invalidDataSetDiv, "row");
                    chargyLib.CreateDiv(resultDiv,   "key",   "Fehler");
                    const valueDiv  = chargyLib.CreateDiv(resultDiv, "value");

                    if (result.message)
                        valueDiv.innerHTML  = result.message;

                    else
                        switch (result.status)
                        {

                            case chargyInterfaces.SessionVerificationResult.InvalidSessionFormat:
                                valueDiv.innerHTML  = "Ungültiges Transparenzformat";
                                break;

                            default:
                                valueDiv.innerHTML  = result.status.toString();

                        }

                }

            }

        }

        //#endregion

    }

    //#endregion

    //#region showChargingSessionDetails

    private async showChargingSessionDetails(chargingSession: chargyInterfaces.IChargingSession)
    {

        try
        {

            this.detailedInfosDiv.innerHTML = "";

            if (chargingSession.measurements)
            {
                for (var measurement of chargingSession.measurements)
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
                            measurement.chargingSession.chargingStation.legalCompliance.conformity[0]?.freeText.length > 0)
                        {
                            chargyLib.CreateDiv2(chargingStationInfosDiv, "conformity",
                                                 this.chargy.GetLocalizedMessage("Conformity"),
                                                 measurement.chargingSession.chargingStation.legalCompliance.conformity[0].freeText);
                        }

                        if (measurement.chargingSession.chargingStation.legalCompliance &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration.length > 0 &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]?.freeText &&
                            measurement.chargingSession.chargingStation.legalCompliance.calibration[0]?.freeText.length > 0)
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

                    //#region Show charging costs and tariffs...

                    if (chargingSession.costs)
                    {

                        const costsAndTariffInfosDiv = chargyLib.CreateDiv(this.detailedInfosDiv,  "costsAndTariffInfos");
                                                       chargyLib.CreateDiv(costsAndTariffInfosDiv,  "headline2",
                                                                           this.chargy.GetLocalizedMessage("Costs and Tariffs"));

                        var costsTableDiv       = costsAndTariffInfosDiv.appendChild(document.createElement('div'));
                        costsTableDiv.classList.add("costsTable");

                        if (chargingSession.costs.reservation?.cost != null)
                        {

                            var reservationCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            reservationCostsRow.classList.add("costsRow");

                            var reservationCostsType     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsType.classList.add("type");
                            reservationCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Reservation");

                            var reservationCostsAmount   = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsAmount.classList.add("amount");
                            reservationCostsAmount.innerHTML  = chargingSession.costs.reservation.amount.toString();

                            var reservationCostsUnit     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsUnit.classList.add("unit");
                            reservationCostsUnit.innerHTML    = chargingSession.costs.reservation.unit;

                            var reservationCostsCost     = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCost.classList.add("cost");
                            reservationCostsCost.innerHTML   = chargingSession.costs.reservation.cost.toString();

                            var reservationCostsCurrency = reservationCostsRow.appendChild(document.createElement('div'));
                            reservationCostsCurrency.classList.add("currency");
                            reservationCostsCurrency.innerHTML   = chargingSession.costs.currency;

                        }

                        if (chargingSession.costs.energy?.cost != null)
                        {

                            var energyCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            energyCostsRow.classList.add("costsRow");

                            var energyCostsType     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsType.classList.add("type");
                            energyCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Energy");

                            var energyCostsAmount   = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsAmount.classList.add("amount");
                            energyCostsAmount.innerHTML  = chargingSession.costs.energy.amount.toString();

                            var energyCostsUnit     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsUnit.classList.add("unit");
                            energyCostsUnit.innerHTML    = chargingSession.costs.energy.unit;

                            var energyCostsCost     = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCost.classList.add("cost");
                            energyCostsCost.innerHTML   = chargingSession.costs.energy.cost.toString();

                            var energyCostsCurrency = energyCostsRow.appendChild(document.createElement('div'));
                            energyCostsCurrency.classList.add("currency");
                            energyCostsCurrency.innerHTML   = chargingSession.costs.currency;

                        }

                        if (chargingSession.costs.time?.cost != null)
                        {

                            var timeCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            timeCostsRow.classList.add("costsRow");

                            var timeCostsType     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsType.classList.add("type");
                            timeCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Time");

                            var timeCostsAmount   = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsAmount.classList.add("amount");
                            timeCostsAmount.innerHTML  = chargingSession.costs.time.amount.toString();

                            var timeCostsUnit     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsUnit.classList.add("unit");
                            timeCostsUnit.innerHTML    = chargingSession.costs.time.unit;

                            var timeCostsCost     = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCost.classList.add("cost");
                            timeCostsCost.innerHTML   = chargingSession.costs.time.cost.toString();

                            var timeCostsCurrency = timeCostsRow.appendChild(document.createElement('div'));
                            timeCostsCurrency.classList.add("currency");
                            timeCostsCurrency.innerHTML   = chargingSession.costs.currency;

                        }

                        if (chargingSession.costs.idle?.cost != null)
                        {

                            var idleCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            idleCostsRow.classList.add("costsRow");

                            var idleCostsType     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsType.classList.add("type");
                            idleCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Idle");

                            var idleCostsAmount   = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsAmount.classList.add("amount");
                            idleCostsAmount.innerHTML  = chargingSession.costs.idle.amount.toString();

                            var idleCostsUnit     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsUnit.classList.add("unit");
                            idleCostsUnit.innerHTML    = chargingSession.costs.idle.unit;

                            var idleCostsCost     = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCost.classList.add("cost");
                            idleCostsCost.innerHTML   = chargingSession.costs.idle.cost.toString();

                            var idleCostsCurrency = idleCostsRow.appendChild(document.createElement('div'));
                            idleCostsCurrency.classList.add("currency");
                            idleCostsCurrency.innerHTML   = chargingSession.costs.currency;

                        }

                        if (chargingSession.costs.flat?.cost != null)
                        {

                            var flatCostsRow      = costsTableDiv.appendChild(document.createElement('div'));
                            flatCostsRow.classList.add("costsRow");

                            var flatCostsType     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsType.classList.add("type");
                            flatCostsType.innerHTML    = this.chargy.GetLocalizedMessage("Flat");

                            var flatCostsAmount   = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsAmount.classList.add("amount");

                            var flatCostsUnit     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsUnit.classList.add("unit");

                            var flatCostsCost     = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCost.classList.add("cost");
                            flatCostsCost.innerHTML   = chargingSession.costs.flat.cost.toString();

                            var flatCostsCurrency = flatCostsRow.appendChild(document.createElement('div'));
                            flatCostsCurrency.classList.add("currency");
                            flatCostsCurrency.innerHTML   = chargingSession.costs.currency;

                        }

                    }

                    //#endregion

                    //#region Show measurement values...

                    if (measurement.values && measurement.values.length > 0)
                    {

                        let   measurementCounter    = 0;
                        let   previousValue         = new Decimal(0);

                        const measurementValuesDiv  = chargyLib.CreateDiv(this.detailedInfosDiv, "measurementValues");
                                                      chargyLib.CreateDiv(measurementValuesDiv, "headline2",
                                                                          this.chargy.GetLocalizedMessage("Meter Values"));

                        for (let measurementValue of measurement.values)
                        {

                            measurementCounter++;
                            measurementValue.measurement  = measurement;

                            const measurementValueDiv     = chargyLib.CreateDiv(measurementValuesDiv, "measurementValue");
                            measurementValueDiv.onclick   = (ev: MouseEvent) => {
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
                                currentValue = new Decimal(currentValue.toFixed(Math.abs(measurementValue.measurement.scale)));
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
                                                 : parseFloat((currentValue.minus(previousValue)).toFixed(Math.abs(measurementValue.measurement.scale))))
                                          : "0");

                            // Unit
                            if (measurementCounter <= 1)
                                chargyLib.CreateDiv(measurementValueDiv, "unit2",  "");
                            else
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
                                        else if (measurementValue.result                    &&
                                                 measurementValue.result.errors             &&
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

    //#region showMeasurementCryptoDetails

    private showMeasurementCryptoDetails(measurementValue:  chargyInterfaces.IMeasurementValue) : void
    {

        function doError(text: String)
        {
            errorDiv.innerHTML          = '<i class="fas fa-times-circle"></i> ' + text;
            introDiv.style.display      = "none";
        }

        //#region Headline

        const headlineDiv               = this.overlayDiv.querySelector('.headline')  as HTMLDivElement;
        const errorDiv                  = headlineDiv.    querySelector('.error')     as HTMLDivElement;
        const introDiv                  = headlineDiv.    querySelector('.intro')     as HTMLDivElement;
        errorDiv.innerHTML              = "";
        introDiv.style.display          = "block";

        //#endregion

        if (!measurementValue?.measurement ||
            !measurementValue.method)
        {
            doError(this.chargy.GetLocalizedMessage("Unknown meter data record format!"));
            return;
        }

        //#region Show data and result on overlay

        this.overlayDiv.style.display = 'block';

        const dataDiv                   = this.overlayDiv.querySelector('.data')                      as HTMLDivElement;
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

        const footerDiv                 = this.overlayDiv.querySelector('.footer')                    as HTMLDivElement;
        const signatureCheckDiv         = footerDiv.      querySelector('#signatureCheck')            as HTMLDivElement;

        signatureCheckDiv.innerHTML     = '';

        //#endregion

        measurementValue.method.ViewMeasurement(measurementValue,
                                                errorDiv,
                                                introDiv,

                                                cryptoDataDiv,
                                                bufferDiv,
                                                hashedBufferDiv,
                                                publicKeyDiv,
                                                signatureExpectedDiv,

                                                signatureCheckDiv);

    }

    //#endregion

}


// Remember to set the application file name for generating the application hash!
// Remember to set Content-Security-Policy for customer support URLs!
// Remember to set Customer Privacy Statement!
// Remember to set Customer Mapbox Access Token and MapId!

const app = new ChargyApp(
                "",
                "&copy; 2018-2024 GraphDefined GmbH",
                "https://chargy.charging.cloud/apps/web/versions",
                true, // Show Feedback Section
                ["support@charging.cloud", "?subject=Chargy%20WebApp%20Support"],
                undefined, //["+4993219319101",         "+49 9321 9319 101"],
                "https://chargy.charging.cloud/desktop/issues"
            );

// const app = new ChargyApp("https://chargepoint.charging.cloud/chargy/versions", //"https://raw.githubusercontent.com/OpenChargingCloud/ChargyDesktopApp/master/versions/versions.json",
//                           ["support.eu@chargepoint.com", "?subject=Chargy%20Supportanfrage"],
//                           ["+496995307383",              "+49 69 95307383"],
//                           "https://chargepoint.charging.cloud/chargy/issues");
