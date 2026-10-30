# Plan: WWCP POI, Trust Anchors und nachweisbare Ladetarife

Stand: 30. Oktober 2026. Untersucht: veröffentlichtes npm-Paket
`@open-charging-cloud/wwcp-poi@0.1.0`, ChargyCore `0.17.0` und die aktuelle WebApp.
Das npm-Paket ist hinzugefügt und im Lockfile festgeschrieben. Die folgenden
Abschnitte planen die Integration; Scanner, Speicherung und Verifikation sind
damit noch nicht implementiert.

## 1. Ausgangspunkt und Leitentscheidungen

Die Bibliothek bringt die kryptografischen Bausteine bereits mit:

| Aufgabe | Vorhandene API |
| --- | --- |
| Trust Anchor aus QR-Text, URL oder JSON lesen | `TrustAnchor.parse`, `TrustAnchor.fromJSON` |
| Schlüsselaussage mit gepinnten Schlüsselinhabern und Quorum prüfen | `KeyStatement.verifyHolders` |
| Kleine Stationsnachweise einschließlich Zähler und Tarife prüfen | `verifyChargingStation` |
| Signierte Preisstände gegen die validierte Station prüfen | `verifyPriceStatements` |
| Station und Preise herunterladen und prüfen | `POIClient.chargingStation` |
| Stationsversion und Preisstand in Checkpoints nachweisen | `CheckpointProof`, `PriceStatementProof` |
| Sitzungsbelege einschließlich Zeugen prüfen | `parseEvidence`, `verifyEvidence` |

Die App ergänzt Herkunftsentscheidung, Downloadregeln, Persistenz, Zuordnung
zum Ladevorgang und Darstellung. Kanonisierung, Merkle-Bäume und
Signaturverfahren werden nicht nochmals implementiert.

**Vier Aussagen bleiben getrennt:** Messwertsignatur korrekt;
Zählerschlüssel der Station zugeordnet; Tarif/Preis für den Ladevorgang
zugeordnet und signiert; Veröffentlichung durch Checkpoint und gegebenenfalls
unabhängige Zeugen belegt. Ein grüner Messwerthaken beweist die anderen drei
Aussagen nicht.

**Vertrauenswurzel:** Ein neu gescannter Anchor kann sich nicht selbst als
vertrauenswürdig beweisen. Er legt das Vertrauen fest. Seine Schlüssel-IDs,
deren Gruppierung nach Inhabern und das Quorum müssen aus einer vom Nutzer
akzeptierten Quelle stammen. Ein Aufkleber an einer Station genügt nicht als
Beweis für die Identität des Herausgebers. Ein bestätigter Netzwerkzugriff
aus der bisherigen Live-Link-Verwaltung ist ebenfalls kein Schlüsselvertrauen.

## 2. Trust Anchor scannen, laden und speichern

### 2.1 Gemeinsamer Importweg

Den bestehenden Scanner in `src/ts/chargyApp.ts` um einen vorgeschalteten,
eigenständigen Import-Router ergänzen. Derselbe Router verarbeitet eingefügten
Text, Dateien, QR-Bilder und Deep Links, damit nicht nur der Kameraweg
Trust Anchors versteht. Die QR-Bilddecodierung in ChargyCore muss dafür
gegebenenfalls einen gemeinsamen Übergabepunkt für decodierten Text erhalten.

Erkennungsreihenfolge:

1. `WWCP/TA-2:`: kompakter Anchor, Base45/CBOR; mit `TrustAnchor.parse` lesen.
2. URL mit Anchor-Parametern `keys`, optional `minConsensus` und `alsoAt`:
   ebenfalls `TrustAnchor.parse`. Die Parameter enthalten die Pins; zum Laden
   von Nachweisen nur die daraus gewonnenen Basis-URLs verwenden.
