// Little Hero Bot · online + commands
// Turns on the green dot AND answers all the slash commands (/warn, /timeout, /kick,
// /ban, /clear, /apply, /rules, /play, Report to moderators) while this window is open.
// No Cloudflare needed. (If you ever connect Cloudflare, it takes over the commands.)
// Run:  caffeinate -i node ~/Desktop/little-hero-online.mjs
//   (caffeinate stops your Mac from sleeping while it runs)
import readline from "node:readline/promises";
// ---- Little Hero Bot commands (same as the Cloudflare version) ----
// Moderation (/warn /timeout /untimeout /kick /ban /clear), "Report to moderators",
// team applications (/apply with Accept / Deny), /rules and /play.
// Settings needed in Cloudflare (Settings → Variables and Secrets):
//   DISCORD_TOKEN (secret), DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID
const API = process.env.LHH_API || "https://discord.com/api/v10";
const SITE = "https://be-the-doc.netlify.app";
const BLUE = 0x1F5FAD, SUN = 0xFFD21F, NIGHT = 0x0A2A6B;
const EPHEMERAL = 64;
const PERM = { ADMIN: 1n << 3n, MANAGE_ROLES: 1n << 28n };
const TEAM = { admin: "⭐ Admin", moderator: "🛡️ Moderator" };

