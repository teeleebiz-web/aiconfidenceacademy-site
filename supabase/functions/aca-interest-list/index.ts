const ALLOWED_ORIGINS = new Set([
  "https://aiconfidenceacademy.org",
  "https://www.aiconfidenceacademy.org",
]);
const INTERESTS = new Set(["Phase One", "Books & Resources", "Videos", "ACA updates"]);

const cors = (origin: string | null): HeadersInit => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://aiconfidenceacademy.org",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "Vary": "Origin",
});
const respond = (body: Record<string, unknown>, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function getSecretKey(): string | null {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const keys = JSON.parse(current) as Record<string, string>;
      return keys.default || Object.values(keys)[0] || null;
    } catch { console.error("Invalid SUPABASE_SECRET_KEYS"); }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return respond({ ok: false, message: "Origin not allowed." }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") {
    return respond({ ok: false, message: "Method not allowed." }, 405, origin);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return respond({ ok: false, message: "JSON request required." }, 415, origin);
  }
  if (Number(request.headers.get("content-length") || "0") > 8192) {
    return respond({ ok: false, message: "Request is too large." }, 413, origin);
  }

  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return respond({ ok: false, message: "Invalid request." }, 400, origin); }

  if (clean(payload.website, 200)) {
    return respond({ ok: true, message: "Thank you. You are on the ACA interest list." }, 200, origin);
  }

  const firstName = clean(payload.firstName, 100);
  const lastName = clean(payload.lastName, 100);
  const email = clean(payload.email, 254).toLowerCase();
  const interest = clean(payload.interest, 120);
  const consent = payload.consent === true;
  const emailParts = email.split("@");
  const validEmail = emailParts.length === 2 && emailParts[0].length > 0 && emailParts[1].includes(".") && !email.includes(" ");

  if (!firstName || !lastName || !validEmail || !INTERESTS.has(interest) || !consent) {
    return respond({
      ok: false,
      message: "Please complete every required field with a valid email address.",
    }, 422, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = getSecretKey();
  if (!url || !key) {
    return respond({ ok: false, message: "The interest list is temporarily unavailable." }, 503, origin);
  }

  const stored = await fetch(`${url}/rest/v1/aca_interest_list?on_conflict=email`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email,
      interest_area: interest,
      consent: true,
      consent_version: "2026-08-22",
      source: "aca_website",
      last_submitted_at: new Date().toISOString(),
    }),
  });

  if (!stored.ok) {
    console.error("ACA database error", stored.status, await stored.text());
    return respond({ ok: false, message: "We could not save your request. Please try again." }, 500, origin);
  }

  const subscriber = (await stored.json())[0];
  // A fresh explicit form submission also records optional-update consent.
  // Enrollment, payment data, and historical test rows are never imported here.
  let updateSubscription: Record<string, unknown> | null = null;
  if (subscriber.status === "active") {
    const preferences = await fetch(`${url}/rest/v1/aca_update_subscriptions?on_conflict=email`, {
      method: "POST",
      headers: {"apikey": key, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation"},
      body: JSON.stringify({email,first_name:firstName,last_name:lastName,interest_area:interest,
        consent_at:new Date().toISOString(),source:"aca_website_explicit_opt_in",synced_at:null}),
    });
    if (!preferences.ok) return respond({ok:false,message:"We saved your interest, but could not save update preferences. Please try again."},503,origin);
    updateSubscription = (await preferences.json())[0];
  }
  const unsubscribeUrl = `https://checkout.aiconfidenceacademy.org/api/email/unsubscribe?token=${updateSubscription?.unsubscribe_token || subscriber.unsubscribe_token}`;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("ACA_FROM_EMAIL");
  let emailSent = false;

  if (resendKey && fromEmail && subscriber.status === "active" && updateSubscription?.status === "active" && !subscriber.confirmation_sent_at && !subscriber.newsletter_excluded) {
    const safeName = escapeHtml(firstName);
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Idempotency-Key": `aca-interest-welcome-${subscriber.id}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Welcome to the AI Confidence Academy interest list",
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#14213d;max-width:620px;margin:auto"><h1>Thank you, ${safeName}.</h1><p>You are now on the AI Confidence Academy interest list.</p><p>We will keep you informed as enrollment dates, learning opportunities, and Academy resources become available.</p><p><strong>People come first. AI is the tool. Confidence is the product.</strong></p><p>— AI Confidence Academy</p><p><a href="${unsubscribeUrl}">Unsubscribe from ACA updates</a></p></div>`,
        text: `Thank you, ${firstName}. You are now on the AI Confidence Academy interest list. We will keep you informed as enrollment dates, learning opportunities, and Academy resources become available. People come first. AI is the tool. Confidence is the product. Unsubscribe: ${unsubscribeUrl}`,
      }),
    });
    emailSent = sent.ok;
    if (sent.ok) {
      const receipt = await sent.json();
      await fetch(`${url}/rest/v1/aca_interest_list?id=eq.${subscriber.id}`, {
        method: "PATCH",
        headers: {"apikey": key, "Content-Type": "application/json"},
        body: JSON.stringify({confirmation_sent_at: new Date().toISOString(), resend_email_id: receipt.id}),
      });
    }
    if (!sent.ok) console.error("ACA Resend error", sent.status, await sent.text());
  }

  return respond({
    ok: true,
    message: "Thank you. You are on the ACA interest list.",
    emailSent,
  }, 200, origin);
});
