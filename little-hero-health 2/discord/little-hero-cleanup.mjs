// Little Hero · tidy up duplicate channels
// Finds the extra channels whose names are channel descriptions (like
// "chat-about-anything-kind-hero-names-only"), shows you the list, and deletes them
// only after you type yes. Channels with messages in them are never deleted.
// It also moves #rules, #maple-shifts and #hero-help into their Little Hero categories.
// Run:  node ~/Desktop/little-hero-cleanup.mjs YOUR_SERVER_ID
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
const API = process.env.LHH_API || "https://discord.com/api/v10";
const TOPICS = ["Welcome to Little Hero Health! Start here. 🦸", "The Hero Code. Read it before you chat.", "News, new actions, camp dates and shifts. 🔔", "Pick your hospital job role here.", "Chat about anything kind. Hero names only!", "Say hi! Hero name and favorite job only. No real names, ages or schools.", "Riddles, polls and hospital challenges. 🎲", "Draw your hero, your hospital or your patient. No photos of faces.", "Plan group shifts on our Little Hero server. Invites are sent by DM, never posted.", "Find heroes to play with. Say your job and time zone.", "Show your best Maple Hospital moments! Hide usernames of other players.", "Show your Hero Box and at-home gear. No faces, no real names.", "Share My Hospital keys here. Make 1 or 7 day keys. Never share your Owner backup code!", "Ideas for new actions, jobs and badges. One idea per post.", "Something broken? Tell us what you did and what happened.", "Questions about real hospital jobs. Answers come from grown-up helpers, not medical advice.", "Help with the game, the website and Discord.", "Team chat for moderators.", "AutoMod alerts and moderation notes.", "AutoMod alerts and moderation notes.", "News, new actions, camp dates and shifts.", "Show your Hero Box and at-home gear (no faces, no real names).", "Questions about real hospital jobs."];
const MOVE = { "rules": "📌 START HERE", "maple-shifts": "🏥 MAPLE HOSPITAL", "hero-help": "🎓 CAREERS & HELP" };
const OLD_VOICE = ["shift-room-1", "shift-room-2", "quiet-study"];
let TOKEN = "";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(method, path, body, n = 0) {
  const r = await fetch(API + path, { method, headers: { Authorization: "Bot " + TOKEN, "content-type": "application/json", "User-Agent": "LittleHeroBot (https://be-the-doc.netlify.app, 1.0)" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 429 && n < 5) { const j = await r.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 300); return api(method, path, body, n + 1); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) { const e = new Error(`${r.status} ${(j && j.message) || t.slice(0, 160)}`); e.status = r.status; throw e; }
  await sleep(350); return j;
}
const slug = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const plain = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
(async () => {
  console.log("\n🦸 Little Hero · tidy up duplicate channels\n");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let G = String(process.env.LHH_GUILD || process.argv[2] || "").replace(/\D/g, "");
  TOKEN = String(process.env.LHH_TOKEN || "").trim();
  for (let i = 0; !TOKEN && i < 5; i++) TOKEN = (await rl.question("Paste your bot token, then press Enter: ")).trim();
  for (let i = 0; !/^\d{15,22}$/.test(G) && i < 5; i++) G = (await rl.question("Paste your server ID, then press Enter: ")).replace(/\D/g, "");
  let chans;
  try { chans = await api("GET", `/guilds/${G}/channels`); } catch (e) { console.log(e.status === 401 ? "That bot token isn't right. Reset it and copy it again." : "The bot can't see that server. Make sure it's still in your server."); process.exit(1); }
  const topicSlugs = TOPICS.map(t => plain(slug(t)).slice(0, 18)).filter(s => s.length >= 12);
  const cats = chans.filter(c => c.type === 4);
  const lhCats = new Set(cats.filter(c => /START HERE|HERO LOUNGE|MAPLE HOSPITAL|LITTLE HERO GAME|CAREERS|VOICE ROOMS|STAFF ONLY/i.test(c.name)).map(c => c.id));
  const dupes = chans.filter(c => c.type !== 4 && !lhCats.has(c.parent_id) && (
    topicSlugs.some(s => plain(c.name).startsWith(s)) ||
    (c.type === 0 && OLD_VOICE.some(v => plain(c.name) === plain(v))) ||
    /^.?automod-alerts/.test(c.name.replace(/^\W+/, "")) ));
  const safe = [], busy = [];
  for (const c of dupes) (c.last_message_id ? busy : safe).push(c);
  if (!safe.length && !busy.length) console.log("No duplicate channels found. 🎉");
  else {
    console.log("These duplicate channels will be DELETED:");
    safe.forEach(c => console.log("   🗑️  #" + c.name));
    if (busy.length) { console.log("\nThese look like duplicates but have messages, so they will be KEPT (delete them yourself if you want):"); busy.forEach(c => console.log("   💬 #" + c.name)); }
  }
  const moves = Object.entries(MOVE).map(([name, cat]) => ({ ch: chans.find(c => c.name === name && c.type === 0), cat: cats.find(c => c.name === cat) })).filter(m => m.ch && m.cat && m.ch.parent_id !== m.cat.id);
  if (moves.length) { console.log("\nThese will MOVE into their Little Hero category:"); moves.forEach(m => console.log(`   ➡️  #${m.ch.name} → ${m.cat.name}`)); }
  if (!safe.length && !moves.length) { rl.close(); return; }
  let go = "";
  for (let i = 0; !go && i < 5; i++) go = (await rl.question("\nType yes to do this, or no to stop: ")).trim().toLowerCase();
  rl.close();
  if (go !== "yes" && go !== "y") { console.log("Stopped. Nothing was changed."); return; }
  for (const c of safe) { try { await api("DELETE", `/channels/${c.id}`); console.log("  ✅ Deleted #" + c.name); } catch (e) { console.log(`  ⚠️  #${c.name}: ${e.message}`); } }
  for (const m of moves) { try { await api("PATCH", `/channels/${m.ch.id}`, { parent_id: m.cat.id, lock_permissions: true }); console.log(`  ✅ Moved #${m.ch.name} → ${m.cat.name}`); } catch (e) { console.log(`  ⚠️  #${m.ch.name}: ${e.message}`); } }
  const left = (await api("GET", `/guilds/${G}/channels`));
  for (const cat of cats.filter(c => /^(text|voice) channels$/i.test(c.name))) {
    if (!left.some(c => c.parent_id === cat.id)) { try { await api("DELETE", `/channels/${cat.id}`); console.log(`  ✅ Removed the empty "${cat.name}" category`); } catch {} }
  }
  console.log("\n🎉 All tidy! Now you can run the banners script.\n");
})().catch(e => { console.log("\nSomething went wrong: " + e.message); process.exit(1); });
