# Gleis & Gasse 0.2.0 – Freie Trassen

Offline-Singleplayer-Prototyp für Android und Browser. Das GitHub-Repository heißt
auf Wunsch `tram-timetable-manager`; es enthält **Gleis & Gasse**, nicht die separate
Fahrplan-Manager-App. Keine Server, NAS-Zugriffe, Konten, Tracker oder Netzwerkdienste.

## Spielen und entwickeln

Node.js 22+ (CI: 24) und Python 3.10+ installieren. Das Spiel selbst benötigt
keine npm-Abhängigkeiten. Python-Pakete sind ausschließlich Build-/Testwerkzeuge.

```sh
npm ci
npm test
npm run build
npm run check
```

Anschließend `web/index.html` lokal im Browser öffnen. Das Bundle ist vollständig
offline; `file:`-Speicherung hängt vom Browser ab. Die Android-App nutzt eine feste
synthetische Origin für app-lokalen Speicher, ohne diese Adresse aufzurufen.

**Erster Spieltest:** „Mit Beispielnetz starten“ richtet eine Tramlinie
Lindenplatz → Stadtpark → Marktplatz → Schule → Hauptbahnhof sowie eine Buslinie ein.
Über **Linien → Gartenlinie → Verlängern → Haltestellen → Seeufer** einen sechsten
Halt derselben Linie hinzufügen. Beim eigenen Bauen freie Flächen als Wegpunkte
antippen; Kurven entstehen automatisch. Die Haltestellenliste erleichtert Touchbedienung.

## Enthaltene Mechaniken

Eigene Tramtrassen abseits von Straßen, Wasser und reservierten Hausgrundstücken;
Busse auf vorhandenen Straßen; mehrere Halte und Wegpunkte pro Linie; bis zu acht
Linien und vier Fahrzeuge je Linie. Fahrgäste können umsteigen. Fahrgeld wird nur
bei Ankunft am endgültigen Ziel bezahlt. Keine laufenden Kosten oder Deadlines.

Drei Wohnviertel wachsen von je zwei kleinen Häusern über drei Stufen: zusätzliche
Etagen, neue Nachbarhäuser und ein kurzer Gerüsteffekt. Stufe 2 benötigt zwölf
relevante abgeschlossene Fahrten und ein erreichbares Ziel; Stufe 3 weitere 32
Fahrten und zwei erreichbare Ziele. Einwohner je Viertel: 16 → 32 → 56.
Große Tram ab 40 beförderten Fahrgästen; Stadtziele mit einmaligen Belohnungen.

Feste Karte mit neun Haltestellen. Keine freien Haltestellen, Brücken, Tunnel,
Signale, Kollisionssteuerung, KI-Autos, Fahrpläne, freie 3D-Kamera oder Multiplayer.
Die Grafik ist isometrische 2,5D-Canvas-Grafik. Die Stadt wächst nicht unbegrenzt.

## Struktur

```text
web/                   Simulation, Canvas-Renderer, Touch-UI und HTML-Vorlage
android/app/src/main/  Java-WebView-Host, Manifest, Icon und generierte Assets
tools/bundle.py        Erzeugt die beiden identischen Offline-HTML-Bundles
tools/build_apk.py     Eng begrenzter DEX/AXML/APK-Assembler für den Test-Host
tools/verify_apk.py    Unabhängige Paket-/Signatur-/Strukturprüfung
tools/build-with-sdk.sh Regulärer Android-SDK-Build, kompiliert die Java-Quelle
tests/                Simulation und Browser-Tests; historischer Prüfbericht
AGENTS.md              Zentrale Agentenregeln und Versionsbranch-Konvention
.agents/skills/        Commit-/Push-/PR-/Merge-Skill
GITHUB-SETUP.md         Noch erforderliche Aktivierung der GitHub-Schutzregeln
```

## Browser- und APK-Prüfung

```sh
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm run test:browser
npm run build:apk
npm run check:apk
```

Unter Windows funktioniert alternativ `py -3` für die direkten Python-Befehle.
Die npm-Skripte suchen einen passenden Interpreter; `PYTHON` kann dessen Pfad setzen.
Für einen bereits installierten Chromium `CHROMIUM_PATH` setzen, andernfalls nutzt
Playwright seinen Browser. Auf Linux kann `playwright install --with-deps chromium`
für die Systembibliotheken erforderlich sein.