3. JSON mit passendem `TRUST_ANCHOR_CONTEXT`: mit `parseJSON` und
   `TrustAnchor.fromJSON` lesen; auch die spezifizierte `/trustAnchor`-
   Antwort mit eingebettetem `trustAnchor` gezielt unterstützen.
4. Expliziter Link auf ein Anchor-Dokument: begrenzt herunterladen und danach
   klassifizieren. Ohne unabhängig übermittelte Pins bleibt dies ein Vorschlag
   aus dieser Quelle, der eine bewusste Vertrauensentscheidung erfordert.
5. Sonstige Eingaben durchlaufen den bestehenden Transparenzdatenimport.
   Fehlerhaft erkannte Anchor-Eingaben bleiben im Anchor-Fehlerdialog und
   werden nicht stillschweigend zu normalen Browserlinks.

Nicht jede HTTPS-URL automatisch als Anchor behandeln. Ein Aufruf des
spezifizierten `GET {networkBase}/trustAnchor` darf vorhandene Pins niemals
durch die vom Server gelieferten ersetzen.

### 2.2 Importdialog und erste Onlineprüfung

Vorgeschlagener Ablauf: **Erkannt → Daten laden → Schlüssel prüfen → Vertrauen
bestätigen → lokal speichern**. Abbrechen beendet Kamera und Requests;
späte Antworten dürfen keinen inzwischen gewechselten Bildschirm ersetzen.

Die Vorschau zeigt Netzwerk-ID, Herkunft/Domain, Schlüsselinhaber und Quorum,
einen vergleichbaren Fingerprint sowie abrufbare Quellen. Ein Name aus dem
QR-Code wird zunächst als übernommene Bezeichnung markiert.

Für die erste Onlineprüfung `GET {networkBase}/keyStatement` laden,
`KeyStatement.parse` und `verifyHolders(anchor.holders, …,
{ minConsensus: anchor.minConsensus, at })` verwenden und die Netzwerk-ID
explizit mit dem Anchor vergleichen. Schlüsselmaterial muss zu seinen
Thumbprints passen; Inhaberzählung und Quorum dürfen nicht vom Download
umdefiniert werden. Falls das Statement benötigtes Schlüsselmaterial nicht
mitliefert, folgt die Prüfung mit einem Stationsproof, sobald eine EVSE
gewählt ist; kein Vollsnapshot als Bootstrap-Ersatz.

Ergebnis dieses Schritts: „Schlüsselaussage gegen diesen Anchor geprüft“.
Das bestätigt weder die Herkunft des frisch importierten Anchors noch bereits
eine Station. Netzwerkname und Beschreibung werden erst nach einem
validierten Stationsproof als verifiziert bezeichnet; Abweichungen zum
QR-Namen sichtbar machen.

Aktionen: **„Diesem Trust Anchor vertrauen und speichern“**, **„Abbrechen“**
und Fingerprint-Details. Das ist eine Produktentscheidung über dauerhaftes
Vertrauen. Ein Offlineimport kann als „ungeprüfter Entwurf“ gespeichert
werden, wird aber noch nicht für automatische Schlüsselzuordnung aktiviert.
Fehlgeschlagene Signaturen erlauben keine Aktivierung als geprüft.

### 2.3 Downloads

Die Regeln aus `deepLinks.ts`, `liveLinkTrust.ts` und `liveLinkPolling.ts`
wiederverwenden: HTTPS im Produktivbetrieb, erlaubte Ziele, begrenzte
Antwortgröße beim Stream-Lesen, Timeout, Abbruch und keine ungeprüften
Redirects. CORS muss der CPO/RNO-Server für die WebApp zulassen. Credentials
nicht unbemerkt an fremde Quellen senden. Mirrors unter denselben Pins prüfen.

