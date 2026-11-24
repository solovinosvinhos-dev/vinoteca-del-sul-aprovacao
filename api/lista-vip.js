import { isIP } from "node:net";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const consentVersion = "vinoteca-lista-vip-2026-11-24";

function normalize(body) {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const raw = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = raw.replace(/\D/g, "");
  if (
    !uuid.test(body.idempotency_key) ||
    name.length < 2 ||
    name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !/^[\d()+.\s-]+$/.test(raw) ||
    !/^[1-9]\d\d{8,9}$/.test(phone) ||
    typeof body.whatsapp_opt_in !== "boolean" ||
    typeof body.email_opt_in !== "boolean"
  )
    return null;
  return {
    idempotency_key: body.idempotency_key,
    name,
    email,
    phone: "+55" + phone,
    whatsapp_opt_in: body.whatsapp_opt_in,
    email_opt_in: body.email_opt_in,
    consent_version: consentVersion,
  };
}

const gateway = "https://qrwfkpczlndcgzglhcke.supabase.co/functions/v1/vinoteca-lista-vip";
const publicOrigin =
  process.env.VINOTECA_PUBLIC_ORIGIN || "https://vinoteca-del-sul-aprovacao.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status, data) => res.status(status).json(data);
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return send(405, { error: "method" });
  }
  const live =
    process.env.VERCEL_ENV === "production" && "https://" + req.headers.host === publicOrigin;
  if (!live)
    return req.method === "GET" ? send(200, { mode: "preview" }) : send(403, { error: "preview" });
  const oidc = req.headers["x-vercel-oidc-token"];
  if (typeof oidc !== "string" || !oidc) return send(503, { error: "unavailable" });
  const gatewayKey = process.env.VINOTECA_SUPABASE_PUBLISHABLE_KEY;
  if (!gatewayKey?.startsWith("sb_publishable_")) return send(503, { error: "unavailable" });
  const headers = { apikey: gatewayKey, "x-vinoteca-identity": oidc };
  let body;
  if (req.method === "POST") {
    if (req.headers.origin !== publicOrigin) return send(403, { error: "origin" });
    if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json")
      return send(415, { error: "content_type" });
    if (Number(req.headers["content-length"]) > 4096) return send(413, { error: "size" });
    let fields;
    try {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (!raw || Buffer.byteLength(raw) > 4096) return send(413, { error: "size" });
      fields = JSON.parse(raw);
    } catch {
      return send(400, { error: "input" });
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields) || fields.website)
      return send(422, { error: "input" });
    const submission = normalize(fields);
    if (!submission) return send(422, { error: "input" });
    const ip = req.headers["x-vercel-forwarded-for"]?.split(",")[0].trim();
    if (!isIP(ip ?? "")) return send(503, { error: "unavailable" });
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ submission: { ...submission, origin_url: publicOrigin }, ip });
  }
  try {
    const response = await fetch(gateway, {
      method: req.method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(11000),
    });
    const answer = await response.json();
    if (response.ok && answer?.ok === true)
      return send(200, req.method === "GET" ? { mode: "live" } : { ok: true });
    if (response.status === 409 && answer?.error === "review")
      return send(409, { error: "review" });
    if (response.status === 429) return send(429, { error: "limit" });
    return send(503, { error: "unavailable" });
  } catch {
    return send(503, { error: "unavailable" });
  }
}
