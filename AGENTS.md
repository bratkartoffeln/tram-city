# Projektregeln für KI-Agenten

Diese Datei ist die zentrale Regelquelle für Codex und kompatible Agenten.
GitHub Copilot verweist über `.github/copilot-instructions.md` hierher.
Repository: `bratkartoffeln/tram-timetable-manager`; Spiel: **Gleis & Gasse**.

## Branch und Version vor Quellcodeänderungen

- Aktiven Git-Branch, `git status --short` und die Version in `package.json` prüfen.
- Auf `main` vor Quellcodeänderungen einen freien Versionsbranch anlegen: nächste
  Patch-Version, exakt als Branchname, ohne Präfix (z. B. `0.2.1`). Existierende
  Branches niemals überschreiben; bei Kollision die nächste freie Patch-Version nutzen.
- Ohne vorhandene Anwendung den ersten Import auf dem freien Initialversionsbranch
  `0.2.0` beginnen. Paketdateien nicht allein für Regel-/Dokumentationsänderungen anlegen.
- Auf einem vorhandenen Arbeitsbranch nicht allein wegen dieser Regel erneut verzweigen
  oder die Version erhöhen. Reine Dokumentations-/Regeländerungen brauchen keinen Versionssprung.
- `package.json`, beide Root-Versionsfelder in `package-lock.json`, Androids
  `versionName` und alle aktuellen Versionsanzeigen/Build-Dateinamen zusammen pflegen.
  Bei neuer APK-Version `versionCode` monoton erhöhen. Historische Prüfberichte und
  Changelog-Einträge nicht umschreiben. Die Speicherformat-Version in `engine.js`
  ist KEINE App-Version; nur bei einer geplanten Datenmigration ändern.
- Keine Quellcode-Commits direkt nach `main`; Änderungen über einen Pull Request.

## Anwendung und Datenschutz

- Vorerst ausschließlich lokal, offline und Singleplayer. Keine Server, NAS-Zugriffe,
  Netzwerkdienste, Telemetrie, externen Ressourcen oder Android-Berechtigungen ergänzen.
- Tramgleise bleiben außerhalb von Straßen, Wasser und reservierten Hausgrundstücken.
  Kurven, mehrere Halte pro Linie, Verlängern derselben Linie und sichtbares Stadtwachstum erhalten.
- `web/engine.js`, `web/render.js`, `web/app.js`, `web/style.css` und
  `web/index.template.html` sind die Web-Quellen. Bundles nur mit `npm run build` erzeugen.
- Der kleine APK-Assembler kompiliert NICHT die Java-Quelle. Native Änderungen
  mit dem regulären Android-SDK bauen/testen; Assembler und Java nicht unbemerkt auseinanderlaufen lassen.
- Niemals private Schlüssel, Keystores, Tokens, `.env`, lokale Spielstände, APKs,
  Build-Verzeichnisse oder Test-Screenshots committen. Auch Testschlüssel bleiben lokal.

## Prüfen und veröffentlichen

- Bei Quellcodeänderungen `npm test`, `npm run build` und `npm run check` ausführen.
  Bei UI-Änderungen zusätzlich `npm run test:browser`; bei APK-Änderungen
  `npm run build:apk` und `npm run check:apk`, bei Java-Änderungen den SDK-Baupfad.
- Tatsächlich ausgeführte Tests und Grenzen nennen. Browser-/Strukturtests sind
  kein Nachweis für Installation, Android-WebView-Speicherung oder Gerätekompatibilität.
- Für angefordertes Commit/Push/PR/Merge `.agents/skills/commit-publish-merge/SKILL.md`
  lesen. Der Import oder die Bearbeitung dieses Skills autorisiert keinen späteren Merge.
- Review-/Schutzregeln niemals abschalten. Kein Force-Push, Reset/Clean oder Verwerfen
  fremder Änderungen. Keine Deployment-Workflows aus den anderen Spielen übernehmen.
