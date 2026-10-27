// Little Hero Health · Discord setup bot
// Builds the Little Hero server in one go: roles, categories, channels, topics,
// permissions, welcome and rules posts, AutoMod and safety settings, and the server icon.
// Run it ONCE with a grown-up:  node little-hero-discord-setup.mjs
// Needs Node.js 18 or newer (nodejs.org). Your bot token stays on your computer.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const API = process.env.LHH_API || "https://discord.com/api/v10";
const D = {
 "WELCOME": "# 🦸 Welcome to Little Hero Health!\nHi hero! This is the official Discord for **Little Hero Health**, the real-life hospital game you play with your friends.\n\n**Start here**\n1️⃣ Read the Hero Code in #rules\n2️⃣ Pick your hospital job in #pick-your-job\n3️⃣ Say hi in #introduce-yourself (hero name only!)\n\n🎮 Play the game: https://be-the-doc.netlify.app\n🏥 Plan Maple Hospital shifts in #maple-shifts\n🙋 Need help? Ask in #hero-help or ping a @Moderator\n\nHave fun, and be a hero to everyone here. 💛",
 "RULES": "# 📜 The Hero Code\nEvery hero on this server follows these rules.\n\n**1. Be kind.** Every hero is welcome. No bullying, hate, mean jokes or drama.\n**2. Stay safe.** Never share your real name, birthday, school, address, phone number, passwords or photos of your face.\n**3. Hero names only.** Use your hero name as your nickname here.\n**4. No stranger DMs.** Don't accept friend requests or DMs from people you don't know. If anyone makes you uncomfortable, tell a @Moderator right away.\n**5. Keep it clean.** No swearing, scary, violent or grown-up content. This is a family-friendly server.\n**6. No spam or selling.** No ads, invites to other servers, giveaways or trading.\n**7. Right channel, right topic.** Keep chats where they belong.\n**8. Server codes stay private.** Never post Roblox private server links or codes. The team sends invites directly.\n**9. Follow Discord's rules.** You must be 13 or older and follow Discord's Terms of Service and Community Guidelines.\n**10. Listen to moderators.** Break a rule and you get a warning, then a timeout, then you're removed.\n\n🚑 This is a game. In a real emergency, tell a grown-up or call your local emergency number.",
 "ANN": "# 🎉 Little Hero Health is open!\nWelcome to our brand new server, heroes!\n\n🩹 **Play the game:** https://be-the-doc.netlify.app\n🎬 **New to Little Hero?** Watch the 2-minute how-to video on the home page.\n🏥 **My Hospital:** build your own hospital in the Workstation and share keys in #my-hospital-keys\n🎮 **Maple Hospital:** group shifts are planned in #maple-shifts\n\nTurn on notifications for this channel so you never miss a new action, camp or shift! 🔔\n— Harry, CEO of Little Hero Health",
 "INTRO": "👋 **Introduce yourself! Copy this and fill it in:**\n\n🦸 Hero name:\n🩺 Favorite hospital job:\n⭐ Favorite Little Hero action:\n🎮 Do you play in real life, on Roblox, or both?\n🎨 One fun fact about your hero:\n\n⚠️ No real names, ages, schools or photos of your face!",
 "KEYS": "🔑 **How to share a hospital key**\n1. Open the Workstation → 🏥 My Hospital\n2. Make a key for a job (pick 1 day or 7 days so it can't be used forever)\n3. Copy the invite link and post it here with your hospital's name and the job\n\n✅ Hospital keys are fine to share here\n⛔ NEVER share your 🛡️ Owner backup code. Anyone with it can make keys for your hospital!",
 "SHIFT": "🏥 **Planning a Maple Hospital shift**\nPost your shift like this:\n\n📅 Day and time (with your time zone):\n🩺 Jobs needed (doctor, nurse, paramedic...):\n👥 How many heroes:\n\nA team member will DM the private server invite to the heroes who join. Never post server links or codes in public channels.",
 "CH": [
  [
   "📌 START HERE",
   "Read-only for everyone except the team",
   [
    [
     "welcome",
     "text",
     "Welcome to Little Hero Health! Start here. 🦸",
     "Read-only. Paste the Welcome post."
    ],
    [
     "rules",
     "text",
     "The Hero Code. Read it before you chat.",
     "Read-only. Paste the Rules post. Set it as your Rules channel in Server Settings → Safety Setup or Onboarding."
    ],
    [
     "announcements",
     "announcement",
     "News, new actions, camp dates and shifts. 🔔",
     "Read-only. Make it an Announcement channel so people can follow it."
    ],
    [
     "pick-your-job",
     "text",
     "Pick your hospital job role here.",
     "Read-only. Use Onboarding's Channels & Roles, or a reaction-roles bot if you add one later."
    ]
   ]
  ],
  [
   "💬 HERO LOUNGE",
   "",
   [
    [
     "general",
     "text",
     "Chat about anything kind. Hero names only!",
     "Slowmode 5 seconds."
    ],
    [
     "introduce-yourself",
     "text",
     "Say hi! Hero name and favorite job only. No real names, ages or schools.",
     "Slowmode 1 minute. Pin the Introduce-yourself template."
    ],
    [
     "fun-and-games",
     "text",
     "Riddles, polls and hospital challenges. 🎲",
     ""
    ],
    [
     "hero-art",
     "text",
     "Draw your hero, your hospital or your patient. No photos of faces.",
     "Turn on media-only if you like."
    ]
   ]
  ],
  [
   "🏥 MAPLE HOSPITAL",
   "",
   [
    [
     "maple-shifts",
     "text",
     "Plan group shifts on our Little Hero server. Invites are sent by DM, never posted.",
     "Pin the Shift template."
    ],
    [
     "looking-for-a-squad",
     "text",
     "Find heroes to play with. Say your job and time zone.",
     ""
    ],
    [
     "shift-screenshots",
     "text",
     "Show your best Maple Hospital moments! Hide usernames of other players.",
     ""
    ]
   ]
  ],
  [
   "🎒 LITTLE HERO GAME",
   "",
   [
    [
     "show-your-kit",
     "text",
     "Show your Hero Box and at-home gear. No faces, no real names.",
     ""
    ],
    [
     "my-hospital-keys",
     "text",
     "Share My Hospital keys here. Make 1 or 7 day keys. Never share your Owner backup code!",
     "Pin the Hospital keys post."
    ],
    [
     "game-ideas",
     "forum",
     "Ideas for new actions, jobs and badges. One idea per post.",
     "A Forum channel works great here (tags: Action, Job, Badge, Website)."
    ],
    [
     "bug-reports",
     "forum",
     "Something broken? Tell us what you did and what happened.",
     "Forum channel with tags: Game, Workstation, Camp HQ, Website."
    ]
   ]
  ],
  [
   "🎓 CAREERS & HELP",
   "",
   [
    [
     "ask-a-real-hero",
     "text",
     "Questions about real hospital jobs. Answers come from grown-up helpers, not medical advice.",
     ""
    ],
    [
     "hero-help",
     "text",
     "Help with the game, the website and Discord.",
     ""
    ]
   ]
  ],
  [
   "🔊 VOICE ROOMS",
   "Locked until a moderator opens them",
   [
    [
     "Shift Room 1",
     "voice",
     "",
     "Connect ❌ for @everyone. A moderator turns it on for a session."
    ],
    [
     "Shift Room 2",
     "voice",
     "",
     ""
    ],
    [
     "Quiet Study",
     "voice",
     "",
     "Camera off. Video ❌ for @everyone."
    ]
   ]
  ],
  [
   "🛡️ STAFF ONLY",
   "Private: only Owner, Grown-up Admin and Moderator roles",
   [
    [
     "mod-chat",
     "text",
     "Team chat for moderators.",
     ""
    ],
    [
     "mod-log",
     "text",
     "AutoMod alerts and moderation notes.",
     "Send AutoMod alerts here."
    ]
   ]
  ]
 ],
 "MODS": [
  [
   "Warn first",
   "Reply kindly in the channel or DM: \"Hey hero, that breaks rule 5. Please keep it clean!\""
  ],
  [
   "Then a timeout",
   "Second time: right-click the user → Timeout → 1 hour. Note it in #mod-log."
  ],
  [
   "Then remove",
   "Third time, or anything serious: Kick. For dangerous behavior: Ban, and tell the Grown-up Admin."
  ],
  [
   "Always tell a grown-up",
   "If anyone asks a member for photos, personal info, to meet up, or to keep a secret: screenshot it, ban the account, tell the Grown-up Admin, and report it to Discord (right-click the message → Report)."
  ],
  [
   "Never argue in public",
   "Move problems to #mod-chat. Be calm and fair."
  ],
  [
   "Delete personal info fast",
   "If someone posts their real name, address or phone number, delete it right away and remind them of rule 2."
  ]
 ],
 "KW": "*my address*, *where i live*, *my phone number*, *my number is*, *what school*, *which school*, *my school is*, *how old are you*, *send pic*, *send a pic*, *send me a pic*, *add me on*, *snapchat*, *snap me*, *instagram*, *my insta*, *tiktok me*, *whatsapp*, *telegram*, *home alone*, *dont tell your parents*, *don't tell your parents*, *our secret*, *free robux*, *robux generator*",
 "RX": "\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b\n(discord\\.gg|discord\\.com/invite)/\\S+\nroblox\\.com/share\\S*\nprivateServerLinkCode=\\S+"
};
const ICON = "data:image/jpeg;base64,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";

