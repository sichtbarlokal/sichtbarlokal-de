exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!GOOGLE_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { action, query, location, placeId } = body;

  try {
    // Action 1: Text Search – find competitors
    if (action === "search") {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/textsearch/json"
      );
      url.searchParams.set("query", query);
      if (location) url.searchParams.set("location", location);
      url.searchParams.set("radius", "5000");
      url.searchParams.set("language", "de");
      url.searchParams.set("key", GOOGLE_API_KEY);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: data.status }),
        };
      }

      // Return top 3 results with relevant fields only
      const results = (data.results || []).slice(0, 3).map((p) => ({
        name: p.name,
        address: p.formatted_address,
        rating: p.rating || null,
        reviewCount: p.user_ratings_total || 0,
        types: p.types || [],
        placeId: p.place_id,
        openNow: p.opening_hours?.open_now ?? null,
      }));

      return { statusCode: 200, headers, body: JSON.stringify({ results }) };
    }

    // Action 2: Place Details – get full info for a specific business
    if (action === "details") {
      if (!placeId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "placeId required" }),
        };
      }

      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/details/json"
      );
      url.searchParams.set("place_id", placeId);
      url.searchParams.set(
        "fields",
        "name,rating,user_ratings_total,formatted_address,opening_hours,website,formatted_phone_number,reviews,types"
      );
      url.searchParams.set("language", "de");
      url.searchParams.set("key", GOOGLE_API_KEY);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.status !== "OK") {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: data.status }),
        };
      }

      const r = data.result;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          name: r.name,
          rating: r.rating,
          reviewCount: r.user_ratings_total,
          address: r.formatted_address,
          website: r.website || null,
          phone: r.formatted_phone_number || null,
          hasHours: !!r.opening_hours,
          recentReviews: (r.reviews || []).slice(0, 3).map((rv) => ({
            rating: rv.rating,
            text: rv.text?.slice(0, 200),
            time: rv.relative_time_description,
          })),
        }),
      };
    }

    // Action 3: Geocode – convert city name to lat/lng
    if (action === "geocode") {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/geocode/json"
      );
      url.searchParams.set("address", query);
      url.searchParams.set("language", "de");
      url.searchParams.set("key", GOOGLE_API_KEY);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.status !== "OK" || !data.results.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Location not found" }),
        };
      }

      const loc = data.results[0].geometry.location;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ lat: loc.lat, lng: loc.lng }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Unknown action" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
