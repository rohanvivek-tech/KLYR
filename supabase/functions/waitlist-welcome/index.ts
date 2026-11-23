// =========================================================
// KLYR — waitlist welcome email (Supabase Edge Function)
//
// A Database Webhook calls this function every time a new row is added
// to the `waitlist` table. It sends a welcome email through Resend.
//
// Secrets it needs (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   – from resend.com → API Keys
//   WEBHOOK_SECRET   – any long random text; the same value goes in the webhook's
//                      "x-webhook-secret" header so nobody else can trigger emails
//   EMAIL_FROM       – optional, e.g. "KLYR <hello@klyr.in>" once your domain is verified
//   SITE_URL         – optional, defaults to the GitHub Pages address
// =========================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "KLYR <onboarding@resend.dev>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://rohanvivek-tech.github.io/KLYR/";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function firstName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.trim().split(/\s+/)[0].slice(0, 40);
}

function welcomeHtml(name: string): string {
  const hello = name ? `You're on the list, ${escapeHtml(name)}.` : "You're on the list.";
  return `<div style="margin:0;padding:0;background:#f7f8f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f9;padding:40px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e9ec;border-radius:20px;">
        <tr><td style="padding:36px 36px 8px;">
          <p style="margin:0;font-size:18px;font-weight:600;letter-spacing:4px;color:#0e1012;">&#9679; KLYR</p>
        </td></tr>
        <tr><td style="padding:24px 36px 0;">
          <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:500;letter-spacing:-1px;color:#0e1012;">${hello}</h1>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#6b7278;">
            Thanks for joining the KLYR waitlist. Something refreshing is on the way, and you'll be among the first to hear when we launch in Bengaluru.
          </p>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#6b7278;">Protein, minus the shake.</p>
        </td></tr>
        <tr><td style="padding:28px 36px 8px;">
          <a href="${SITE_URL}" style="display:inline-block;background:#0e1012;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:14px 28px;border-radius:999px;">Visit KLYR</a>
        </td></tr>
        <tr><td style="padding:16px 36px 32px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#9aa2a8;">
            If you didn't sign up for the KLYR waitlist, you can ignore this email. We won't contact you again unless you join.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #e6e9ec;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa2a8;">KLYR Protein Water &middot; Bengaluru, India</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function welcomeText(name: string): string {
  return [
    name ? `You're on the list, ${name}.` : "You're on the list.",
    "",
    "Thanks for joining the KLYR waitlist. Something refreshing is on the way, and you'll be among the first to hear when we launch in Bengaluru.",
    "",
    "Protein, minus the shake.",
    SITE_URL,
    "",
    "If you didn't sign up for the KLYR waitlist, you can ignore this email.",
  ].join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Only our own Database Webhook knows this secret.
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return new Response("Email not configured", { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Only react to new waitlist rows.
  if (payload?.type !== "INSERT" || payload?.table !== "waitlist") {
    return new Response("Ignored", { status: 200 });
  }

  const email = typeof payload.record?.email === "string" ? payload.record.email.trim() : "";
  if (!email || !email.includes("@")) return new Response("No email", { status: 400 });
  const name = firstName(payload.record?.name);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: "You're on the KLYR waitlist",
      html: welcomeHtml(name),
      text: welcomeText(name),
    }),
  });

  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return new Response("Email failed", { status: 502 });
  }
  return new Response("Sent", { status: 200 });
});