const P = { ADMIN:1n<<3n, KICK:1n<<1n, VIEW:1n<<10n, SEND:1n<<11n, MANAGE_MSG:1n<<13n, EMBED:1n<<14n, ATTACH:1n<<15n, HISTORY:1n<<16n, MENTION_ALL:1n<<17n, EXT_EMOJI:1n<<18n, CONNECT:1n<<20n, SPEAK:1n<<21n, MUTE:1n<<22n, MOVE:1n<<24n, REACT:1n<<6n, STREAM:1n<<9n, THREADS_PUB:1n<<35n, SEND_THREADS:1n<<38n, MANAGE_THREADS:1n<<34n, TIMEOUT:1n<<40n };
const bits = (...a) => a.reduce((x, y) => x | y, 0n).toString();
const hex = c => parseInt(c.replace("#", ""), 16);
const MOD_PERMS = bits(P.VIEW,P.SEND,P.HISTORY,P.REACT,P.EMBED,P.ATTACH,P.EXT_EMOJI,P.MANAGE_MSG,P.MANAGE_THREADS,P.KICK,P.TIMEOUT,P.CONNECT,P.SPEAK,P.MUTE,P.MOVE,P.SEND_THREADS);

const ROLES = [
  { name: "👑 Owner", color: "#FFD21F", hoist: true, perms: bits(P.ADMIN) },
  { name: "🧑‍💼 Grown-up Admin", color: "#FFD21F", hoist: true, perms: bits(P.ADMIN) },
  { name: "🛡️ Moderator", color: "#1F5FAD", hoist: true, perms: MOD_PERMS, mentionable: true },
  { name: "🦸 Hero Team", color: "#5AAEFF", hoist: true, perms: "0" },
  ...["🩺 Doctor","💉 Nurse","😷 Surgeon","🚑 Paramedic","💊 Pharmacist","🧪 Lab Tech","🩻 Radiographer","🛎️ Receptionist","🤝 Volunteer"].map(n => ({ name: n, color: "#8FB4E0", perms: "0" })),
  { name: "🔔 Shift Squad", color: "#CFE2FF", perms: "0", mentionable: true },
  { name: "📣 News Pings", color: "#CFE2FF", perms: "0", mentionable: true },
];
const TYPE = { text: 0, voice: 2, category: 4, announcement: 5, forum: 15 };
const SLOW = { "general": 5, "introduce-yourself": 60 };
const POSTS = {
  "welcome": [D.WELCOME], "rules": [D.RULES], "announcements": [D.ANN],
  "pick-your-job": ["🩺 **Pick your hospital job!**\nOpen **Channels & Roles** at the top of the channel list (or **Server Guide**) and pick your job and your pings.\nYour job shows next to your hero name. 🦸"],
  "introduce-yourself": [D.INTRO, true], "my-hospital-keys": [D.KEYS, true], "maple-shifts": [D.SHIFT, true],
  "mod-chat": ["🛡️ **Moderator steps**\n" + D.MODS.map(([k, v], i) => `${i + 1}. **${k}.** ${v}`).join("\n"), true],
};