`POIClient` hat einen injizierbaren `fetch`, aber selbst keine entsprechende
Downloadbegrenzung. Seine Nutzung muss daher über einen App-Adapter erfolgen.
Für die Oberfläche sind getrennte Abrufe mit `verifyChargingStation` und
`verifyPriceStatements` zweckmäßig: Ein fehlender Tarif darf eine korrekt
validierte Station nicht unsichtbar machen. Wiederholte Fehler von Mirrors
werden unterscheidbar protokolliert: Netzwerkfehler und ungültiger Proof.

JSON als Originaltext/Bytes aufbewahren und mit `parseJSON` beziehungsweise
`parseJSONBytes` lesen. Kein `response.json()` oder JSON-Roundtrip für
signierte POI-Dokumente: Dezimaldarstellung und doppelte Property-Namen sind
für die Validierung relevant.

### 2.4 Dauerhafte lokale Verwaltung

IndexedDB mit versioniertem Schema vorsehen; `localStorage` bleibt für kleine
UI-Einstellungen. Geplante Stores:

| Store | Inhalt |
| --- | --- |
| `trustAnchors` | Originaldarstellung, Pins je Inhaber, Quorum, Netzwerk-ID, Quellen, Importherkunft, Bestätigung und Aktivierungsstatus |
| `poiDocuments` | Originalbytes von Statements/Proofs, Abrufzeit, Quelle, Dokument-ID, Gültigkeit und Bezug auf den Anchor |
| `sessionEvidence` | Sitzungsbezug, EVSE, Zähler, Prüfzeit/Ladebeginn, Anchor-Version, ausgewählte Dokumente und spätere Checkpointnachweise |
| `knownHeads` | Bereits gesehene Preis-Sequenzen/Digests sowie Checkpoint-/Epochenstände zur Erkennung von Rückschritten und Widersprüchen |

Gleiche Netzwerk-ID mit anderen Pins nicht überschreiben. Anker-Versionen
nach kryptografischem Inhalt unterscheiden; erlaubte Endpunktänderungen
gesondert behandeln. Änderungen an Schlüsseln, Inhabergruppen oder Quorum
verlangen nachgewiesene Nachfolge oder einen erneuten bewussten Import.
`OperatorTrust.followedBy` ist an eine korrekt verfolgte Versionsgeschichte
gebunden; ein beliebiger neuer Anchor vom Server ist keine Rotation.

Unter **Einstellungen → Trust Anchors**: anzeigen, hinzufügen, aktualisieren,
deaktivieren, entfernen, exportieren/importieren. Herkunft, letzte erfolgreiche
Prüfung und Zustand zeigen. Entfernen beendet künftige automatische Nutzung;
zu Sitzungsbelegen gehörende alte Pins und Dokumente werden nicht stillschweigend
gelöscht. Historische Ergebnisse zeigen den damals geltenden Vertrauensstand.

Browserdaten können gelöscht oder verdrängt werden. Speicherfehler und
Quota-Überschreitungen müssen sichtbar sein; optional `navigator.storage.persist()`
anfragen und einen Belegexport anbieten. Nach Neustart erneut prüfen statt
einen gespeicherten grünen Status ungeprüft zu übernehmen.

## 3. Datenvertrag mit CPO, EMP und Roamingnetz

### 3.1 Für eine konkrete Station

Die App braucht einen bereits akzeptierten Anchor und mindestens eine
eindeutige `EVSEId` oder `chargingStationId`, etwa aus einem Live Link,
Transparenzdatensatz oder Stations-QR-Code. Ein Anchor allein benennt keine
Station. Eine ID aus dem Import ist zunächst eine Suchanfrage; der Proof muss
genau zu ihr passen. Bei fehlender oder mehrdeutiger ID gezielt nach Auswahl
fragen, keine vollständige Stationsliste herunterladen.

| Benötigte Daten | Abruf bzw. Inhalt |
| --- | --- |
| Stationsnachweis | `GET {base}/EVSEs/{id}/proof`, alternativ `/CSs/{id}/proof` |
| Veröffentlichter Stationsstand | `hashAlgorithm`, `commitId`, `revision`, beschnittener `roamingNetwork`-Baum und Root-Attestierungen |
| Vertrauenskette | RNO-KeyStatement, zertifizierte Signing Keys, genügend gültige Root-Attestierungen verschiedener gepinnter Inhaber |
| Stationskontext | CPO und Pool als Skeletons, vollständige effektive Station/EVSEs, referenzierte Tarife, Zähler und deren Schlüssel; referenzierte Modelle/Zertifikate soweit vorhanden |
| Inclusion-Daten | Merkle-Wurzeln ausgeblendeter Teilbäume bzw. relevante Blätter mit Index, Größe und Audit-Pfad |
| Sitzungsbezug | EVSE, Zähleridentität, Ladebeginn und Originalmesswerte; soweit im Messformat vorhanden gegen signierte Identitätsfelder abgleichen |

`verifyChargingStation(anchor, proof, { evseId, at })` rekonstruiert die
Root und prüft die Attestierungen. Es werden nur die Station und ihre
Abhängigkeiten übertragen; ausgeblendete Bereiche bleiben Hashes. Die
Übertragungsgröße hängt zusätzlich von Station, Tarifen und Schlüsseln ab,
nicht nur von der logarithmischen Länge der Audit-Pfade.

Wichtig für die Beschriftung: Dieser Prüfpfad validiert die RNO-Attestierung
des Stationsstandes. Er spielt nicht die komplette Historie aller vom CPO
signierten Änderungen nach. Eine separat geprüfte CPO-Signatur wird nur
behauptet, wenn sie tatsächlich als zusätzlicher Nachweis vorliegt.

### 3.2 Für Tarif und aktuellen Ad-hoc-Preis

Statische Tarifdefinitionen und ihre Zuordnung zur EVSE gehören zum
Stationsproof. Für dynamische Ad-hoc-Preise kommen die signierten
`PriceStatement`-Dokumente aus
`GET {base}/EVSEs/{id}/priceStatements` hinzu; die Antwort enthält die
Preisstände von Pool, Station und EVSE.

Erwartet werden die Bibliotheksfelder `roamingNetworkId`, `entityType`,
`entityId`, `priceStatus.prices` mit `chargingTariffId` und `elements`,
`validFrom`, gegebenenfalls `validUntil`, `sequence`, `previous`, `after`
sowie `role`, `signer`, `signedAt`, `algorithm`, `keyId`, `value` und der
entsprechende Kontext. Kein zusätzlicher, selbst erfundener Signaturcontainer.

Prüfen: zuständiger CPO, dafür erlaubter Signing Key (`priceStatements`),
Signatur und Schlüsselgültigkeit, Netzwerk-/Entitätsbezug, zur EVSE gehöriger
Tarif und Gültigkeit bei Ladebeginn. Verkettung und Widersprüche mit bereits
lokal bekannten Statements vergleichen. Die Bibliothek akzeptiert Lücken
zwischen gelieferten Sequenzen; daraus darf die App keine Vollständigkeit
oder garantierte Aktualität ableiten. Ein leeres Ergebnis ist kein geprüfter
Preis. Unsigned Runtime-Preisstatus ist ebenfalls kein Preisnachweis.

Die Bibliothek liefert Pool-, Stations- und EVSE-Preisstände getrennt. Ein
fachlicher Preisresolver muss die verbindliche Auswahl und Überschreibung
von Tarifelementen festlegen und mit Vektoren belegen. Bei mehrdeutiger
Anwendbarkeit keinen Endpreis als geprüft ausgeben. Abgerechneten bzw. im
OCMF eingebetteten Tarif gegen die tatsächlich gewählte veröffentlichte
Tarifversion und ihre Konditionen vergleichen, nicht nur gegen dieselbe ID.

### 3.3 Veröffentlichungsbeleg und spätere Beweisführung

