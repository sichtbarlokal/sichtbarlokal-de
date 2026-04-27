// ================================================================
// Sichtbarlokal – KI-Analyse-Tool · Serverless Function
// ================================================================
// Liefert eine echte Local-SEO-Analyse fuer ein Unternehmen auf Basis
// realer Google-Daten:
//   1. Google Places API (New) – Text Search + Place Details
//   2. Google PageSpeed Insights API – Mobile Performance & SEO
//
// Antwortformat: JSON mit Score, Metriken, Top-3-Aktionen, Wettbewerber,
// Affiliate-Empfehlung (Localo). Wird vom Frontend in /js/main.js und
// vom PDF-Report (47 EUR) konsumiert.
//
// ENV-Variablen (in Netlify zu setzen):
//   GOOGLE_PLACES_API_KEY  – Places API (New) Key
//   GOOGLE_PSI_API_KEY     – PageSpeed Insights Key (kann derselbe sein)
//   LOCALO_AFFILIATE_URL   – z.B. https://localo.com?ref=andreas91
// ================================================================

const PLACES_TEXTSEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const PLACES_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.regularOpeningHours",
  "places.editorialSummary",
  "places.photos",
  "places.location",
  "places.googleMapsUri",
].join(",");

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function score0to100(value, target) {
  return clamp(Math.round((value / target) * 100), 0, 100);
}

async function placesTextSearch(query, apiKey) {
  const res = await fetch(PLACES_TEXTSEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "de",
      regionCode: "DE",
      maxResultCount: 5,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Places API ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.places || [];
}

async function competitorSearch(primaryType, place, apiKey) {
  if (!primaryType || !place?.location) return [];
  const lat = place.location.latitude;
  const lng = place.location.longitude;
  const res = await fetch(PLACES_TEXTSEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: `${primaryType}`,
      languageCode: "de",
      regionCode: "DE",
      maxResultCount: 6,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 3500 },
      },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = (data.places || []).filter((p) => p.id !== place.id);
  return list.slice(0, 3);
}