`build_apk.py` ist **kein Java-Compiler und kein Ersatz für einen SDK-Build**.
Er emittiert die benötigten Activity-Methoden direkt. Änderungen an der Java-Datei
werden dadurch nicht automatisch in die APK übernommen. Native Änderungen müssen
mit dem regulären SDK gebaut werden. Das Paketprüfskript testet den Assembler-Build,
nicht beliebigen vom SDK erzeugten DEX-Code.

Der Assembler erzeugt `build/Gleis-und-Gasse-0.2.0.apk`. Ein lokaler Testschlüssel
wird bei Bedarf unter `tools/TEST-ONLY-*.pem` erzeugt. **Im GitHub-Repository liegt
kein privater Schlüssel**, auch nicht der in der ursprünglichen Download-ZIP
enthaltene Testschlüssel. Schlüssel und erzeugte APKs niemals committen.

Ein frischer Checkout erhält einen neuen Testschlüssel. Seine APK ist daher
**nicht automatisch als Update über die zuvor verteilte Test-APK installierbar**.
Für dauerhafte Releases einen eigenen geheimen Schlüssel verwenden und sicher
aufbewahren. Der frühere, mit der Download-ZIP verteilte Schlüssel ist nicht als
geheimes produktives Signiermaterial geeignet. Diese Übernahme veröffentlicht
keine neue APK und ändert keine auf dem Handy installierte Version.

## Regulärer Android-SDK-Build

Das übernommene Manifest deklariert Minimum API 30 und Ziel API 37. SDK-Plattform,
passende Build Tools, JDK, Python, OpenSSL und `zip` müssen installiert sein:

```sh
export ANDROID_HOME=/pfad/zum/Android/Sdk
export ANDROID_API=37
export BUILD_TOOLS_VERSION=37.0.0
bash tools/build-with-sdk.sh
```

Dieser Pfad nutzt `aapt2`, `javac`, `d8`, `zipalign` und `apksigner`. Er wurde bei
dieser Repository-Übernahme **nicht ausgeführt**. Installation, ART-Verifikation,
WebView-Verhalten und dauerhafte Speicherung auf einem echten Android-Gerät bleiben
manuell zu prüfen. Deklarierte Ziel-API ist keine bestätigte Gerätekompatibilität.

## Datenschutz und Speicherung

Keine Android-Berechtigungen, auch kein INTERNET. WebView-Netzwerklasten und
Netzwerkbilder sind blockiert; CSP setzt `connect-src 'none'`. Keine JS-/Native-
Bridge, keine Cloud-Sicherung. Spielstände werden lokal automatisch gespeichert;
eine manuelle Sicherung und Textimport/-export stehen in der Hilfe bereit.
Deinstallation/Datenlöschen kann die Stadt entfernen. Browser-Tests verwenden
ausdrücklich einen In-Memory-Speichertestdouble, nicht Android-Datenträgerpersistenz.

## GitHub-Arbeitsablauf

`AGENTS.md` lesen. Änderungen auf freien Versionsbranches wie `0.2.1`, nicht direkt
auf `main`. Commit-Skill und Copilot-Anweisungen sind eingerichtet; `CODEOWNERS`
ordnet alle Dateien `@bratkartoffeln` zu. **Die Ruleset-JSON aktiviert sich nicht
durch einen Commit**; Aktivierung und Grenzen stehen in [GITHUB-SETUP.md](GITHUB-SETUP.md).
Der Verify-Workflow hat nur Leserechte, keinen Deployment-/NAS-Schritt und kein
Auto-Merge. Er ist kein Android-Gerätetest.

Die 13 bestehenden Simulationstestgruppen wurden beim Import erneut ausgeführt.
Ein Build ist erst nach seinen tatsächlich ausgeführten Prüfungen zu bewerten;
der historische Bericht in `tests/PRUEFBERICHT.txt` ist keine CI-Zusage.

Lizenz: MIT, siehe [LICENSE](LICENSE). Keine externen Fonts oder Markenmodelle.
