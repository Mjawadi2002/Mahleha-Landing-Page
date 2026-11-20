// Vercel serverless function: POST /api/contact
// Sends the agency enquiry to the Mahleha team, then a confirmation to the sender.
// SMTP settings come from Vercel environment variables, never from the code:
//   SMTP_USER, SMTP_PASS (required), SMTP_HOST (default smtp.gmail.com),
//   SMTP_PORT (default 465), CONTACT_TO (default SMTP_USER).
import nodemailer from 'nodemailer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hits = new Map(); // best-effort rate limit, per warm instance

const one = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shell(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#f6eee2;font-family:Arial,Helvetica,sans-serif;color:#0b1a2a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6eee2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0b1a2a;padding:22px 28px;color:#f6eee2;font-family:Georgia,serif;font-size:22px;font-weight:bold">Mahleha
<div style="font-family:Arial,sans-serif;font-size:12px;font-weight:normal;color:#6fd8bf;margin-top:4px">Discover Tunisia. Feel the Local Life.</div></td></tr>
<tr><td style="padding:28px">
<h1 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;margin:0 0 14px">${title}</h1>
${inner}
</td></tr></table></td></tr></table></body></html>`;
}

const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7680;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:15px">${esc(v)}</td></tr>`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  // honeypot: real visitors never see or fill this field
  if (b.website) return res.status(200).json({ ok: true, confirm: true });

  const name = one(b.name, 120);
  const agency = one(b.agency, 160);
  const city = one(b.city, 120);
  const email = one(b.email, 200);
  const message = String(b.message ?? '').trim().slice(0, 4000);
  const lang = b.lang === 'el' ? 'el' : 'en';
  if (!name || !agency || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'invalid' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, error: 'rate' });
  recent.push(now); hits.set(ip, recent);

  const { SMTP_HOST = 'smtp.gmail.com', SMTP_PORT = '465', SMTP_USER, SMTP_PASS, CONTACT_TO } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return res.status(500).json({ ok: false, error: 'config' });
  const port = Number(SMTP_PORT);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  const team = CONTACT_TO || SMTP_USER;

  // 1. the enquiry, to the team; "Reply" goes straight to the agency
  const teamText = [`Name: ${name}`, `Agency: ${agency}`, city && `City: ${city}`, `Email: ${email}`, `Language: ${lang}`, message && `\n${message}`].filter(Boolean).join('\n');
  try {
    await transport.sendMail({
      from: { name: 'Mahleha website', address: SMTP_USER },
      to: team,
      replyTo: { name, address: email },
      subject: `New agency enquiry: ${agency}`,
      text: teamText,
      html: shell('New request for a presentation',
        `<table role="presentation" cellpadding="0" cellspacing="0">${row('Name', name)}${row('Agency', agency)}${city ? row('City', city) : ''}${row('Email', email)}${row('Language', lang === 'el' ? 'Greek' : 'English')}</table>`
        + (message ? `<div style="margin-top:18px;padding:16px;border-radius:12px;background:#f7f2e8;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(message)}</div>` : '')
        + `<p style="margin-top:20px;font-size:13px;color:#6b7680">Reply to this email to answer ${esc(name)} directly.</p>`),
    });
  } catch (err) {
    console.error('team mail failed', err?.code || err?.message);
    return res.status(502).json({ ok: false, error: 'send' });
  }

  // 2. confirmation to the sender. It does not repeat their free-text message,
  //    so the form cannot be used to send arbitrary text to someone else.
  const C = lang === 'el'
    ? { subject: 'Λάβαμε το αίτημά σας · Mahleha', title: `Ευχαριστούμε, ${name}.`,
        body: `Το αίτημά σας για παρουσίαση για το γραφείο <b>${esc(agency)}</b> έφτασε στην ομάδα της Mahleha. Θα σας απαντήσουμε σε αυτή τη διεύθυνση.`,
        foot: 'Αν δεν στείλατε εσείς αυτό το αίτημα, αγνοήστε αυτό το μήνυμα.' }
    : { subject: 'We received your request · Mahleha', title: `Thank you, ${name}.`,
        body: `Your request for a presentation for <b>${esc(agency)}</b> has reached the Mahleha team. We will reply to this address.`,
        foot: 'If you did not send this request, you can ignore this email.' };
  let confirm = true;
  try {
    await transport.sendMail({
      from: { name: 'Mahleha', address: SMTP_USER },
      to: email,
      replyTo: team,
      subject: C.subject,
      text: `${C.title}\n\n${C.body.replace(/<[^>]+>/g, '')}\n\n${C.foot}`,
      html: shell(esc(C.title), `<p style="font-size:15px;line-height:1.6;margin:0">${C.body}</p><p style="margin-top:22px;font-size:12px;color:#6b7680">${C.foot}</p>`),
    });
  } catch (err) {
    console.error('confirmation failed', err?.code || err?.message);
    confirm = false;
  }
  return res.status(200).json({ ok: true, confirm });
}