async function pageSpeedScore(websiteUri, apiKey) {
  if (!websiteUri || !apiKey) return null;
  const url =
    `${PSI_URL}?url=${encodeURIComponent(websiteUri)}` +
    `&strategy=mobile&category=performance&category=seo&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const perf =
      data?.lighthouseResult?.categories?.performance?.score ?? null;
    const seo = data?.lighthouseResult?.categories?.seo?.score ?? null;
    return {
      performance: perf == null ? null : Math.round(perf * 100),
      seo: seo == null ? null : Math.round(seo * 100),
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Score & Recommendations
// ----------------------------------------------------------------
function scoreProfile(place, psi) {
  // Profil-Vollstaendigkeit – binaere Signale
  const completenessChecks = [
    !!place.formattedAddress,
    !!place.nationalPhoneNumber || !!place.internationalPhoneNumber,
    !!place.websiteUri,
    !!place.regularOpeningHours,
    !!place.editorialSummary,
    !!place.primaryType,
    Array.isArray(place.types) && place.types.length >= 2,
    Array.isArray(place.photos) && place.photos.length >= 5,
  ];
  const completeness = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) *
      100
  );

  // Bewertungen
  const reviewVolume = score0to100(place.userRatingCount || 0, 100);
  const ratingQuality = place.rating
    ? clamp(Math.round(((place.rating - 3) / 2) * 100), 0, 100)
    : 0;
  const reviews = Math.round(reviewVolume * 0.6 + ratingQuality * 0.4);

  // Fotos
  const photos = score0to100((place.photos || []).length, 25);

  // Beschreibung / Keywords (heuristisch ueber editorialSummary-Laenge)
  const summary =
    place.editorialSummary?.text || place.editorialSummary?.languageCode
      ? place.editorialSummary?.text || ""
      : "";
  const keyword = summary
    ? clamp(Math.round((summary.length / 250) * 100), 0, 100)
    : 0;

  // Website / PageSpeed
  const websiteScore = !place.websiteUri
    ? 0
    : psi
    ? Math.round(((psi.performance ?? 60) + (psi.seo ?? 80)) / 2)
    : 65; // Website vorhanden, aber PSI nicht messbar -> neutral

  // Gewichtung -> Gesamt-Score
  const weights = {
    completeness: 0.25,
    reviews: 0.25,
    photos: 0.15,
    keyword: 0.15,
    website: 0.2,
  };
  const total = Math.round(
    completeness * weights.completeness +
      reviews * weights.reviews +
      photos * weights.photos +
      keyword * weights.keyword +
      websiteScore * weights.website
  );

  return {
    total,
    metrics: {
      "Profil-Vollstaendigkeit": completeness,
      "Bewertungsprofil": reviews,
      "Foto-Qualitaet & Anzahl": photos,
      "Beschreibung & Keywords": keyword,
      "Website-Performance": websiteScore,
    },
  };
}

function recommendations(place, scored, psi, competitors) {
  const recs = [];
  const m = scored.metrics;

  if (m["Profil-Vollstaendigkeit"] < 80) {
    const missing = [];
    if (!place.editorialSummary) missing.push("Unternehmensbeschreibung");
    if (!place.regularOpeningHours) missing.push("Oeffnungszeiten");
    if (!place.websiteUri) missing.push("Website-URL");
    if (!(place.photos && place.photos.length >= 5)) missing.push("min. 5 Fotos");
    recs.push({
      title: missing.length
        ? `Profil vervollstaendigen: ${missing.join(", ")}`
        : "Profil-Felder vollstaendig ausfuellen",
      impact: 100 - m["Profil-Vollstaendigkeit"],
      detail:
        "Vollstaendige Google Business Profile ranken laut Whitespark/BrightLocal-Studien bis zu 70 % besser als unvollstaendige.",
    });
  }

  if (m["Bewertungsprofil"] < 70) {
    const cnt = place.userRatingCount || 0;
    const target = Math.max(50, cnt + 25);
    recs.push({
      title: `Bewertungen ausbauen: aktuell ${cnt} – Ziel ${target}+`,
      impact: 100 - m["Bewertungsprofil"],
      detail:
        "Bewertungen sind nach Profil-Vollstaendigkeit der staerkste Local-Pack-Faktor. Etabliere einen automatisierten Review-Request-Prozess.",
    });
  }

  if (m["Foto-Qualitaet & Anzahl"] < 60) {
    const cnt = (place.photos || []).length;
    recs.push({
      title: `Fotos hochladen: aktuell ${cnt} – Ziel 25+`,
      impact: 100 - m["Foto-Qualitaet & Anzahl"],
      detail:
        "Profile mit 25+ Fotos erhalten laut Google bis zu 42 % mehr Routenanfragen und 35 % mehr Klicks zur Website.",
    });
  }

  if (m["Beschreibung & Keywords"] < 60) {
    recs.push({
      title: "Beschreibung mit lokalen Keywords ausbauen (750 Zeichen Limit)",
      impact: 100 - m["Beschreibung & Keywords"],
      detail:
        "Eine keyword-optimierte Beschreibung mit Stadt, Stadtteil und Hauptleistungen verbessert das Ranking auf 'in meiner Naehe'-Suchen.",
    });
  }

  if (m["Website-Performance"] < 70 && place.websiteUri) {
    const reason =
      psi && psi.performance != null
        ? `Mobile-PageSpeed-Score: ${psi.performance}/100`
        : "Performance konnte nicht gemessen werden";
    recs.push({
      title: `Website-Performance verbessern (${reason})`,
      impact: 100 - m["Website-Performance"],
      detail:
        "Ladezeit unter 2.5 s mobile ist Pflicht. Bilder komprimieren, kritisches CSS inline, Schriften lokal hosten.",
    });
  } else if (!place.websiteUri) {
    recs.push({
      title: "Website-URL ins Profil eintragen",
      impact: 60,
      detail:
        "Ohne Website-Link verlierst du Klicks und sendest schwache Signale an den Google-Local-Algorithmus.",
    });
  }

  // Wettbewerber-basiert
  if (competitors.length) {
    const avgRating =
      competitors.reduce((s, c) => s + (c.rating || 0), 0) /
      competitors.length;
    const avgVolume =
      competitors.reduce((s, c) => s + (c.userRatingCount || 0), 0) /
      competitors.length;
    if ((place.userRatingCount || 0) < avgVolume * 0.8) {
      recs.push({
        title: `Wettbewerber-Gap: Top-3 in deiner Naehe haben Ø ${Math.round(
          avgVolume
        )} Bewertungen`,
        impact: 70,
        detail:
          "Du liegst deutlich unter dem lokalen Bewertungs-Niveau. Das ist der direkteste Hebel im Local Pack.",
      });
    }
    if ((place.rating || 0) + 0.2 < avgRating) {
      recs.push({
        title: `Bewertungs-Qualitaet: lokal Ø ${avgRating.toFixed(
          2
        )}, du ${(place.rating || 0).toFixed(2)}`,
        impact: 50,
        detail:
          "Aktive Beantwortung von Bewertungen und Eskalation negativer Reviews bringt im Schnitt +0.3 Sterne in 3 Monaten.",
      });
    }
  }

  // sortieren nach Impact, top 3
  recs.sort((a, b) => b.impact - a.impact);
  return recs.slice(0, 3);
}

// ----------------------------------------------------------------
// Handler
// ----------------------------------------------------------------
export default async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  let business = "";
  let location = "";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      business = (body.business || "").trim();
      location = (body.location || "").trim();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    const u = new URL(req.url);
    business = (u.searchParams.get("business") || "").trim();
    location = (u.searchParams.get("location") || "").trim();
  }

  if (!business) {
    return Response.json({ error: "business is required" }, { status: 400 });
  }

  const placesKey = Netlify.env.get("GOOGLE_PLACES_API_KEY");
  const psiKey =
    Netlify.env.get("GOOGLE_PSI_API_KEY") ||
    Netlify.env.get("GOOGLE_PLACES_API_KEY");
  const affiliateUrl =
    Netlify.env.get("LOCALO_AFFILIATE_URL") ||
    "https://localo.com?ref=andreas91";

  if (!placesKey) {
    return Response.json(
      {
        error:
          "Server nicht konfiguriert: GOOGLE_PLACES_API_KEY fehlt in Netlify Env-Variablen.",
      },
      { status: 500 }
    );
  }

  try {
    const query = location ? `${business} ${location}` : business;
    const places = await placesTextSearch(query, placesKey);
    if (!places.length) {
      return Response.json(
        {
          error: `Kein Google Business Profil fuer "${query}" gefunden. Bitte praezisiere mit Stadt oder Branche.`,
        },
        { status: 404 }
      );
    }
    const place = places[0];

    const [psi, competitors] = await Promise.all([
      pageSpeedScore(place.websiteUri, psiKey),
      competitorSearch(
        place.primaryTypeDisplayName?.text ||
          place.primaryType ||
          (place.types && place.types[0]) ||
          business,
        place,
        placesKey
      ),
    ]);

    const scored = scoreProfile(place, psi);
    const recs = recommendations(place, scored, psi, competitors);

    const result = {
      query,
      generatedAt: new Date().toISOString(),
      business: {
        name: place.displayName?.text || business,
        address: place.formattedAddress || null,
        phone:
          place.nationalPhoneNumber || place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        category: place.primaryTypeDisplayName?.text || place.primaryType || null,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? 0,
        photoCount: (place.photos || []).length,
        hasOpeningHours: !!place.regularOpeningHours,
        hasDescription: !!place.editorialSummary,
        googleMapsUri: place.googleMapsUri || null,
      },
      score: scored.total,
      metrics: scored.metrics,
      recommendations: recs,
      competitors: competitors.map((c) => ({
        name: c.displayName?.text || "Mitbewerber",
        rating: c.rating ?? null,
        reviewCount: c.userRatingCount ?? 0,
        category: c.primaryTypeDisplayName?.text || null,
        address: c.formattedAddress || null,
      })),
      pageSpeed: psi,
      affiliate: {
        provider: "Localo",
        url: affiliateUrl,
        headline: "DIY-Tool fuer das taegliche Local-SEO-Monitoring",
        body:
          "Mit Localo kannst du die hier identifizierten Hebel laufend selbst tracken: Ranking-Position fuer deine Keywords, Wettbewerbsvergleich und automatisierte Aufgabenlisten. Wir nutzen es selbst – mit dem Affiliate-Link unten unterstuetzt du Sichtbarlokal kostenlos.",
        disclaimer:
          "Werbe-Hinweis: Affiliate-Link – wir erhalten eine Provision, fuer dich entstehen keine Mehrkosten.",
      },
    };

    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (err) {
    return Response.json(
      { error: err.message || "Unbekannter Fehler bei der Analyse." },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/analyze",
};
