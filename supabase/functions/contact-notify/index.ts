// =========================================================
// KLYR — contact form emails (Supabase Edge Function)
//
// Called by a database trigger whenever a new row lands in
// `contact_messages`. Sends, through Gmail SMTP:
//   1. a notification to the website owner (Reply-To = the sender)
//   2. an automatic acknowledgement to the person who asked
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GMAIL_USER          – the Gmail address that sends the emails
//   GMAIL_APP_PASSWORD  – a 16-character Google "app password" (not your normal password)
//   OWNER_EMAIL         – optional; where notifications go (defaults to GMAIL_USER)
//   WEBHOOK_SECRET      – shared with the database trigger (stored in Vault there)
//   SITE_URL            – optional
// Deploy with JWT verification off (the trigger authenticates with WEBHOOK_SECRET).
// =========================================================
import nodemailer from "npm:nodemailer@6.9.16";

const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = (Deno.env.get("GMAIL_APP_PASSWORD") ?? "").replace(/\s+/g, "");
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") || GMAIL_USER;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://rohanvivek-tech.github.io/KLYR/";

const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

function shell(inner: string): string {
  return `<div style="margin:0;padding:0;background:#f7f8f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f9;padding:40px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #e6e9ec;border-radius:20px;">
        <tr><td style="padding:32px 36px 4px;"><p style="margin:0;font-size:18px;font-weight:600;letter-spacing:4px;color:#0e1012;">&#9679; KLYR</p></td></tr>
        ${inner}
        <tr><td style="padding:20px 36px;border-top:1px solid #e6e9ec;"><p style="margin:0;font-size:12px;line-height:1.6;color:#9aa2a8;">KLYR Protein Water &middot; Protein, minus the shake. &middot; Bengaluru, India</p></td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function quote(message: string): string {
  return `<div style="margin:0;padding:16px 18px;background:#f7f8f9;border-radius:12px;font-size:15px;line-height:1.6;color:#2b2f33;white-space:pre-wrap;">${esc(message)}</div>`;
}

function ownerEmail(r: { id: number; name: string; email: string; message: string; created_at: string }) {
  const when = new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  return {
    subject: `New question from ${oneLine(r.name)} (KLYR website)`,
    html: shell(`
        <tr><td style="padding:22px 36px 0;">
          <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:500;letter-spacing:-.5px;color:#0e1012;">New question from the website</h1>
          <p style="margin:12px 0 18px;font-size:15px;line-height:1.6;color:#6b7278;">
            <b style="color:#0e1012;">${esc(r.name)}</b> &lt;${esc(r.email)}&gt;<br>${esc(when)} IST &middot; message #${r.id}
          </p>
          ${quote(r.message)}
          <p style="margin:18px 0 28px;font-size:14px;line-height:1.6;color:#6b7278;">Just hit <b>Reply</b> to answer them directly. They've already received an automatic confirmation.</p>
        </td></tr>`),
    text: `New question from ${r.name} <${r.email}>\n${when} IST · message #${r.id}\n\n${r.message}\n\nReply to this email to answer them directly.`,
  };
}

function replyEmail(r: { name: string; message: string }) {
  const first = oneLine(r.name).split(" ")[0].slice(0, 40);
  return {
    subject: "We got your question — KLYR",
    html: shell(`
        <tr><td style="padding:22px 36px 0;">
          <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:500;letter-spacing:-.8px;color:#0e1012;">Thanks${first ? `, ${esc(first)}` : ""}. We got your question.</h1>
          <p style="margin:14px 0 18px;font-size:16px;line-height:1.6;color:#6b7278;">This is an automatic confirmation. The KLYR team will reply to you personally soon. Here's a copy of what you sent:</p>
          ${quote(r.message)}
        </td></tr>
        <tr><td style="padding:26px 36px 8px;">
          <a href="${SITE_URL}" style="display:inline-block;background:#0e1012;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:13px 26px;border-radius:999px;">Visit KLYR</a>
        </td></tr>
        <tr><td style="padding:14px 36px 28px;"><p style="margin:0;font-size:13px;line-height:1.6;color:#9aa2a8;">If you didn't send this message, you can ignore this email.</p></td></tr>`),
    text: `Thanks${first ? `, ${first}` : ""}. We got your question.\n\nThis is an automatic confirmation — the KLYR team will reply to you personally soon.\n\nYou wrote:\n${r.message}\n\n${SITE_URL}`,
  };
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER / GMAIL_APP_PASSWORD not set");
    return new Response("Email not configured", { status: 500 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }
  if (payload?.type !== "INSERT" || payload?.table !== "contact_messages") return new Response("Ignored", { status: 200 });

  const r = payload.record ?? {};
  const record = {
    id: Number(r.id) || 0,
    name: String(r.name ?? "").slice(0, 120),
    email: String(r.email ?? "").trim(),
    message: String(r.message ?? "").slice(0, 2000),
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return new Response("Invalid email", { status: 400 });

  const from = `"KLYR" <${GMAIL_USER}>`;
  const owner = ownerEmail(record);
  const reply = replyEmail(record);

  const results = await Promise.allSettled([
    transporter.sendMail({ from, to: OWNER_EMAIL, replyTo: record.email, subject: owner.subject, html: owner.html, text: owner.text }),
    transporter.sendMail({ from, to: record.email, replyTo: OWNER_EMAIL, subject: reply.subject, html: reply.html, text: reply.text }),
  ]);
  const failed = results.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
  failed.forEach((f) => console.error("Send failed:", f.reason?.message ?? f.reason));
  console.log(`contact #${record.id}: owner=${results[0].status} reply=${results[1].status}`);

  return new Response(failed.length ? "Partly failed" : "Sent", { status: failed.length ? 502 : 200 });
});