// ---------- Discord plumbing ----------
const json = o => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
const reply = (content, eph = true, extra = {}) => json({ type: 4, data: { content, flags: eph ? EPHEMERAL : 0, allowed_mentions: { parse: [] }, ...extra } });
const hexToBytes = h => new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16)));
async function verify(req, body, pk) {
  const sig = req.headers.get("x-signature-ed25519"), ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts || !pk) return false;
  try {
    let key;
    try { key = await crypto.subtle.importKey("raw", hexToBytes(pk), { name: "Ed25519" }, false, ["verify"]); }
    catch { key = await crypto.subtle.importKey("raw", hexToBytes(pk), { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]); }
    return await crypto.subtle.verify(key.algorithm, key, hexToBytes(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}
async function api(env, method, path, body, reason) {
  const headers = { Authorization: "Bot " + env.DISCORD_TOKEN, "User-Agent": "LittleHeroBot (" + SITE + ", 1.0)" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(reason.slice(0, 400));
  const r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) { const e = new Error((j && j.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }
  return j;
}
// Deferred replies: answer Discord inside 3 seconds, then finish the work.
function later(i, env, ctx, work, eph = true) {
  ctx.waitUntil((async () => {
    if (env.__ready) await env.__ready;
    let msg;
    try { msg = await work(); } catch (e) { msg = { content: friendlyError(e) }; }
    if (typeof msg === "string") msg = { content: msg };
    await api(env, "PATCH", `/webhooks/${env.DISCORD_APPLICATION_ID}/${i.token}/messages/@original`, { allowed_mentions: { parse: [] }, ...msg }).catch(() => {});
  })());
  return json({ type: 5, data: { flags: eph ? EPHEMERAL : 0 } });
}
function friendlyError(e) {
  if (e.status === 403) return "⚠️ I don't have permission to do that. In Server Settings → Roles, drag **Little Hero Bot** above the roles of the person you're moderating.";
  if (e.status === 404) return "⚠️ I couldn't find that person or message. They may have left the server.";
  return "⚠️ That didn't work: " + e.message;
}
const opt = (i, name) => (i.data.options || []).find(o => o.name === name)?.value;
const who = u => u ? `<@${u.id}> (${u.global_name || u.username})` : "someone";
const perms = i => BigInt(i.member?.permissions || "0");

const chanCache = new Map(), roleCache = new Map();
async function channelByName(env, gid, name) {
  const key = gid + ":" + name;
  if (chanCache.has(key)) return chanCache.get(key);
  const list = await api(env, "GET", `/guilds/${gid}/channels`);
  const c = list.find(x => x.name === name && x.type === 0);
  if (c) chanCache.set(key, c.id);
  return c ? c.id : null;
}
async function roleByName(env, gid, name) {
  const key = gid + ":" + name;
  if (roleCache.has(key)) return roleCache.get(key);
  const list = await api(env, "GET", `/guilds/${gid}/roles`);
  const r = list.find(x => x.name === name);
  if (r) roleCache.set(key, r.id);
  return r ? r.id : null;
}
async function modLog(env, gid, embed, components) {
  const ch = await channelByName(env, gid, "mod-log");
  if (ch) await api(env, "POST", `/channels/${ch}/messages`, { embeds: [embed], components, allowed_mentions: { parse: [] } });
}
async function dm(env, userId, content) {
  try { const c = await api(env, "POST", "/users/@me/channels", { recipient_id: userId }); await api(env, "POST", `/channels/${c.id}/messages`, { content }); return true; }
  catch { return false; }
}
const logEmbed = (title, color, i, target, reason, extra = []) => ({
  title, color,
  fields: [{ name: "Hero", value: who(target), inline: true }, { name: "Moderator", value: who(i.member.user), inline: true }, { name: "Reason", value: reason || "No reason given" }, ...extra],
  timestamp: new Date().toISOString(), footer: { text: "Little Hero Bot" },
});

// ---------- Commands ----------
async function route(i, env, ctx) {
  if (!i.guild_id) return reply("Please use me inside the Little Hero server. 🦸");
  const gid = i.guild_id, name = i.data?.name, me = i.member?.user;

  if (i.type === 2 && i.data.type === 3 && name === "Report to moderators") {
    const m = i.data.resolved.messages[i.data.target_id];
    return later(i, env, ctx, async () => {
      await modLog(env, gid, { title: "🚩 Message reported", color: SUN, description: (m.content || "(no text: maybe an image or embed)").slice(0, 1000),
        fields: [{ name: "Posted by", value: who(m.author), inline: true }, { name: "Reported by", value: who(me), inline: true }, { name: "Jump to it", value: `https://discord.com/channels/${gid}/${m.channel_id}/${m.id}` }],
        timestamp: new Date().toISOString(), footer: { text: "Little Hero Bot · Report" } });
      return "✅ Thanks for telling us, hero. A moderator will check it soon. If you ever feel unsafe, tell a grown-up too.";
    });
  }

  if (i.type === 2) {
    const target = i.data.resolved?.users?.[opt(i, "user")];
    const reason = (opt(i, "reason") || "").toString();
    if (target && (target.id === me.id)) return reply("You can't use that on yourself. 🙂");
    if (target && target.bot) return reply("That's a bot, so I'll leave it alone.");

    switch (name) {
      case "rules": return reply(`📜 **The Hero Code**\n1. Be kind\n2. Stay safe: never share your real name, school, address, phone or face photos\n3. Hero names only\n4. No stranger DMs. Tell a @Moderator if anyone makes you uncomfortable\n5. Keep it clean\n6. No spam, selling or server codes\n7. Right channel, right topic\n8. You must be 13+ and follow Discord's rules\nRead them all in #rules. 🦸`);
      case "play": return reply(`🩹 **Play Little Hero:** ${SITE}\n🎬 New? Watch the 2-minute how-to video on the home page.\n🏥 Build your own hospital in the Workstation → My Hospital.`);
      case "warn": return later(i, env, ctx, async () => {
        const sent = await dm(env, target.id, `🦸 Hi hero! A moderator on **Little Hero Health** sent you a reminder:\n> ${reason}\nPlease read the Hero Code in #rules. Thanks for helping keep everyone safe!`);
        await modLog(env, gid, logEmbed("⚠️ Warning", SUN, i, target, reason, [{ name: "Told by DM", value: sent ? "Yes" : "No (their DMs are closed)" }]));
        return `✅ Warned ${who(target)}.${sent ? " They got a DM." : " Their DMs are closed, so remind them in the channel."} Logged in #mod-log.`;
      });
      case "timeout": return later(i, env, ctx, async () => {
        const mins = Number(opt(i, "minutes") || 10);
        const until = new Date(Date.now() + mins * 60000).toISOString();
        await api(env, "PATCH", `/guilds/${gid}/members/${target.id}`, { communication_disabled_until: until }, `${me.username}: ${reason}`);
        await dm(env, target.id, `⏸️ You've been given a ${label(mins)} break on **Little Hero Health**.\nReason: ${reason}\nWhen it's over, please follow the Hero Code. We're glad you're here!`);
        await modLog(env, gid, logEmbed("⏸️ Timeout", SUN, i, target, reason, [{ name: "How long", value: label(mins) }]));
        return `✅ ${who(target)} is timed out for ${label(mins)}. Logged in #mod-log.`;
      });
      case "untimeout": return later(i, env, ctx, async () => {
        await api(env, "PATCH", `/guilds/${gid}/members/${target.id}`, { communication_disabled_until: null }, `${me.username}: ended timeout`);
        await modLog(env, gid, logEmbed("▶️ Timeout ended", BLUE, i, target, reason || "Ended early"));
        return `✅ ${who(target)} can chat again.`;
      });
      case "kick": return later(i, env, ctx, async () => {
        await dm(env, target.id, `👋 You were removed from **Little Hero Health**.\nReason: ${reason}`);
        await api(env, "DELETE", `/guilds/${gid}/members/${target.id}`, undefined, `${me.username}: ${reason}`);
        await modLog(env, gid, logEmbed("👢 Kick", NIGHT, i, target, reason));
        return `✅ Kicked ${who(target)}. Logged in #mod-log.`;
      });
      case "ban": return later(i, env, ctx, async () => {
        await api(env, "PUT", `/guilds/${gid}/bans/${target.id}`, { delete_message_seconds: 86400 }, `${me.username}: ${reason}`);
        await modLog(env, gid, logEmbed("⛔ Ban", NIGHT, i, target, reason, [{ name: "Next step", value: "If this was about safety, tell the Grown-up Admin and report the account to Discord." }]));
        return `✅ Banned ${who(target)} and removed their messages from the last 24 hours. Logged in #mod-log.`;
      });
      case "clear": return later(i, env, ctx, async () => {
        const n = Math.max(1, Math.min(50, Number(opt(i, "count") || 10)));
        const msgs = await api(env, "GET", `/channels/${i.channel_id}/messages?limit=${n}`);
        const fresh = msgs.filter(m => Date.now() - new Date(m.timestamp).getTime() < 13.9 * 864e5).map(m => m.id);
        if (fresh.length >= 2) await api(env, "POST", `/channels/${i.channel_id}/messages/bulk-delete`, { messages: fresh }, `${me.username}: clear`);
        else if (fresh.length === 1) await api(env, "DELETE", `/channels/${i.channel_id}/messages/${fresh[0]}`, undefined, `${me.username}: clear`);
        await modLog(env, gid, { title: "🧹 Messages cleared", color: BLUE, fields: [{ name: "Channel", value: `<#${i.channel_id}>`, inline: true }, { name: "How many", value: String(fresh.length), inline: true }, { name: "Moderator", value: who(me) }], timestamp: new Date().toISOString() });
        return `✅ Cleared ${fresh.length} message${fresh.length === 1 ? "" : "s"}.${fresh.length < msgs.length ? " Messages older than 14 days can't be bulk-deleted." : ""}`;
      });
      case "apply": {
        const key = opt(i, "team");
        if (!TEAM[key]) return reply("Pick Admin or Moderator.");
        const roleId = await roleByName(env, gid, TEAM[key]);
        if (roleId && i.member.roles.includes(roleId)) return reply(`You're already on the ${TEAM[key]} team! 🎉`);
        const q = (id, label, style, ph, req = true, max = 600) => ({ type: 1, components: [{ type: 4, custom_id: id, label, style, placeholder: ph, required: req, max_length: max }] });
        return json({ type: 9, data: { custom_id: "apply:" + key, title: `Apply: ${TEAM[key].replace(/^\S+\s/, "")}`.slice(0, 45), components: [
          q("why", "Why do you want to join the team?", 2, "Tell us in a few sentences"),
          q("safety", "Someone posts their home address. What do you do?", 2, "What would you do first, and who would you tell?"),
          q("hours", "Hours a week you can help, and your time zone", 1, "e.g. 3 hours, Central Time", true, 80),
          q("age", "Age group: 13-15, 16-17 or 18+", 1, "Just the group, not your birthday", true, 10),
          q("more", "Anything else we should know? (optional)", 2, "No real names, ages or schools please", false, 400),
        ] } });
      }
    }
    return reply("I don't know that command yet.");
  }

  if (i.type === 5 && i.data.custom_id.startsWith("apply:")) {
    const key = i.data.custom_id.split(":")[1];
    const a = {}; for (const row of i.data.components) for (const c of row.components) a[c.custom_id] = c.value;
    return later(i, env, ctx, async () => {
      const ch = (await channelByName(env, gid, "staff-applications")) || (await channelByName(env, gid, "mod-log"));
      if (!ch) return "⚠️ The team hasn't set up an applications channel yet. Please tell a moderator.";
      await api(env, "POST", `/channels/${ch}/messages`, {
        embeds: [{ title: `📝 Application: ${TEAM[key]}`, color: SUN, description: `From ${who(me)}`, fields: [
          { name: "Why they want to join", value: a.why || "-" }, { name: "Home address test", value: a.safety || "-" },
          { name: "Hours a week and time zone", value: a.hours || "-", inline: true }, { name: "Age group", value: a.age || "-", inline: true },
          ...(a.more ? [{ name: "Anything else", value: a.more }] : [])], timestamp: new Date().toISOString(), footer: { text: "Little Hero Bot · Applications" } }],
        components: [{ type: 1, components: [
          { type: 2, style: 3, label: "Accept", emoji: { name: "✅" }, custom_id: `appok:${key}:${me.id}` },
          { type: 2, style: 4, label: "Deny", emoji: { name: "✖️" }, custom_id: `appno:${key}:${me.id}` }] }],
        allowed_mentions: { parse: [] } });
      return "✅ Your application was sent! The team will reply by DM. Thanks for wanting to help, hero. 🦸";
    });
  }

  if (i.type === 3 && /^app(ok|no):/.test(i.data.custom_id)) {
    if (!(perms(i) & PERM.ADMIN)) return reply("Only the Owner and Grown-up Admins can decide applications.");
    const [act, key, uid] = i.data.custom_id.split(":");
    const ok = act === "appok";
    ctx.waitUntil((async () => {
      if (env.__ready) await env.__ready;
      let note = ok ? `✅ Accepted by ${who(me)}` : `✖️ Denied by ${who(me)}`;
      try {
        if (ok) {
          const roleId = await roleByName(env, gid, TEAM[key]);
          if (!roleId) throw new Error(`I couldn't find the ${TEAM[key]} role.`);
          await api(env, "PUT", `/guilds/${gid}/members/${uid}/roles/${roleId}`, undefined, `Application accepted by ${me.username}`);
          await dm(env, uid, `🎉 Welcome to the **${TEAM[key]}** team on Little Hero Health! A team member will show you around. Thanks for helping keep everyone safe. 🦸`);
        } else {
          await dm(env, uid, `💛 Thanks for applying to the **${TEAM[key]}** team on Little Hero Health. We can't add you right now, but you're welcome to try again later. Keep being a hero!`);
        }
      } catch (e) { note = friendlyError(e); }
      const emb = i.message.embeds[0] || {};
      emb.color = ok ? BLUE : NIGHT; emb.fields = [...(emb.fields || []), { name: "Decision", value: note }];
      await api(env, "PATCH", `/webhooks/${env.DISCORD_APPLICATION_ID}/${i.token}/messages/@original`, { embeds: [emb], components: [] }).catch(() => {});
    })());
    return json({ type: 6 });
  }
  return reply("I don't know that one yet.");
}
const label = m => m >= 10080 ? "1 week" : m >= 1440 ? "1 day" : m >= 60 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minutes`;

import { stdin, stdout } from "node:process";
const GATEWAY = process.env.LHH_GATEWAY || "wss://gateway.discord.gg/?v=10&encoding=json";
const STATUS = { status: "online", since: null, afk: false, activities: [{ name: "over Little Hero 🦸", type: 3 }] };
let TOKEN = String(process.env.LHH_TOKEN || "").trim();
const env = { DISCORD_TOKEN: "", DISCORD_APPLICATION_ID: "" };
let seq = null, beat = null, acked = true, stopping = false, tries = 0;
const time = () => new Date().toLocaleTimeString();

function connect() {
  if (typeof WebSocket === "undefined") { console.log("Please update Node.js from nodejs.org (you need version 22 or newer)."); process.exit(1); }
  const ws = new WebSocket(GATEWAY);
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.s != null) seq = m.s;
    if (m.op === 10) {
      clearInterval(beat); acked = true;
      const every = m.d.heartbeat_interval;
      setTimeout(() => send(ws, { op: 1, d: seq }), Math.floor(every * Math.random()));
      beat = setInterval(() => {
        if (!acked) { ws.close(4000); return; }
        acked = false; send(ws, { op: 1, d: seq });
      }, every);
      send(ws, { op: 2, d: { token: TOKEN, intents: 0, properties: { os: "macos", browser: "little-hero", device: "little-hero" }, presence: STATUS } });
    } else if (m.op === 11) acked = true;
    else if (m.op === 1) send(ws, { op: 1, d: seq });
    else if (m.op === 0 && m.t === "INTERACTION_CREATE") handle(m.d);
    else if (m.op === 0 && m.t === "READY") { tries = 0; env.DISCORD_APPLICATION_ID = m.d.application.id; console.log(`🟢 ${time()}  ${m.d.user.username} is online and answering commands! Keep this window open. (Press Ctrl+C to stop)`); }
    else if (m.op === 7 || m.op === 9) ws.close(4000);
  };
  ws.onclose = ev => {
    clearInterval(beat);
    if (stopping) return;
    if (ev.code === 4004) { console.log("\n❌ That bot token isn't right. Reset it in the Developer Portal (Bot → Reset Token) and run this again."); process.exit(1); }
    if ([4010, 4011, 4012, 4013, 4014].includes(ev.code)) { console.log(`\n❌ Discord said no (code ${ev.code}). Send this message to Claude for help.`); process.exit(1); }
    tries++;
    const wait = Math.min(60, 5 * tries);
    console.log(`🟡 ${time()}  Lost connection. Trying again in ${wait} seconds...`);
    setTimeout(connect, wait * 1000);
  };
  ws.onerror = () => {};
}
async function handle(i) {
  let release; const e = { ...env, DISCORD_TOKEN: TOKEN, __ready: new Promise(r => (release = r)) };
  const jobs = [];
  try {
    const res = await route(i, e, { waitUntil: p => jobs.push(p) });
    const body = await res.json();
    await fetch(`${API}/interactions/${i.id}/${i.token}/callback`, { method: "POST", headers: { "content-type": "application/json", "User-Agent": "LittleHeroBot (https://be-the-doc.netlify.app, 1.0)" }, body: JSON.stringify(body) });
    const n = i.data?.name || i.data?.custom_id || "button";
    console.log(`   ${time()}  /${n} used by ${i.member?.user?.username || "someone"}`);
  } catch (err) { console.log(`   ⚠️ ${time()}  A command had a problem: ${err.message}`); }
  release(); await Promise.allSettled(jobs);
}
function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }

(async () => {
  console.log("\n🦸 Little Hero Bot · online\n");
  if (!TOKEN) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    for (let i = 0; !TOKEN && i < 5; i++) TOKEN = (await rl.question("Paste your bot token, then press Enter: ")).trim();
    rl.close();
  }
  if (!TOKEN) { console.log("No token was pasted. Run it again."); process.exit(1); }
  process.on("SIGINT", () => { stopping = true; console.log("\n⚪ Stopped. Little Hero Bot will show as offline (commands still work)."); process.exit(0); });
  connect();
})();
