const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const { bizName, bizCity, reportData: reportDataStr } = session.metadata;
    const email = session.customer_email || session.customer_details?.email;

    let reportData = {};
    try {
      reportData = JSON.parse(reportDataStr || "{}");
    } catch {}

    // Send confirmation email via Netlify Forms / or log for manual processing
    // Since we use Netlify Forms for email, we POST to the form endpoint
    try {
      await sendReportEmail(email, bizName, bizCity, reportData, session.id);
    } catch (err) {
      console.error("Email send error:", err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function sendReportEmail(email, bizName, bizCity, reportData, sessionId) {
  // Use Netlify's built-in form submission notification
  // This triggers an email notification to your configured address
  const formData = new URLSearchParams({
    "form-name": "report-delivery",
    email: email,
    bizName: bizName,
    bizCity: bizCity,
    sessionId: sessionId,
    score: reportData.score || "N/A",
    scoreVerdict: reportData.scoreVerdict || "",
  });

  const res = await fetch(`${process.env.URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!res.ok) {
    throw new Error(`Form submission failed: ${res.status}`);
  }

  console.log(`Report delivery triggered for ${email} - ${bizName}, ${bizCity}`);
}
