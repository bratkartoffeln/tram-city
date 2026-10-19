---
name: commit-publish-merge
description: Änderungen mit einer aus dem Diff formulierten Commit-Nachricht committen, den Versionsbranch veröffentlichen, einen Pull Request nach main erstellen und nur auf ausdrücklichen Gesamtauftrag mit Merge-Commit zusammenführen. Eine Bitte um Commit-Nachricht, Upload oder Skill-Einrichtung autorisiert keinen Merge.
---

# Commit, Publish und Merge nach main

Dieser Skill folgt dem Arbeitsablauf von RPS-Online-reborn und Slide-a-Llama-Reborn,
mit Prüfungen für Gleis & Gasse statt Server-/NAS-Deployments. Seine Einrichtung
startet den Ablauf nicht. Nur die vom Nutzer beauftragten Schritte ausführen.

## Ausgangslage

1. `AGENTS.md`, Arbeitsverzeichnis, Branch, Projektversion, `git status --short`,
   gestagte/ungestagte Diffs und unversionierte Dateien prüfen. Fremde Änderungen
   nicht übernehmen, verstecken oder verwerfen.
2. Remote/Ziel mit `git remote -v` und GitHub-Authentifizierung prüfen. Explizit
   `--repo bratkartoffeln/tram-timetable-manager` verwenden, nicht ein anderes CLI-Standardrepo.
3. Auf `main` vor Quellcodeänderungen gemäß `AGENTS.md` einen freien Versionsbranch
   anlegen. Für reine Dokumentationsänderungen genügt ein beschreibender Arbeitsbranch.
   Bestehende Branches nicht überschreiben. Bei detached HEAD nicht blind veröffentlichen.
4. Remote-Refs abrufen, Diff gegen `REMOTE/main`, vorhandene Commits und PRs prüfen.
   Einen passenden offenen PR weiterverwenden; keine doppelten PRs/leeren Commits erstellen.
5. Bei Quellcodeänderungen `npm test`, `npm run build`, `npm run check` ausführen.
   UI: zusätzlich `npm run test:browser`; APK: `npm run build:apk` und
   `npm run check:apk`; Java: regulärer SDK-Build. `.github/workflows/verify.yml`
   ist die CI-Referenz. Keine nicht ausgeführten Prüfungen als bestanden ausgeben.

## Commit und Veröffentlichung

1. Prägnante Commit-Nachricht aus dem tatsächlichen Diff formulieren; Sprache/Stil
   der vorhandenen Historie berücksichtigen. Mehrzeilige Texte über UTF-8-Dateien
   und `git commit -F DATEI`, nicht als interpolierten Shell-Code übergeben.
2. Nur angeforderte Dateien gezielt mit `git add -- DATEIEN` stagen. Vollständigen
   `git diff --cached` auf fremde Änderungen, Secrets und generierte Artefakte prüfen.
3. Commit erstellen und `git push -u REMOTE BRANCH` ausführen, sofern beauftragt.
   Kein Force-Push, kein Umschreiben veröffentlichter Historie.
4. PR mit Base `main` und passendem Versionsbranch erstellen/aktualisieren. Titel
   und Body beschreiben den gesamten Diff, tatsächliche Tests und Einschränkungen.
   Für `gh pr create/edit` mehrzeilige Beschreibungen mit `--body-file DATEI` übergeben.
5. Bei einem reinen Upload-Auftrag hier stoppen und Branch, Commit und PR melden.
   Auto-Merge nicht stillschweigend einschalten.

## Merge nur auf ausdrücklichen Auftrag

1. PR-URL, Base, Head und aktuelle Head-SHA prüfen. Erforderliche CI-Checks und
   Workflow-Läufe für genau diesen Commit müssen erfolgreich abgeschlossen sein.
   Laufende/fehlgeschlagene Prüfungen nicht umgehen. Bei längeren Läufen Fortschritt melden.
2. Mit **Merge-Commit**, weder Squash noch Rebase, zusammenführen:
   `gh pr merge NUMMER --repo bratkartoffeln/tram-timetable-manager --merge --match-head-commit HEAD_SHA`.
3. Fehlen ausschließlich Reviews, kann ein ausdrücklich beauftragter Gesamtworkflow
   den in den Referenz-Repos vorgesehenen Admin-Bypass nutzen, ABER nur wenn die
   aktuell aktiven Regeln ihn tatsächlich erlauben. Admin-Recht, PR-only-Bypass und
   Head-SHA vorher prüfen; dann gegebenenfalls `--admin` ergänzen. Keine Regeln
   ändern/deaktivieren und keine CI-Fehler umgehen. Verwendeten Review-Bypass melden.
4. `MERGED` und Merge-Commit verifizieren; eine angenommene Anfrage/Auto-Merge reicht
   nicht. Bei geänderter Head-SHA Diff und Checks erneut prüfen.
5. Erst dann bei sauberem Arbeitsverzeichnis `git switch main`, `git fetch REMOTE`
   und `git merge --ff-only REMOTE/main`. Prüfen, dass der Merge-Commit enthalten ist.
   Versionsbranch nur auf gesonderten Auftrag löschen.

## Blocker und Abschluss

Bei fehlenden Rechten, Authentifizierung, gescheiterten Checks, Konflikten oder
fehlenden Reviews ohne zulässigen Bypass am betroffenen Schritt stoppen und den
realen Status melden. Kein Reset, Clean, Stash oder Abschalten von Schutzregeln.
Wiederaufnahme beginnt mit erneuter Prüfung von Git-/PR-/CI-Zustand.
Zum Abschluss Commit, Branch, PR-Link, Tests und gegebenenfalls den bestätigten
Merge-Commit sowie den tatsächlich aktiven lokalen Branch nennen.
