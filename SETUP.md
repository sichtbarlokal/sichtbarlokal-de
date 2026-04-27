# Sichtbarlokal – Setup & Deployment

Stand: April 2026 · Maintainer: Andreas

## Was sich geandert hat

| Datei | Status | Zweck |
|---|---|---|
| `netlify/functions/analyze.mjs` | NEU | Serverless-Function. Echte Google-Places- + PageSpeed-Daten -> Score, Metriken, Top-3-Empfehlungen, Wettbewerber, Affiliate-Block. |
| `netlify/functions/report.mjs` | NEU | Generiert den voll individualisierten 47-EUR-Report (HTML, druckbar als PDF). |
| `netlify/functions/_report-template.html` | NEU | A4-Layout fuer den Report. |
| `js/main.js` | UPDATED | Tool-Form ruft jetzt `/api/analyze` statt hartcodierter Demo-Daten. |
| `tool/index.html` | UPDATED | Form hat jetzt zwei Felder (Unternehmen + Ort). |
| `netlify.toml` | UPDATED | `functions = "netlify/functions"`, Catch-all-404 mit `force = false`. |
| `marketing/email-sequenz-localo-affiliate.md` | NEU | 3-teilige Post-Purchase-E-Mail-Sequenz mit Localo-Affiliate-Link. |

## ZWINGEND erforderlich vor dem ersten Deploy: Netlify-Env-Variablen setzen

1. Gehe zu **app.netlify.com -> Site `sichtbarlokal` -> Site configuration -> Environment variables**.
2. Lege diese drei Variablen an:

| Key | Wert | Hinweis |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | dein Google-Places-API-Key | console.cloud.google.com -> Credentials. Aktiviere die "Places API (New)". |
| `GOOGLE_PSI_API_KEY` | dein PageSpeed-Key | Kann derselbe Key sein, wenn er beide APIs darf. Aktiviere "PageSpeed Insights API". |
| `LOCALO_AFFILIATE_URL` | `https://localo.com?ref=andreas91` | bereits dein Link. |

> Ohne `GOOGLE_PLACES_API_KEY` antwortet die Function mit `500 / "Server nicht konfiguriert"`. Frontend zeigt den Fehler an.

3. **API-Key absichern:** im Google-Cloud-Dashboard fuer den Key Application restrictions setzen:
   - HTTP referrers: `https://sichtbarlokal.de/*`, `https://*.netlify.app/*`
   - Server-side restriction zusaetzlich auf `Places API (New)` und `PageSpeed Insights API` einschraenken.

4. **Kostenkontrolle:** Google Places API liegt bei rund 17 USD pro 1000 "Text Search"-Calls (Essentials-Tier). PageSpeed ist gratis. Setze ein **Budget-Alert** auf 50 USD/Monat im Google-Cloud-Dashboard, bis du die echten Volumina kennst.

## Sicherheitshinweis: GitHub-Token in `.git/config`

In `.git/config` ist aktuell ein Personal Access Token im Klartext eingebettet (`ghp_...`).

**Dringend:**
1. Token rotieren: github.com -> Settings -> Developer settings -> Personal access tokens -> alten Token revoken, neuen erstellen.
2. Remote-URL auf SSH umstellen (sicherste Option):
   ```bash
   cd ~/Documents/Claude/Sichtbarlokal
   git remote set-url origin git@github.com:sichtbarlokal/sichtbarlokal-de.git
   ```
   Setzt voraus, dass dein SSH-Key bei GitHub hinterlegt ist (`~/.ssh/id_ed25519.pub` -> github.com/settings/keys).
3. Alternativ: macOS Keychain via `git config --global credential.helper osxkeychain` und HTTPS-Login einmalig im Browser.

## Deploy-Workflow (manuell, bis CI eingerichtet ist)

In deinem Terminal:

```bash
cd ~/Documents/Claude/Sichtbarlokal

# Aenderungen pruefen
git status
git diff --stat

# Stagen + commit
git add .
git commit -m "feat(tool): echte Google-Daten via Netlify Function, Affiliate-Block, 47EUR-Report"

# Pushen -> Netlify deployt automatisch
git push origin main
```

Nach `git push` siehst du den Build live unter **app.netlify.com/projects/sichtbarlokal/deploys**.

## Smoke-Test nach Deploy

1. https://sichtbarlokal.de/tool/ oeffnen
2. "Backerei Schmidt" + "Berlin" eingeben -> "Jetzt analysieren"
3. Erwartung: echter Score, echte Bewertungs-Zahl, echte Adresse, Localo-Block am Ende
4. Console im Browser auf `/api/analyze`-Request pruefen, sollte 200 zurueckgeben.
5. Wenn 500: Env-Variablen pruefen (siehe oben).

## Naechste Schritte (nicht in diesem Push enthalten)

- **Zahlungsanbindung:** in `report.mjs` die `pruefe_token()`-Funktion gegen Stripe/Lemon-Squeezy-Webhook tauschen, sobald Bezahl-Flow live ist.
- **PDF-Export:** aktuell speichert der Kunde den Report ueber den Browser ("Drucken -> Als PDF"). Spaeter: `puppeteer-core + @sparticuz/chromium` als zweite Function fuer echten PDF-Download.
- **E-Mail-Versand:** die Mails in `marketing/email-sequenz-localo-affiliate.md` in MailerLite / Brevo / ActiveCampaign anlegen, Trigger an Stripe-Webhook haengen.
- **Forms aktivieren:** Netlify Forms ist auf der Site aktuell `not enabled`. Falls Kontaktformular gebraucht: in den Netlify-Site-Settings -> Forms -> "Enable Form Detection".