Für „Veröffentlichung belegt“ reicht die korrekte CPO-Signatur allein nicht.
Zusätzlich nachladen und mit den Originaldokumenten der Sitzung verbinden:

1. Commit-InclusionProof der Stationsversion:
   `GET {base}/history/commits/{commitId}/proof`.
2. Den einschließenden Checkpoint und seine Signaturen.
3. Für jeden tatsächlich verwendeten Preisstand seinen `PriceStatementProof`:
   `GET {base}/history/checkpoints/{checkpointId}/priceStatements/{digest}/proof`.
4. Den gegebenenfalls über `after` referenzierten früheren Checkpoint und die
   nötige zusammenhängende Checkpointlinie.
5. Unabhängig konfigurierte Zeugen und deren Schlüssel mit einer expliziten
   Mindestzahl. Zeugen aus dem gerade geprüften CPO-Dokument übernehmen
   begründet kein unabhängiges Vertrauen.

`verifyEvidence` anschließend mit den vertrauenswürdigen Zeugen aufrufen.
Die App muss zusätzlich die Vollständigkeit für ihre Aussage prüfen:
`versionCheckpoint` vorhanden, für alle verwendeten Preis-Digests ein
Eintrag in `statementCheckpoints`, erforderliche Zeugen gezählt. Ein bloß
erfolgreicher Aufruf ohne optionale Belege genügt dafür nicht. Auch den im
Evidence-Dokument enthaltenen Anchor mit dem lokal akzeptierten Anchor
abgleichen: ein importiertes Belegpaket darf sein eigenes Vertrauen nicht
mitbringen. Die Default-Anzahl erforderlicher Zeugen nicht ungeprüft verwenden.

Ein frischer Preis kann vor dem nächsten Checkpoint verfügbar sein. UX dann:
„Preis signiert und zugeordnet; Veröffentlichungsbeleg ausstehend“.
Belege später begrenzt nachladen, solange die App läuft, und nach erneutem
Öffnen fortsetzen. Ein geschlossener Browser garantiert keine Hintergrundjobs.
Der Nachweis belegt Aufnahme und zeitliche Einordnung in der betrachteten
Historie. Er beweist allein weder weltweite Sichtbarkeit noch, dass es keine
anderen Ansichten gibt. Bekannte Checkpoints, unabhängige Zeugen und der
Abgleich mehrerer Quellen helfen bei der Erkennung solcher Widersprüche.

### 3.4 EMP-/Vertragstarife sind ein eigener Integrationsschritt

Der App-Verifier in Version `0.1.0` prüft PriceStatements des
`chargingStationOperator`; er ist kein generischer EMP-Angebotsverifier.
EMP-Signaturen deshalb nicht als CPO-Statements umetikettieren.

Für einen Vertragstarif werden zusätzlich ein geprüftes EMP-Schlüsselverhältnis,
das konkrete Angebot bzw. die Vertragsversion, ihre Bindung an Kunde/Vertrag,
EVSE und Zeitpunkt sowie der passende Publikations- oder Annahmenachweis
benötigt. Das Format und der Verifier dafür sind mit Bibliothek und Anbieter
abzustimmen. Bis dahin „EMP-Tarif nicht unterstützt/nicht nachgewiesen“
anzeigen; daraus keine Aussage über den öffentlichen Ad-hoc-Tarif ableiten.

## 4. Geprüfte Zählerschlüssel an ChargyCore übergeben

`VerifiedChargingStation.energyMeters` liefert die Zähler und deren
Public Keys; eine selbst signierende Station kann eigene Messschlüssel
haben. Diese sind von RNO-Identity Keys und CPO-Preisschlüsseln getrennt.

Geplanter App-Adapter `poiMeterKeys.ts`:

