# Trust Management

Die Konfiguration enthält **Trust Management** mit den Unterseiten
**Roamingnetze**, **Trust Anchors** und **Mitgelieferte Public Keys**. Der Zurück-Button führt
jeweils eine Ebene zurück. Die bisherigen Einstellungen für Live-Datenserver
bleiben eine eigene Konfigurationsseite.

## Import und Verwerfen

Nach einem Trust-Anchor-Scan bietet die Vorschau **Import** und **Verwerfen**.
Ein strukturell gültiger Anchor ist auch ohne Signaturen, bei unbekannten
Unterzeichnern oder unvollständigem Vertrauen importierbar. Speichern erteilt
keinem zusätzlichen Schlüssel Vertrauen und ändert keinen der drei Prüfstatus.

Nach erfolgreicher Speicherung zeigt die Vorschau **Bereits importiert** und
**Schließen**. Ein bereits vorhandener Anchor wird nicht überschrieben.
**Verwerfen** und der Zurück-Pfeil schließen eine ungespeicherte Vorschau,
ohne den Anchor zu importieren. Speicherfehler bleiben in der Vorschau
sichtbar; ein fehlgeschlagener Schreibvorgang wird nicht als Erfolg angezeigt.

Die Duplikatkennung ist ein SHA-256-Hash von Netzwerk-ID, nach Inhabern
gruppierten Schlüssel-IDs, Quorum und normalisierten Datenquellen. Ein
anderer Anzeigename oder die URL- statt der kompakten QR-Darstellung erzeugt
keine zweite Kopie. Andere Schlüssel, Quoren oder Datenquellen bleiben
getrennte Einträge und überschreiben keinen vorhandenen Anchor.

## Lokaler Speicher

Die App verwendet IndexedDB **`ChargyTrustManagement`**, Schema-Version **1**:

| Object Store | Schlüssel / Inhalt |
| --- | --- |
| `trustAnchors` | `id`: Duplikatkennung; `qrCode`: vollständiger kanonischer Anchor; `sourceText`: ursprünglicher Scantext; `importedAt`: UTC-Importzeit |
| `deletedBundledKeys` | `id`: Thumbprint eines für diese Installation entfernten mitgelieferten Keys |

Duplikatprüfung und Import laufen in einer gemeinsamen Schreibtransaktion.
Auch zwei gleichzeitig importierende Tabs erzeugen dadurch nur einen Eintrag.
Gespeicherte Anchor-Inhalte werden beim Lesen erneut geparst und gegen ihre
Kennung geprüft. Es wird kein gespeicherter grüner Prüfstatus übernommen.

Die Daten bleiben bei Reloads und Browser-Neustarts erhalten, gelten aber
für das jeweilige Browserprofil und die Herkunft der WebApp. Das Löschen
der Browserdaten entfernt auch die Imports und lokalen Key-Ausschlüsse.

## Verwaltung und Löschen

**Roamingnetze** fasst gespeicherte Trust Anchors nach ihrer Netzwerk-ID
zusammen. Ein Klick öffnet **Details und Vertrauen**. Dort stehen die
Netzwerk-ID, der Anzeigename aus dem Anchor, die zugehörigen Datenquellen
und die einzelnen Vertrauenskonfigurationen mit Schlüsselinhabern und Quorum.
Unterschiedliche Anchors desselben Netzes werden nicht zu einer gemeinsamen
Schlüsselliste oder einem gemeinsamen Quorum verschmolzen.

Ein **KeyStatement** gehört zum Roamingnetzbetreiber in einem bestimmten
Roamingnetz: Es benennt `roamingNetworkId`, `roamingNetworkOperatorId`, die
Identitätsschlüssel, das Quorum, Gültigkeitszeiten und Signaturen. Der aktuelle
lokale Import hat noch kein KeyStatement geladen. Die Netzansicht zeigt das
ausdrücklich und lässt dessen drei Prüfstatus auf „Nicht prüfbar“. Sie lädt
keine Daten automatisch nach und bezeichnet Namen aus Anchors nicht als
authentifizierte Betreiberangaben.

Für jede Schlüssel-ID wird separat angezeigt, ob sie in der mitgelieferten
Vertrauensliste steht, lokal gelöscht wurde, unbekannt ist oder außerhalb
ihrer zeitlichen Gültigkeit liegt. Diese Zuordnung wird aus der aktuellen
Key-Konfiguration berechnet; sie beweist noch keine Signatur eines
KeyStatements und kein erfülltes Quorum.

**Roamingnetz löschen** entfernt alle lokal gespeicherten Trust Anchors der
gewählten Netzwerk-ID in einer gemeinsamen IndexedDB-Transaktion. Andere
Roamingnetze sowie mitgelieferte Public Keys und deren lokale Ausschlüsse
bleiben erhalten. Die Netzliste wird direkt aus den gespeicherten Anchors
gebildet; deshalb ist keine zusätzliche Datenbankmigration nötig. Nach dem
Löschen des letzten Anchors eines Netzes verschwindet es auch aus der Liste.

**Trust Anchors** listet die Imports mit Netzwerk, Importzeit, Datenquellen,
Quorum und Schlüssel-IDs. **Trust Anchor löschen** entfernt nur den gewählten
Import. Derselbe Anchor kann anschließend erneut importiert werden.

**Mitgelieferte Public Keys** zeigt die beim Build eingebetteten Keys.
**Key löschen** speichert einen lokalen Ausschluss anhand des Thumbprints:
Der Key wird in dieser Installation nicht mehr als vertrauenswürdig
bereitgestellt. Sein unveränderlicher ursprünglicher Inhalt bleibt im
App-Bundle enthalten und wird in der Verwaltung als gelöscht angezeigt.
**Key wiederherstellen** entfernt diesen Ausschluss wieder.

Die Ausschlüsse werden nicht automatisch bei einem App-Update aufgehoben.
Die Entfernung eines Keys löscht keinen gespeicherten Trust Anchor. Sie
verändert die verfügbare Vertrauensbasis für dessen nachfolgende Prüfungen.

Code, der tatsächlich Vertrauen prüft, muss
`getActiveBundledTrustedPublicKeys(store)` verwenden. Die rohe Liste
`bundledTrustedPublicKeys` dient der Verwaltung der ursprünglichen Keys.
Bei einem Speicherfehler wird nicht auf diese ungefilterte Liste zurückgefallen.

Implementierung: `src/ts/trustStore.ts`, `src/ts/trustManagement.ts`, `src/ts/roamingNetworks.ts`,
`src/ts/trustAnchorPreview.ts`. Die Build-Liste und ihr Format sind unter
[`src/trust/README.md`](../src/trust/README.md) dokumentiert.
