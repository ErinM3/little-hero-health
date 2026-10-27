// Little Hero Health · Events and tickets (Cloudflare Worker)
// Luma-style events: staff add events, families get tickets with QR codes,
// Square checkout for paid tickets, and staff check-in.
//
// Cloudflare setup (see HOW-TO-SET-UP-LHH-EVENTS.txt):
//   KV namespace binding:  LHH
//   Variables (Text):      SITE_URL, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, SQUARE_LOCATION_ID, SQUARE_ENV
//   Secrets:               SESSION_SECRET, STAFF_KEYS, DISCORD_CLIENT_SECRET, DISCORD_TOKEN,
//                          SQUARE_ACCESS_TOKEN, SQUARE_WEBHOOK_KEY (optional)
const DISCORD = "https://discord.com/api/v10";
const STAFF_ROLE = /lhh official|moderator|admin|owner|hero team/i;
const HOLD_MINUTES = 30;
const SQUARE_VERSION = "2025-01-23";

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const url = new URL(req.url);
    try {
      const r = await route(req, env, url);
      const h = new Headers(r.headers); for (const [k, v] of Object.entries(cors())) h.set(k, v);
      return new Response(r.body, { status: r.status, headers: h });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    }
  },
};

// ---------------- helpers ----------------
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const cors = () => ({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "content-type,authorization" });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const fail = (status, msg) => { throw new HttpError(status, msg); };
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uText = s => b64u(enc.encode(s));
const fromB64u = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
const ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const code = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPH[b % ALPH.length]).join("");
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const cleanText = (s, n) => String(s ?? "").replace(/\r/g, "").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const site = env => (env.SITE_URL || "").replace(/\/$/, "");
async function hmac(key, data) { const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(data)); }
function same(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function sign(env, obj) { if (!env.SESSION_SECRET) fail(500, "SESSION_SECRET is not set in Cloudflare."); const p = b64uText(JSON.stringify(obj)); return p + "." + b64u(await hmac(env.SESSION_SECRET, p)); }
async function unsign(env, tok) {
  if (!tok || !env.SESSION_SECRET) return null;
  const [p, s] = String(tok).split("."); if (!p || !s) return null;
  if (!same(s, b64u(await hmac(env.SESSION_SECRET, p)))) return null;
  try { const o = JSON.parse(fromB64u(p)); return o.exp && o.exp > Date.now() ? o : null; } catch { return null; }
}
async function staff(req, env) { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const s = await unsign(env, t); return s && s.k === "staff" ? s : null; }
async function needStaff(req, env) { const s = await staff(req, env); if (!s) fail(401, "Please sign in as Little Hero staff."); return s; }
const kv = env => { if (!env.LHH) fail(500, "The LHH storage (KV binding) is not set up in Cloudflare yet."); return env.LHH; };
const getJ = async (env, k) => { const v = await kv(env).get(k); return v ? JSON.parse(v) : null; };
const putJ = (env, k, v) => kv(env).put(k, JSON.stringify(v));
async function body(req) { try { return await req.json(); } catch { fail(400, "That request was not readable."); } }

// ---------------- events ----------------
const PALETTE = ["#1F5FAD", "#0A2A6B", "#5AAEFF", "#FFD21F", "#E0B800"];
const EMOJI = ["🏥", "🦸", "🩺", "🚑", "⭐", "🎉", "🧸", "❤️", "🎪", "🏫", "🎮", "🌈"];
function publicEvent(e, counts, isStaff) {
  const out = { id: e.id, title: e.title, start: e.start, end: e.end, tz: e.tz, online: e.online, city: e.city, about: e.about, emoji: e.emoji, color: e.color,
    price: e.price, capacity: e.capacity, maxPerOrder: e.maxPerOrder, ages: e.ages, host: e.host, published: e.published, status: e.status || "active",
    spotsLeft: e.capacity ? Math.max(0, e.capacity - counts.held) : null, going: counts.going };
  if (!e.hideAddress || isStaff) out.place = e.place;
  out.hideAddress = !!e.hideAddress;
  if (isStaff) { out.createdBy = e.createdBy; out.sold = counts.sold; out.checkedIn = counts.checkedIn; out.revenue = counts.revenue; }
  return out;
}
async function ticketsFor(env, eventId) { const ids = (await getJ(env, "evt:" + eventId)) || []; return (await Promise.all(ids.map(id => getJ(env, "t:" + id)))).filter(Boolean); }
function countTickets(list) {
  const now = Date.now(); let held = 0, going = 0, sold = 0, checkedIn = 0, revenue = 0;
  for (const t of list) {
    const live = t.status === "paid" || t.status === "free";
    const pending = t.status === "pending" && now - t.created < HOLD_MINUTES * 60000;
    if (live || pending) held += t.qty;
    if (live) { going += t.qty; sold += t.qty; revenue += t.paidCents || 0; }
    if (t.checkedIn) checkedIn += t.qty;
  }
  return { held, going, sold, checkedIn, revenue };
}
function validEvent(b, old) {
  const e = { ...(old || {}) };
  e.title = clean(b.title, 80); if (e.title.length < 3) fail(400, "Give the event a title.");
  const s = new Date(b.start), en = new Date(b.end || b.start);
  if (isNaN(s)) fail(400, "Pick a start date and time.");
  e.start = s.toISOString(); e.end = (isNaN(en) || en < s ? new Date(s.getTime() + 2 * 3600000) : en).toISOString();
  e.tz = clean(b.tz, 60) || "America/Chicago";
  e.online = !!b.online; e.place = clean(b.place, 200); e.city = clean(b.city, 80); e.hideAddress = b.hideAddress !== false;
  e.about = cleanText(b.about, 3000); e.ages = clean(b.ages, 40); e.host = clean(b.host, 60) || "Little Hero Health";
  e.emoji = EMOJI.includes(b.emoji) ? b.emoji : "🏥"; e.color = PALETTE.includes(b.color) ? b.color : "#1F5FAD";
  e.capacity = Math.max(0, Math.min(5000, parseInt(b.capacity) || 0));
  e.price = Math.max(0, Math.min(100000, Math.round(Number(b.price) || 0)));
  if (e.price > 0 && e.price < 100) fail(400, "Paid tickets must be at least $1.00.");
  e.maxPerOrder = Math.max(1, Math.min(10, parseInt(b.maxPerOrder) || 6));
  e.published = b.published !== false; e.status = b.status === "cancelled" ? "cancelled" : "active";
  return e;
}

// ---------------- Square ----------------
const sqBase = env => env.SQUARE_ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
async function square(env, method, path, b) {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) fail(503, "Paid tickets aren't switched on yet. Please check back soon!");
  const r = await fetch(sqBase(env) + path, { method, headers: { Authorization: "Bearer " + env.SQUARE_ACCESS_TOKEN, "Square-Version": SQUARE_VERSION, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail(502, "Square said: " + ((j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || r.status));
  return j;
}
async function refreshPaid(env, t) {
  if (t.status !== "pending" || !t.orderId) return t;
  const { order } = await square(env, "GET", "/v2/orders/" + t.orderId);
  const due = order && order.net_amount_due_money ? order.net_amount_due_money.amount : null;
  const tendered = (order && order.tenders || []).length > 0;
  if (order && order.state !== "CANCELED" && (order.state === "COMPLETED" || (tendered && (due === null || due === 0)))) {
    t.status = "paid"; t.paidAt = Date.now(); t.paidCents = (order.total_money && order.total_money.amount) || t.totalCents; await putJ(env, "t:" + t.id, t);
  }
  return t;
}

// ---------------- routes ----------------
async function route(req, env, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/", m = req.method;
  let r;
  if (p === "/") return new Response("Little Hero Health events are running. 🎟️", { headers: { "content-type": "text/plain; charset=utf-8" } });

  // --- staff sign-in: key ---
  if (p === "/api/login" && m === "POST") {
    const { key } = await body(req); const k = clean(key, 80).toUpperCase();
    const list = String(env.STAFF_KEYS || "").split(",").map(x => x.trim()).filter(Boolean).map(x => { const i = x.lastIndexOf(":"); return { name: x.slice(0, i).trim(), key: x.slice(i + 1).trim().toUpperCase() }; });
    const hit = k && list.find(x => x.key && same(x.key, k));
    if (!hit) { await new Promise(res => setTimeout(res, 600)); fail(401, "That staff key isn't right."); }
    return json({ session: await sign(env, { k: "staff", name: hit.name || "Staff", via: "key", exp: Date.now() + 12 * 3600000 }), name: hit.name });
  }
  // --- staff sign-in: Discord ---
  if (p === "/auth/discord" && m === "GET") {
    if (!env.DISCORD_CLIENT_ID) fail(503, "Discord sign-in isn't set up yet.");
    const state = await sign(env, { k: "state", exp: Date.now() + 600000 });
    const q = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: url.origin + "/auth/discord/callback", response_type: "code", scope: "identify guilds.members.read", state });
    return Response.redirect("https://discord.com/oauth2/authorize?" + q, 302);
  }
  if (p === "/auth/discord/callback" && m === "GET") {
    const back = (msg, session) => Response.redirect(site(env) + "/events.html#/staff" + (session ? "?session=" + encodeURIComponent(session) : "?error=" + encodeURIComponent(msg)), 302);
    const st = await unsign(env, url.searchParams.get("state"));
    if (!st || st.k !== "state") return back("That sign-in link expired. Please try again.");
    const codeParam = url.searchParams.get("code"); if (!codeParam) return back("Discord sign-in was cancelled.");
    const tr = await fetch(DISCORD + "/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET || "", grant_type: "authorization_code", code: codeParam, redirect_uri: url.origin + "/auth/discord/callback" }) });
    const tok = await tr.json().catch(() => ({})); if (!tok.access_token) return back("Discord sign-in didn't work. Please try again.");
    const mr = await fetch(`${DISCORD}/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, { headers: { Authorization: "Bearer " + tok.access_token } });
    if (!mr.ok) return back("You need to be in the Little Hero Discord server to sign in.");
    const mem = await mr.json();
    const bot = { headers: { Authorization: "Bot " + env.DISCORD_TOKEN } };
    const [roles, guild] = await Promise.all([fetch(`${DISCORD}/guilds/${env.DISCORD_GUILD_ID}/roles`, bot).then(r => r.ok ? r.json() : []), fetch(`${DISCORD}/guilds/${env.DISCORD_GUILD_ID}`, bot).then(r => r.ok ? r.json() : {})]);
    const names = roles.filter(r => (mem.roles || []).includes(r.id)).map(r => r.name);
    const isOwner = guild.owner_id && mem.user && guild.owner_id === mem.user.id;
    const ok = isOwner || names.some(n => STAFF_ROLE.test(n));
    if (!ok) return back("Only LHH Official, Moderators, Admins and the Owner can add events.");
    const name = mem.nick || (mem.user && (mem.user.global_name || mem.user.username)) || "Staff";
    return back(null, await sign(env, { k: "staff", name, via: "discord", role: isOwner ? "Owner" : (names.find(n => STAFF_ROLE.test(n)) || "Staff"), exp: Date.now() + 12 * 3600000 }));
  }
  if (p === "/api/me") { const s = await needStaff(req, env); return json({ name: s.name, role: s.role || "Staff", via: s.via }); }

  // --- events ---
  if (p === "/api/events" && m === "GET") {
    const isStaff = !!(await staff(req, env));
    const ids = (await getJ(env, "events")) || [];
    const evs = (await Promise.all(ids.map(id => getJ(env, "e:" + id)))).filter(Boolean).filter(e => !e.deleted);
    const shown = evs.filter(e => isStaff || (e.published && new Date(e.end).getTime() > Date.now() - 86400000));
    const out = await Promise.all(shown.map(async e => publicEvent(e, countTickets(await ticketsFor(env, e.id)), isStaff)));
    out.sort((a, b) => new Date(a.start) - new Date(b.start));
    return json({ events: out });
  }
  if (p === "/api/events" && m === "POST") {
    const s = await needStaff(req, env); const b = await body(req);
    let old = null; if (b.id) { old = await getJ(env, "e:" + clean(b.id, 20)); if (!old) fail(404, "That event doesn't exist."); }
    const e = validEvent(b, old);
    if (!old) { e.id = code(6); e.created = Date.now(); e.createdBy = s.name; const ids = (await getJ(env, "events")) || []; ids.push(e.id); await putJ(env, "events", ids); }
    e.updated = Date.now(); e.updatedBy = s.name;
    await putJ(env, "e:" + e.id, e);
    return json({ event: publicEvent(e, countTickets(await ticketsFor(env, e.id)), true) });
  }
  if ((r = p.match(/^\/api\/events\/([A-Z0-9]{6})$/))) {
    const e = await getJ(env, "e:" + r[1]); if (!e || e.deleted) fail(404, "We couldn't find that event.");
    const s = await staff(req, env);
    if (m === "DELETE") { await needStaff(req, env); e.deleted = true; e.updatedBy = s.name; await putJ(env, "e:" + e.id, e); return json({ ok: true }); }
    if (!e.published && !s) fail(404, "We couldn't find that event.");
    return json({ event: publicEvent(e, countTickets(await ticketsFor(env, e.id)), !!s) });
  }
  if ((r = p.match(/^\/api\/events\/([A-Z0-9]{6})\/guests$/))) {
    await needStaff(req, env);
    const list = await ticketsFor(env, r[1]);
    return json({ guests: list.sort((a, b) => b.created - a.created).map(t => ({ id: t.id, parent: t.parent, email: t.email, qty: t.qty, heroes: t.heroes, status: t.status === "pending" && Date.now() - t.created >= HOLD_MINUTES * 60000 ? "expired" : t.status, checkedIn: t.checkedIn || false, created: t.created, paidCents: t.paidCents || 0 })) });
  }

  // --- get a ticket ---
  if ((r = p.match(/^\/api\/events\/([A-Z0-9]{6})\/tickets$/)) && m === "POST") {
    const e = await getJ(env, "e:" + r[1]); if (!e || e.deleted || !e.published) fail(404, "We couldn't find that event.");
    if (e.status === "cancelled") fail(409, "This event was cancelled.");
    if (new Date(e.end).getTime() < Date.now()) fail(409, "This event has already finished.");
    const b = await body(req);
    const parent = clean(b.parent, 60), email = clean(b.email, 120).toLowerCase(), qty = parseInt(b.qty) || 1;
    if (parent.length < 2) fail(400, "Please type the parent or guardian's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, "Please type a real email address.");
    if (!b.agree) fail(400, "A parent or guardian needs to tick the box to agree.");
    if (qty < 1 || qty > e.maxPerOrder) fail(400, `You can get 1 to ${e.maxPerOrder} tickets at a time.`);
    const counts = countTickets(await ticketsFor(env, e.id));
    if (e.capacity && counts.held + qty > e.capacity) fail(409, counts.held >= e.capacity ? "Sorry, this event is full." : `Only ${e.capacity - counts.held} spot${e.capacity - counts.held === 1 ? "" : "s"} left.`);
    const t = { id: code(8), secret: code(10), eventId: e.id, parent, email, qty, heroes: clean(b.heroes, 200), photos: !!b.photos, status: e.price ? "pending" : "free", created: Date.now(), totalCents: e.price * qty };
    if (e.price) {
      const ret = new URL(req.url).origin + "/api/return?t=" + t.id + "." + t.secret;
      const link = await square(env, "POST", "/v2/online-checkout/payment-links", {
        idempotency_key: t.id + "-" + t.secret,
        quick_pay: { name: `${qty} × ${e.title} ticket${qty > 1 ? "s" : ""}`.slice(0, 255), price_money: { amount: e.price * qty, currency: "USD" }, location_id: env.SQUARE_LOCATION_ID },
        checkout_options: { redirect_url: ret, ask_for_shipping_address: false },
        pre_populated_data: { buyer_email: email },
        payment_note: `Little Hero ticket ${t.id}`,
      });
      t.orderId = link.payment_link.order_id; t.linkId = link.payment_link.id;
      await putJ(env, "order:" + t.orderId, t.id);
      await putJ(env, "t:" + t.id, t);
      const list = (await getJ(env, "evt:" + e.id)) || []; list.push(t.id); await putJ(env, "evt:" + e.id, list);
      return json({ pay: link.payment_link.url, ticket: t.id + "." + t.secret });
    }
    await putJ(env, "t:" + t.id, t);
    const list = (await getJ(env, "evt:" + e.id)) || []; list.push(t.id); await putJ(env, "evt:" + e.id, list);
    return json({ ticket: t.id + "." + t.secret });
  }
  if (p === "/api/return" && m === "GET") {
    const [id, sec] = String(url.searchParams.get("t") || "").split(".");
    const t = await getJ(env, "t:" + id);
    if (t && t.secret === sec) { try { await refreshPaid(env, t); } catch {} }
    return Response.redirect(site(env) + "/events.html#/t/" + encodeURIComponent(id + "." + sec), 302);
  }
  if ((r = p.match(/^\/api\/tickets\/([A-Z0-9]{8})$/)) && m === "GET") {
    let t = await getJ(env, "t:" + r[1]);
    if (!t || !same(t.secret, url.searchParams.get("s") || "")) fail(404, "We couldn't find that ticket.");
    if (t.status === "pending") { try { t = await refreshPaid(env, t); } catch {} }
    const e = await getJ(env, "e:" + t.eventId);
    const expired = t.status === "pending" && Date.now() - t.created >= HOLD_MINUTES * 60000;
    let pay = null;
    if (t.status === "pending" && !expired && t.linkId) { try { pay = (await square(env, "GET", "/v2/online-checkout/payment-links/" + t.linkId)).payment_link.url; } catch {} }
    return json({ ticket: { id: t.id, code: t.id + "." + t.secret, parent: t.parent, qty: t.qty, heroes: t.heroes, status: expired ? "expired" : t.status, checkedIn: !!t.checkedIn, totalCents: t.totalCents, pay }, event: e && !e.deleted ? publicEvent(e, countTickets(await ticketsFor(env, e.id)), true) : null });
  }
  if ((r = p.match(/^\/api\/tickets\/([A-Z0-9]{8})\/cancel$/)) && m === "POST") {
    const s = await needStaff(req, env); const t = await getJ(env, "t:" + r[1]); if (!t) fail(404, "We couldn't find that ticket.");
    t.status = "cancelled"; t.cancelledBy = s.name; await putJ(env, "t:" + t.id, t);
    return json({ ok: true, note: t.paidCents ? "Ticket cancelled. Refund the payment in your Square Dashboard → Transactions." : "Ticket cancelled." });
  }

  // --- check-in ---
  if (p === "/api/checkin" && m === "POST") {
    const s = await needStaff(req, env); const b = await body(req);
    const raw = clean(b.code, 60).toUpperCase().replace(/^LHH-T:/, "").replace(/[\s-]/g, "");
    const [id, sec] = raw.split(/[.:]/);
    const t = await getJ(env, "t:" + id);
    if (!t || (sec && !same(t.secret, sec))) fail(404, "That ticket code isn't valid.");
    if (b.eventId && t.eventId !== b.eventId) fail(409, "That ticket is for a different event.");
    if (t.status === "pending") { try { await refreshPaid(env, t); } catch {} }
    if (t.status === "cancelled") fail(409, "That ticket was cancelled.");
    if (t.status === "pending") fail(402, "That ticket hasn't been paid for yet.");
    const already = !!t.checkedIn;
    if (!already) { t.checkedIn = Date.now(); t.checkedInBy = s.name; await putJ(env, "t:" + t.id, t); }
    return json({ ok: true, already, parent: t.parent, qty: t.qty, heroes: t.heroes, photos: t.photos });
  }

  // --- Square webhook (optional: confirms payments even if the family closes the page) ---
  if (p === "/api/square/webhook" && m === "POST") {
    const raw = await req.text();
    if (env.SQUARE_WEBHOOK_KEY) {
      const want = btoa(String.fromCharCode(...new Uint8Array(await hmac(env.SQUARE_WEBHOOK_KEY, req.url + raw))));
      if (!same(want, req.headers.get("x-square-hmacsha256-signature") || "")) return new Response("bad signature", { status: 401 });
    }
    let ev = {}; try { ev = JSON.parse(raw); } catch {}
    const pay = ev.data && ev.data.object && ev.data.object.payment;
    if (pay && pay.order_id && pay.status === "COMPLETED") {
      const tid = await getJ(env, "order:" + pay.order_id);
      const t = tid && await getJ(env, "t:" + tid);
      if (t && t.status === "pending") { t.status = "paid"; t.paidAt = Date.now(); t.paidCents = (pay.amount_money && pay.amount_money.amount) || t.totalCents; await putJ(env, "t:" + t.id, t); }
    }
    return new Response("ok");
  }
  fail(404, "Not found.");
}
