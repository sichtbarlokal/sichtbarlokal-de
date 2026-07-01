// Stripe Checkout ohne npm-Paket – direkte API-Aufrufe per fetch

const PRODUCTS = {
  'ki-analyse': {
    priceId: 'price_1TRTNlFUhWlX3KCraxGKFTiq',
    name: 'KI Local SEO Analyse Report',
  },
  'gmb-audit': {
    priceId: 'price_1TRTLVFUhWlX3KCrm7L23iRH',
    name: 'GMB Audit Template',
  },
};

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { productId } = JSON.parse(event.body);
    const product = PRODUCTS[productId];

    if (!product) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unbekanntes Produkt: ' + productId })
      };
    }

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'STRIPE_SECRET_KEY nicht konfiguriert' })
      };
    }

    const baseUrl = process.env.BASE_URL || 'https://www.sichtbarlokal.de';

    // Stripe Checkout Session via fetch (kein npm-Paket nötig)
    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price]': product.priceId,
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'success_url': `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&product=${productId}`,
      'cancel_url': baseUrl,
      'locale': 'de',
      'allow_promotion_codes': 'true',
      'metadata[productId]': productId,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: session.error?.message || 'Stripe Fehler' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