1. Nur Schlüssel aus einem erfolgreich verifizierten Stationsproof auswählen.
2. Zugehörigkeit zu EVSE und Zähler, Schlüssel-ID/Algorithmus und zeitlichen
   Kontext prüfen. Keine globale Liste, aus der irgendein passender Schlüssel
   per erfolgreicher Signaturprüfung ausgewählt wird.
3. POI-Zählerschlüssel (`key` als DER-SPKI, `@id` als SHA-256) in das passende
   ChargyCore-Format konvertieren und auf exakte Identität mit eventuell im
   Datensatz mitgelieferten Schlüsseln prüfen. Konflikte sichtbar machen.
4. Schlüssel, Herkunft und Proof-Bezug sitzungsbezogen bereitstellen; erneute
   kryptografische Messwertprüfung mit genau diesem Kontext auslösen.

ChargyCore `0.17.0` hat bereits explizite Schlüsselparameter bei
`OCMF.TryToParseOCMFDocument(s)` sowie Public-Key-Import. Ein OCMF-Prototyp
kann darüber arbeiten. Ein allgemeiner Resolver mit Herkunft, EVSE/Zähler,
Zeitbezug und Konfliktergebnis fehlt im öffentlichen `Chargy`-Konstruktor.

Für den durchgängigen Weg eine additive ChargyCore-API planen, etwa
`resolveMeterPublicKeys(context)` mit nachgewiesenen Kandidaten und Provenienz;
der Name ist ein Vorschlag. Parsing/Identitätsermittlung, asynchrone Auflösung
und Verifikation müssen klar getrennt sein. Original-Live-Link oder signierten
Container nicht umschreiben, um Schlüssel hineinzuschieben: das verändert den
Signaturgegenstand. Der App-Nachweis gehört in eine getrennte Ergebnisstruktur.
Die Core-Erweiterung benötigt eine eigene Veröffentlichung vor der Nutzung
in allen Importformaten.

## 5. UX mit schrittweise aufklappbaren Details

Die vorhandenen Messwertdetails (`showMeasurementCryptoDetails`) und der
PKI-Dialog bleiben das Vorbild. Die Tarifdetailfunktion
`showChargingTariffDetails` ist derzeit noch ein Platzhalter und wird zum
fachlichen Einstieg für Tarife und deren Nachweise ausgebaut.

### Ebene 1: Ladevorgang / Live Link

Unter dem bestehenden Messergebnis eine kompakte Prüfkarte:

```text
Nachweise für diesen Ladevorgang                       Details ›
✓ Messwerte                 Signaturen gültig
✓ Station und Zählerschlüssel  Im vertrauten Netz nachgewiesen
✓ Tarif und Preis           Für den Ladebeginn zugeordnet
◷ Veröffentlichung          Checkpointbeleg wird noch erwartet
```

Jede Zeile zeigt einen eigenen Status und öffnet passende Details.
Kein pauschales „Alles geprüft“, solange ein angeforderter Nachweis fehlt.
Ohne POI-Daten bleiben Messwertprüfung und bisherige Importwege verwendbar.
Ein beschädigter Stationsproof entwertet die Stations-/Schlüsselzuordnung,
aber ändert nicht rückwirkend eine mathematisch gültige Messwertsignatur.

Zustände nicht allein farblich vermitteln: Symbol und Text für **geprüft**,
**fehlt/ausstehend**, **abgelaufen**, **widersprüchlich/ungültig**,
**nicht unterstützt** und **Prüfung läuft**. „Kein Nachweis“ unterscheidet
sich von „Nachweis falsch“. Historische Prüfung ausdrücklich mit „zum
Ladebeginn“ und Prüfzeit beschriften; alte Attestierungen nicht als aktuell
gültig darstellen. Ein späterer Widerruf soll zusätzlich sichtbar sein,
ohne frühere zeitlich belegte Ergebnisse stillschweigend umzudeuten.

### Ebene 2: Fachliche Details