let TOKEN = "", G = "";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(method, path, body, tries = 0) {
  const res = await fetch(API + path, { method, headers: { "Authorization": "Bot " + TOKEN, "Content-Type": "application/json", "User-Agent": "LittleHeroSetup (https://be-the-doc.netlify.app, 1.0)" }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 429 && tries < 6) { const j = await res.json().catch(() => ({})); await sleep(((j.retry_after || 1) * 1000) + 250); return api(method, path, body, tries + 1); }
  const txt = await res.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
  if (!res.ok) { const e = new Error(`${method} ${path} → ${res.status} ${j && j.message ? j.message : txt.slice(0, 160)}`); e.status = res.status; e.body = j; throw e; }
  await sleep(350);
  return j;
}
const ok = t => console.log("  ✅ " + t), skip = t => console.log("  ⏭️  " + t), warn = t => console.log("  ⚠️  " + t);

async function main() {
  console.log("\n🦸 Little Hero Health · Discord setup bot\n");
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 18) { console.log("Please install Node.js 18 or newer from nodejs.org, then try again."); process.exit(1); }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  G = String(process.env.LHH_GUILD || process.argv[2] || "").replace(/\D/g, "");
  TOKEN = String(process.env.LHH_TOKEN || "").trim();
  for (let i = 0; !TOKEN && i < 5; i++) TOKEN = (await rl.question("Paste your bot token, then press Enter: ")).trim();
  if (!TOKEN) { console.log("No token was pasted. Run the command again."); process.exit(1); }
  for (let i = 0; !/^\d{15,22}$/.test(G) && i < 5; i++) {
    if (G) console.log("That server ID doesn't look right. It's a long number, like 1560483599063711837.");
    G = (await rl.question("Paste your server ID, then press Enter: ")).replace(/\D/g, "");
  }
  if (!/^\d{15,22}$/.test(G)) { console.log("Still no server ID. Turn on Developer Mode, right-click your server, then Copy Server ID."); process.exit(1); }

  let guild;
  try { guild = await api("GET", `/guilds/${G}`); }
  catch (e) { console.log(e.status === 401 ? "That bot token isn't right. Reset it in the Developer Portal and copy it again." : "The bot can't see that server. Make sure you invited the bot with Administrator, and check the server ID."); process.exit(1); }
  console.log(`Server: ${guild.name}`);
  let go = process.env.LHH_YES ? "yes" : "";
  for (let i = 0; !go && i < 5; i++) go = (await rl.question(`This adds Little Hero roles, channels and posts to "${guild.name}". Type yes to go: `)).trim().toLowerCase();
  rl.close();
  if (go !== "yes" && go !== "y") { console.log("Stopped. Nothing was changed."); return; }

  console.log("\n1/5 Roles");
  const haveRoles = await api("GET", `/guilds/${G}/roles`);
  const R = {};
  for (const r of ROLES) {
    const found = haveRoles.find(x => x.name === r.name);
    if (found) { R[r.name] = found.id; skip(r.name + " already there"); continue; }
    try { const made = await api("POST", `/guilds/${G}/roles`, { name: r.name, color: hex(r.color), hoist: !!r.hoist, permissions: r.perms, mentionable: !!r.mentionable }); R[r.name] = made.id; ok(r.name); }
    catch (e) { warn(`${r.name}: ${e.message}`); }
  }
  const everyone = G, mod = R["🛡️ Moderator"], team = R["🦸 Hero Team"], gadmin = R["🧑‍💼 Grown-up Admin"], owner = R["👑 Owner"];
  const ow = (id, allow = "0", deny = "0") => id ? [{ id, type: 0, allow, deny }] : [];
  const PERMS = {
    "📌 START HERE": [...ow(everyone, "0", bits(P.SEND, P.SEND_THREADS, P.THREADS_PUB)), ...ow(mod, bits(P.SEND)), ...ow(team, bits(P.SEND)), ...ow(gadmin, bits(P.SEND))],
    "🔊 VOICE ROOMS": [...ow(everyone, "0", bits(P.CONNECT)), ...ow(mod, bits(P.CONNECT, P.SPEAK))],
    "🛡️ STAFF ONLY": [...ow(everyone, "0", bits(P.VIEW)), ...ow(mod, bits(P.VIEW)), ...ow(gadmin, bits(P.VIEW)), ...ow(owner, bits(P.VIEW))],
  };

  console.log("\n2/5 Categories and channels");
  const haveCh = await api("GET", `/guilds/${G}/channels`);
  const made = {};
  for (const [cat, , chs] of D.CH) {
    const ovw = PERMS[cat] || [];
    let catId = haveCh.find(c => c.type === 4 && c.name.toLowerCase() === cat.toLowerCase())?.id;
    if (catId) skip(cat + " already there");
    else { try { catId = (await api("POST", `/guilds/${G}/channels`, { name: cat, type: 4, permission_overwrites: ovw })).id; ok(cat); } catch (e) { warn(`${cat}: ${e.message}`); continue; } }
    for (const [name, type, topic] of chs) {
      const cname = type === "voice" ? name : name.toLowerCase();
      if (haveCh.find(c => c.name.toLowerCase() === cname.toLowerCase())) { skip(`  ${cname} already there`); continue; }
      let extra = [...ovw];
      if (name === "Quiet Study") extra = [...ovw.filter(o => o.id !== everyone), ...ow(everyone, "0", bits(P.CONNECT, P.STREAM))];
      const body = { name: cname, type: TYPE[type], parent_id: catId, permission_overwrites: extra };
      if (topic && type !== "voice") body.topic = topic;
      if (SLOW[name]) body.rate_limit_per_user = SLOW[name];
      try { made[name] = (await api("POST", `/guilds/${G}/channels`, body)).id; ok(`  ${type === "voice" ? "🔊 " : "#"}${cname}`); }
      catch (e) {
        if (type === "announcement" || type === "forum") {
          try { body.type = 0; made[name] = (await api("POST", `/guilds/${G}/channels`, body)).id; ok(`  #${cname} (made as a text channel; turn on Community to use ${type} channels)`); }
          catch (e2) { warn(`${cname}: ${e2.message}`); }
        } else warn(`${cname}: ${e.message}`);
      }
    }
  }

  console.log("\n3/5 Posts");
  for (const [ch, [text, pin]] of Object.entries(POSTS)) {
    const id = made[ch];
    if (!id) { skip(`#${ch}: channel already existed, so no post was added`); continue; }
    try {
      const m = await api("POST", `/channels/${id}/messages`, { content: text.slice(0, 2000), allowed_mentions: { parse: [] } });
      if (pin) { try { await api("PUT", `/channels/${id}/messages/pins/${m.id}`); } catch { await api("PUT", `/channels/${id}/pins/${m.id}`).catch(() => {}); } }
      ok(`#${ch}${pin ? " (pinned)" : ""}`);
    } catch (e) { warn(`#${ch}: ${e.message}`); }
  }

  console.log("\n4/5 AutoMod");
  const log = made["mod-log"] || haveCh.find(c => c.name === "mod-log")?.id;
  const alert = log ? [{ type: 2, metadata: { channel_id: log } }] : [];
  const block = msg => ({ type: 1, metadata: { custom_message: msg } });
  const haveAM = await api("GET", `/guilds/${G}/auto-moderation/rules`).catch(() => []);
  const AM = [
    { name: "Little Hero: bad words", trigger_type: 4, trigger_metadata: { presets: [1, 2, 3] }, actions: [block("Hero tip: keep it clean! 🦸"), ...alert] },
    { name: "Little Hero: personal info", trigger_type: 1, trigger_metadata: { keyword_filter: D.KW.split(",").map(s => s.trim()).filter(Boolean), regex_patterns: D.RX.split("\n").map(s => s.trim()).filter(Boolean) }, actions: [block("Hero tip: keep personal info and server links private! 🦸"), ...alert] },
    { name: "Little Hero: mention spam", trigger_type: 5, trigger_metadata: { mention_total_limit: 5 }, actions: [block("Too many mentions, hero!"), { type: 3, metadata: { duration_seconds: 600 } }, ...alert] },
    { name: "Little Hero: spam", trigger_type: 3, trigger_metadata: {}, actions: [block("That looks like spam, hero."), ...alert] },
  ];
  for (const r of AM) {
    if (haveAM.find(x => x.name === r.name)) { skip(r.name + " already there"); continue; }
    try { await api("POST", `/guilds/${G}/auto-moderation/rules`, { ...r, event_type: 1, enabled: true }); ok(r.name); }
    catch (e) { warn(`${r.name}: ${e.message}`); }
  }

  console.log("\n5/5 Safety settings and logo");
  try { await api("PATCH", `/guilds/${G}`, { verification_level: 3, explicit_content_filter: 2, default_message_notifications: 1 }); ok("High verification, image filter for everyone, @mentions-only notifications"); }
  catch (e) { warn(`Safety settings: ${e.message}`); }
  if (!guild.icon) { try { await api("PATCH", `/guilds/${G}`, { icon: ICON }); ok("Server icon set to the Little Hero logo"); } catch (e) { warn(`Icon: ${e.message}`); } }
  else skip("Server already has an icon");

  console.log(`
🎉 Done! Your Little Hero server is built.

Next, do these in Discord (they can't be done by a bot):
  1. Give yourself 👑 Owner and your parent 🧑‍💼 Grown-up Admin (right-click → Roles).
  2. Server Settings → Enable Community, then turn on Rules Screening and Onboarding
     (the Discord Kit page has the words to paste).
  3. Remove the setup bot: right-click it → Kick. Then reset its token in the Developer Portal.
  4. Make your template link: Server Settings → Server Template → Generate Template.
`);
}
main().catch(e => { console.log("\nSomething went wrong: " + e.message); process.exit(1); });
