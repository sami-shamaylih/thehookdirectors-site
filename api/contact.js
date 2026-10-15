// Vercel serverless function: emails website form submissions via Resend.
// Needs env var RESEND_API_KEY. Optional: MAIL_TO, MAIL_FROM.
const TO = process.env.MAIL_TO || "mrsirorb@gmail.com";
const FROM = process.env.MAIL_FROM || "The Hook Directors <sami@thehookdirectors.com>";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "not configured" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.website_hp) return res.status(200).json({ ok: true }); // honeypot

  const kind = b.kind === "career" ? "career" : "lead";
  const f = b.fields && typeof b.fields === "object" ? b.fields : {};
  const rows = Object.keys(f).slice(0, 20).map((k) => [clip(k, 40), clip(f[k], 2000)]).filter((r) => r[1].trim());
  if (!rows.length) return res.status(400).json({ ok: false, error: "empty" });

  const contact = clip(f.Contact || "", 200);
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;
  const who = clip(f.Name || "Someone", 80);
  const subject = kind === "career" ? "New crew application: " + who : "New project enquiry: " + who + (f.Brand ? " (" + clip(f.Brand, 80) + ")" : "");

  const html = '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5"><h2 style="margin:0 0 12px">' + esc(subject) + "</h2><table cellpadding=\"6\" style=\"border-collapse:collapse\">" +
    rows.map((r) => '<tr><td style="color:#666;vertical-align:top;white-space:nowrap">' + esc(r[0]) + '</td><td style="white-space:pre-wrap">' + esc(r[1]) + "</td></tr>").join("") + "</table></div>";
  const text = subject + "\n\n" + rows.map((r) => r[0] + ": " + r[1]).join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html, text, reply_to: replyTo }),
    });
    if (!r.ok) return res.status(502).json({ ok: false });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
};