- **Station:** CPO, Standort, EVSE, Zähler/Seriennummer, zugeordneter Schlüssel,
  vertrautes Netz, Datenstand und Prüfergebnis. Ergänzend Hersteller, Modell,
  Firmware, Zertifikate und Transparenzsoftware, soweit nachgewiesen.
- **Tarif:** Ad-hoc oder Vertrag, Herausgeber, Version/Digest, Geltungszeit,
  Währung, Steuerbezug, kWh-/Zeit-/Startkosten und Einschränkungen. Zeigen,
  welcher Preisstand welche Definition ersetzt und ob die Abrechnung damit
  übereinstimmt. Fehlende oder unklare Konditionen ausdrücklich benennen.
- **Veröffentlichung:** Datum, Checkpoint, bezeugende Stellen und noch fehlende
  Belege. Aktionen „Erneut prüfen“ und „Beleg exportieren“.
- **Vertrauen:** verwendeter Anchor, Importquelle, Bestätigung und Quorum;
  Link zur Verwaltung, ohne den Ladevorgang aus dem Blick zu verlieren.

### Ebene 3: Kryptografischer Prüferpfad

Aufklappbare Kette mit einzelnem Ergebnis pro Schritt:

```text
Akzeptierter Trust Anchor
  → KeyStatement / gepinnte Inhaber / Quorum
  → zertifizierte RNO-Signing Keys / Root-Attestierungen
  → effectiveTree / Audit-Pfade / Stationsstand
  → EVSE / Zähler / Messschlüssel → Messwertsignatur
  → CPO-Key / Tarifzuordnung → PriceStatement
  → Commit- und Preis-InclusionProof → Checkpoint / Zeugen
```

Pro Knoten optional Algorithmus, Fingerprint, signierte Bytes/Hash,
Signatur, Index/Größe/Audit-Pfad, Gültigkeit, Quelle und Fehlergrund.
Ein Rohdatenexport ermöglicht unabhängige Nachprüfung. Lange Werte zunächst
kürzen, vollständig aufklappbar und kopierbar machen. Tastaturbedienung,
Fokusführung, Bildschirmleser und deutsche/englische Texte von Anfang an
einplanen. Mobil werden diese Details nacheinander geöffnet, nicht in einer
breiten dauerhaft sichtbaren Baumansicht.

## 6. Umsetzung in überprüfbaren Schritten

| Schritt | Umfang | Abnahme |
| --- | --- | --- |
| 0 – erledigt | Paket und Lockfile, aktualisierte SBOM | Bestehende Projektprüfung läuft mit der neuen Abhängigkeit |
| 1 | Gemeinsamer Import-Router, Anchor-Vorschau, begrenzte Downloads, IndexedDB und Verwaltungsansicht | QR/URL/Datei führen zum selben gespeicherten Anchor; Neustart, Offline-Entwurf und Fehler funktionieren |
| 2 | Stationsproof je EVSE, eigener Verifikationsstatus und Zählerschlüsseladapter; OCMF-Pilot und Core-API | Richtige EVSE/Zählerbindung; fremder Schlüssel oder manipulierter Proof erzeugt keinen Vertrauensstatus |
| 3 | Tarifzuordnung, PriceStatements, fachliche Tarifdetails | Fehlende, abgelaufene, fremde und widersprüchliche Preisstände werden korrekt unterschieden |
| 4 | Checkpoint-Nachladen, Zeugenrichtlinie, Belegspeicherung und Export/Import | Historische Offlineprüfung mit vollständigem Inclusion-Nachweis; fehlende Belege bleiben sichtbar |
| 5 | Weitere Core-Formate und abgestimmter EMP-Angebotsverifier | Gleiche Vertrauens- und Zuordnungsregeln für unterstützte Formate und Vertragsfälle |

Geplante neue Module unter `src/ts`: `poiImport.ts`, `poiTransport.ts`,
`poiStore.ts`, `poiVerification.ts`, `poiMeterKeys.ts`, `poiEvidence.ts`
und `poiViews.ts`. `chargyApp.ts` koordiniert nur; gemeinsame
Ergebnisdaten referenzieren Originalbelege. Krypto-/JSON-Daten nicht als
gewöhnliche UI-Objekte serialisieren. Rechenintensive Verifikation bei
Bedarf in einen Worker auslagern und das Paket erst im POI-Pfad laden.

Gezielte Tests bei der Umsetzung: manipulierte Audit-Pfade; falsche
EVSE/Zähler; gleiche Schlüsselinhaber mehrfach; Quorum-Absenkung; ungültige
Signaturen; Schlüsselwechsel; Dezimaldarstellung; leere Preislisten;
Sequenz-Rollback und Split View; abgelaufene Attestierungen; fehlende
Checkpointbelege trotz erfolgreichem `verifyEvidence`; vom Beleg selbst
mitgelieferter fremder Anchor; unzulässige Mirrors/Redirects; CORS,
Downloadlimits und Abbruch; Persistenz nach Neustart. Geeignete öffentliche
POI-Vektoren mit Herkunft und Prüfuhr übernehmen. UX zusätzlich auf Mobil,
mit Tastatur und beim Wechsel des Ladevorgangs während laufender Prüfung
testen.

Vor Schritt 3 fachlich festzulegen: Auswahlregeln bei mehreren anwendbaren
Tarifen und Pool-/Stations-/EVSE-Preisständen. Vor Schritt 4: vertrauenswürdige
Zeugen, deren Mindestzahl und Nachladefrist. Vor Schritt 5: konkretes
EMP-Angebotsformat und dessen Vertragsbindung. Die vorherigen Schritte sind
unabhängig davon ausführbar.

## Quellen und konkrete Einstiegspunkte

- [WWCP POI TS: Bibliothek, APIs und bekannte Grenzen](https://github.com/OpenChargingCloud/WWCP_POI.TS#readme)
- [WWCP POI Spezifikation: Stationsproofs, Abschnitte 8.4–8.6](https://github.com/OpenChargingCloud/WWCP_POI/blob/master/SPECIFICATION.md#84-proofs)
- [WWCP POI Spezifikation: Preise und Veröffentlichung, Abschnitt 12](https://github.com/OpenChargingCloud/WWCP_POI/blob/master/SPECIFICATION.md#12-prices-at-runtime)
- Installierte Typen: `node_modules/@open-charging-cloud/wwcp-poi/dist/{client,proofs/trustAnchor,verifier/chargingStation,verifier/evidence}.d.ts`.
- WebApp: `handleScannedQRCodeText`, `detectAndConvertContentFormat`,
  `showChargingSessionDetails`, `showChargingTariffDetails`,
  `showMeasurementCryptoDetails` in `src/ts/chargyApp.ts`;
  Layout in `src/index.html`, Texte in `src/i18n.json`.
- ChargyCore: öffentliche Typen `dist/chargy.d.ts`, `dist/OCMF.d.ts` und
  `dist/interfaces/IPublicKeyInfo.d.ts` des installierten Pakets.

## Prüfung der Paketaufnahme

`npm run verify` erfolgreich: App- und Test-Typprüfung, ESLint, 373 bestandene
Tests bei drei übersprungenen Tests sowie Produktionsbuild einschließlich
aktualisierter SBOM. Der Build meldet drei Größen-/Performancewarnungen.

Zusätzlich das installierte npm-Paket direkt mit den öffentlichen Vektoren
`csharp-33447ac` des benachbarten Bibliotheks-Checkouts geprüft: ML-DSA-Anchor,
Station `DE*GEF*S1`, zwei Zähler und Preisstand der EVSE `DE*GEF*E1*1`
erfolgreich validiert; fremde EVSE und manipulierter Stationsproof abgewiesen.
Dies prüft die veröffentlichte API mit echten Belegen, noch keine App-Integration.
