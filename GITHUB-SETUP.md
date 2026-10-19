# GitHub-Vorbereitung

Vorlage: die live gelesenen `Protect Main`-Rulesets von
`bratkartoffeln/RPS-Online-reborn` (25156650) und
`bratkartoffeln/Slide-a-Llama-Reborn` (25222132).

## Dateien sind nicht gleich aktivierte GitHub-Regeln

`AGENTS.md`, Copilot-Anweisungen, Commit-/PR-Skill und `CODEOWNERS` sind
Repository-Dateien. `.github/protect-main.ruleset.json` ist eine **Importvorlage**;
sie aktiviert sich nicht durch einen Commit. Beim erstmaligen Vorbereiten war
`main` ungeschützt und das Ziel-Repo hatte keine Rulesets.
Die verwendete GitHub-Anbindung kann Dateien/PRs schreiben, aber keine
Administrationsänderungen ausführen. Die folgende Aktivierung steht daher aus.

## Schutzregeln aktivieren

Im Repository unter **Settings → Rules → Rulesets → New ruleset → Import a ruleset**
die Datei `.github/protect-main.ruleset.json` importieren und aktiv speichern.
Alternativ mit einer lokal angemeldeten GitHub CLI und Adminrechten:

```sh
gh api --method POST repos/bratkartoffeln/tram-timetable-manager/rulesets --input .github/protect-main.ruleset.json
```

Vor dem POST vorhandene Regeln prüfen; bei bereits existierendem `Protect Main`
nicht erneut anlegen, sondern vergleichen und gegebenenfalls die vorhandene Regel
bearbeiten. Abschließend die tatsächlich aktiven Einstellungen in GitHub prüfen.
Keinen Token in Dateien, Chat oder Git-Historie eintragen.

Die Vorlage entspricht den beiden Referenz-Repos:
- Standardbranch: nur PRs; ein Approval und Code-Owner-Review erforderlich.
- Neue Commits verwerfen alte Freigaben; Review-Unterhaltungen müssen erledigt sein.
- Löschen und Force-Push blockiert.
- Repository-Admins dürfen **nur über PRs** umgehen, nicht direkt nach `main` pushen.
  Diese bestehende Ausnahme ist kein ausnahmsloser Review-Zwang für den Besitzer.
- CODEOWNER für alle Pfade: `@bratkartoffeln`.

Die Referenz-Regeln erlauben Merge/Squash/Rebase; der Commit-Skill verwendet wie
bisher ausdrücklich Merge-Commits. Keine zusätzlichen Bypass-Akteure, Mitarbeiter,
Apps, Deploy-Keys oder Secrets wurden angelegt. Keine NAS-/Caddy-/Deployment-Aufträge.

## Actions-Berechtigungen

Der Prüfworkflow fordert ausschließlich `contents: read` an. Das ist eine
Workflow-Einstellung, keine Änderung der globalen Repository-Berechtigungen.
Unter **Settings → Actions → General → Workflow permissions** kann der Besitzer
zusätzlich **Read repository contents and packages permissions** als Standard wählen
und **Allow GitHub Actions to create and approve pull requests** ausgeschaltet lassen.
CI braucht weder Admin-/Schreibrechte noch einen Signierschlüssel als Secret.

## Nach der Initialübernahme

Der Quellcode wird auf `0.2.0` über einen PR bereitgestellt, nicht direkt nach `main`
geschrieben. Nach Review/ausdrücklichem Merge-Auftrag per Merge-Commit übernehmen.
Erste spätere Codeänderung auf `main`: freier Patch-Versionsbranch, z. B. `0.2.1`.

Referenzen:
- https://docs.github.com/de/rest/repos/rules
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository
