// ================================================================
// Sichtbarlokal – Report-Generator (47-EUR-Produkt)
// ================================================================
// Liefert den vollstaendigen, individualisierten Local-SEO-Report
// als druckbares HTML (A4, "Drucken -> Als PDF speichern" im Browser).
//
// Aufruf:  /api/report?business=Beispiel&location=Muenchen&token=ORDER_ID
//          oder POST mit { business, location, token }
//
// In Produktion solltest du `token` gegen deine Bestellungs-DB pruefen
// (Stripe / Lemon Squeezy / etc.). Aktuell akzeptiert die Function jeden
// Token, der mit "ORDER-" beginnt -> ersetze pruefe_token() durch deine
// echte Validierung sobald die Zahlungsanbindung live ist.
// ================================================================

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadTemplate() {
  const tplPath = path.join(__dirname, "_report-template.html");
  return fs.readFile(tplPath, "utf8");
}

function pruefe_token(token) {
  // TODO: gegen Stripe/Bestellungs-DB pruefen
  return typeof token === "string" && token.startsWith("ORDER-");
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderMetrics(metrics) {
  return Object.entries(metrics)
    .map(
      ([k, v]) => `
      <div class="metric">
        <div class="name">${escapeHtml(k)}</div>
        <div class="bar"><div class="fill" style="width:${v}%"></div></div>
        <div class="val">${v}%</div>
      </div>`
    )
    .join("");
}

function renderRecs(recs) {
  if (!recs.length) {
    return `<li>Keine kritischen Lücken erkannt – starke Profilbasis.</li>`;
  }
  return recs
    .map(
      (r) => `<li>
        <strong>${escapeHtml(r.title)}</strong><br>
        <span style="color:#475569;font-size:9.5pt;">${escapeHtml(r.detail)}</span>
      </li>`
    )
    .join("");
}

function renderCompetitors(comp) {
  if (!comp.length) {
    return `<tr><td colspan="4" style="color:#94a3b8;">Keine direkten Wettbewerber im 3,5-km-Umkreis gefunden.</td></tr>`;
  }
  return comp
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>★ ${c.rating ?? "–"}</td>
        <td>${c.reviewCount ?? 0}</td>
        <td style="color:#64748b;">${escapeHtml(c.address || "")}</td>
      </tr>`
    )
    .join("");
}

function render30DayPlan(business, recs) {
  const week = (n, title, items) => `
    <div class="plan-week">
      <h4>Woche ${n}: ${escapeHtml(title)}</h4>
      <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`;

  // Plan auf Basis der Top-Empfehlungen ableiten
  const focus = recs.map((r) => r.title.split(":")[0]);

  return [
    week(1, "Profil-Basis schliessen", [
      "Alle fehlenden GMB-Felder ausfüllen (Beschreibung, Öffnungszeiten, Service-Areas)",
      "Mindestens 10 hochwertige Fotos hochladen (Innen, Außen, Team, Produkte)",
      "Primär- und 2-3 Sekundärkategorien korrekt setzen",
      focus[0]
        ? `Fokus-Hebel anpacken: ${focus[0]}`
        : "Profil auf 100 % Vollständigkeit bringen",
    ]),
    week(2, "Bewertungs-Aufbau aktivieren", [
      "Bewertungs-Anfrage-Sequenz aufsetzen (E-Mail + QR-Code in der Filiale)",
      "Alle bestehenden Bewertungen beantworten (positive und negative)",
      "10 zufriedene Stammkunden direkt um Bewertung bitten",
      focus[1] ? `Hebel weitertreiben: ${focus[1]}` : "Review-Tempo etablieren",
    ]),
    week(3, "Content & Wettbewerb", [
      "2-3 Google-Posts veröffentlichen (Angebot, Event, Update)",
      "NAP-Konsistenz auf Yelp, Gelbe Seiten, 11880, Apple Maps prüfen und korrigieren",
      "Wettbewerber-Profile durchsehen, Inhalte/Angebote vergleichen",
      focus[2] ? `Hebel: ${focus[2]}` : "Content-Aktivität sichtbar steigern",
    ]),
    week(4, "Messen & nachsteuern", [
      "Profil-Score erneut prüfen (Sichtbarlokal-Tool)",
      "Local-Pack-Position für 3 Top-Keywords in Google checken",
      "Bewertungs-Zuwachs der letzten 30 Tage dokumentieren",
      "Plan für die nächsten 30 Tage ableiten – fortlaufend optimieren",
    ]),
  ].join("");
}

async function fetchAnalysis(host, business, location) {
  const base = host || "https://sichtbarlokal.de";
  const res = await fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business, location }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Analyse-Fehler ${res.status}`);
  }
  return res.json();
}

export default async (req) => {
  let business = "";
  let location = "";
  let token = "";

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    business = (body.business || "").trim();
    location = (body.location || "").trim();
    token = (body.token || "").trim();
  } else {
    const u = new URL(req.url);
    business = (u.searchParams.get("business") || "").trim();
    location = (u.searchParams.get("location") || "").trim();
    token = (u.searchParams.get("token") || "").trim();
  }

  if (!pruefe_token(token)) {
    return new Response(
      "Zugang verweigert. Dieser Report ist Teil des 47-EUR-Pakets. " +
        "Buche unter https://sichtbarlokal.de/#produkte – nach Zahlung erhältst du " +
        "deinen persönlichen Report-Link per E-Mail.",
      { status: 402, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  if (!business) {
    return new Response("Parameter 'business' fehlt.", { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;
    const data = await fetchAnalysis(origin, business, location);
    const tpl = await loadTemplate();
    const affiliateUrl =
      Netlify.env.get("LOCALO_AFFILIATE_URL") ||
      "https://localo.com?ref=andreas91";

    const filled = tpl
      .replaceAll("{{businessName}}", escapeHtml(data.business?.name || business))
      .replaceAll("{{businessAddress}}", escapeHtml(data.business?.address || "—"))
      .replaceAll("{{generatedDate}}", new Date(data.generatedAt).toLocaleDateString("de-DE"))
      .replaceAll("{{score}}", String(data.score))
      .replaceAll("{{rating}}", data.business?.rating ?? "–")
      .replaceAll("{{reviewCount}}", data.business?.reviewCount ?? 0)
      .replaceAll("{{photoCount}}", data.business?.photoCount ?? 0)
      .replaceAll("{{category}}", escapeHtml(data.business?.category || "—"))
      .replaceAll(
        "{{websiteOrDash}}",
        data.business?.website
          ? `<a href="${escapeHtml(data.business.website)}">${escapeHtml(data.business.website)}</a>`
          : "—"
      )
      .replaceAll("{{phoneOrDash}}", escapeHtml(data.business?.phone || "—"))
      .replaceAll("{{metricsRows}}", renderMetrics(data.metrics || {}))
      .replaceAll("{{recommendationItems}}", renderRecs(data.recommendations || []))
      .replaceAll("{{competitorRows}}", renderCompetitors(data.competitors || []))
      .replaceAll(
        "{{thirtyDayPlan}}",
        render30DayPlan(data.business?.name || business, data.recommendations || [])
      )
      .replaceAll("{{affiliateUrl}}", escapeHtml(affiliateUrl));

    return new Response(filled, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return new Response(
      `Fehler beim Erstellen des Reports: ${err.message}`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
};

export const config = {
  path: "/api/report",
};
