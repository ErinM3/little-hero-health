/* The Hero Shift · Family link (Parent Portal)
   Kid pages:   <script src="js/family.js" data-area="game|puzzles|biscuit|workstation|heroes|teen"></script>
   Portal page: <script src="js/family.js" data-area="portal"></script>
   Stores: ths-family (setup + settings), ths-family-usage (today), ths-family-status (what the kid is doing).
   The kid device talks directly to linked parent devices with PeerJS (WebRTC). Nothing is stored on a server. */
(()=>{"use strict";
const ME=document.currentScript;const AREA=(ME&&ME.dataset.area)||"game";const PORTAL=AREA==="portal";
const FK="ths-family",UK="ths-family-usage",SK="ths-family-status";
const ALPHA="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const AREAS={game:["The hospital game","🩹"],puzzles:["the Puzzle Lab","🧩"],biscuit:["Talk to Biscuit","🧸"],workstation:["the Hospital Workstation","🏥"],heroes:["Hero groups","🦸"],teen:["Teen Heroes HQ","🩺"],community:["Discord","💬"],roblox:["Roblox","🎮"],portal:["the Parent Portal","👪"]};
const ALLOWKEY={puzzles:"puzzles",biscuit:"biscuit",workstation:"workstation",community:"community",roblox:"roblox"};
const DEF={paused:false,pauseMsg:"",limit:0,bed:{on:false,from:"20:00",to:"07:00"},lockAge:false,allow:{puzzles:true,biscuit:true,workstation:true,advanced:true,community:false,roblox:false,keys:true},v:0};
const GROUPS={little:[0,"Little Heroes","5 to 11"],junior:[1,"Junior Heroes","12 to 15"],senior:[2,"Senior Heroes","16 to 18"]};
const safe=f=>{try{return f()}catch(e){return undefined}};
const jget=k=>safe(()=>JSON.parse(localStorage.getItem(k)||"null"));
const jset=(k,v)=>safe(()=>{localStorage.setItem(k,JSON.stringify(v));return true});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rnd=n=>{const a=new Uint8Array(n);(window.crypto||{}).getRandomValues?crypto.getRandomValues(a):a.forEach((_,i)=>a[i]=Math.random()*256|0);return [...a].map(b=>ALPHA[b%ALPHA.length]).join("")};
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const hm=d=>String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
function merge(s){s=Object.assign({},DEF,s||{});s.bed=Object.assign({},DEF.bed,s.bed||{});s.allow=Object.assign({},DEF.allow,s.allow||{});s.limit=Math.max(0,Math.min(600,+s.limit||0));s.pauseMsg=String(s.pauseMsg||"").slice(0,140);return s}
function load(){const f=jget(FK);if(!f||!f.id||!f.secret)return null;f.settings=merge(f.settings);f.parents=Array.isArray(f.parents)?f.parents:[];return f}
function save(f){return jset(FK,f)}
function usage(){let u=jget(UK);if(!u||u.day!==today())u={day:today(),sec:0,bonus:0,log:[],last:0,bedSkip:0};u.log=Array.isArray(u.log)?u.log:[];return u}
function saveU(u){jset(UK,u)}
function logIt(text){const u=usage();const last=u.log[u.log.length-1];if(last&&last.x===text&&Date.now()-last.t<6e4)return;u.log.push({t:Date.now(),x:String(text).slice(0,90)});if(u.log.length>40)u.log=u.log.slice(-40);saveU(u)}
async function hash(salt,pin){const s=salt+":"+pin;try{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}}catch(e){}
 let h1=0x811c9dc5,h2=0x1b873593;for(let i=0;i<s.length;i++){h1=Math.imul(h1^s.charCodeAt(i),16777619);h2=Math.imul(h2^s.charCodeAt(i),2246822507)}return "f"+(h1>>>0).toString(16)+(h2>>>0).toString(16)}
async function pinOK(pin){const f=load();if(!f||!f.pin)return false;return (await hash(f.salt,String(pin).trim()))===f.pin}
const codeOf=f=>(f.id+f.secret).match(/.{1,4}/g).join("-");
function parseCode(c){const s=String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");if(s.length!==24||[...s].some(ch=>!ALPHA.includes(ch)))return null;return {id:s.slice(0,16),secret:s.slice(16)}}
const peerIdOf=id=>"ths-k-"+String(id).toLowerCase();
function newFamily(o){const f={v:1,id:rnd(16),secret:rnd(8),salt:rnd(12),pin:o.pin,nick:String(o.nick||"Hero").slice(0,20),avatar:o.avatar||"🦸",age:GROUPS[o.age]?o.age:"little",settings:merge(Object.assign({},o.settings||{},{v:Date.now()})),parents:[],made:Date.now()};save(f);return f}
function remaining(f,u){f=f||load();u=u||usage();if(!f||!f.settings.limit)return Infinity;return f.settings.limit*60+(u.bonus||0)*60-u.sec}
function inBed(f,u){f=f||load();u=u||usage();if(!f||!f.settings.bed.on)return false;if(u.bedSkip&&Date.now()<u.bedSkip)return false;const n=hm(new Date()),a=f.settings.bed.from,b=f.settings.bed.to;if(!a||!b||a===b)return false;return a<b?(n>=a&&n<b):(n>=a||n<b)}
function settingsChange(f,patch,from){const s=merge(Object.assign({},f.settings,patch));s.v=Math.max(Date.now(),(f.settings.v||0)+1);f.settings=s;save(f);return f}

/* ---------- PeerJS loader ---------- */
let peerLib=null;
function peerOpts(){const q=new URLSearchParams(location.search);safe(()=>{if(q.get("peerhost")){sessionStorage.setItem("ths-peerhost",q.get("peerhost"));sessionStorage.setItem("ths-peerport",q.get("peerport")||"9000")}});
 const h=safe(()=>sessionStorage.getItem("ths-peerhost"));if(h)return {host:h,port:+(safe(()=>sessionStorage.getItem("ths-peerport"))||9000),path:"/",secure:location.protocol==="https:"&&h!=="localhost",debug:0};
 return {debug:0}}
function loadPeer(){if(peerLib)return peerLib;peerLib=new Promise((res,rej)=>{if(window.Peer)return res(window.Peer);const s=document.createElement("script");s.src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";s.async=true;s.onload=()=>window.Peer?res(window.Peer):rej(new Error("no Peer"));s.onerror=()=>{peerLib=null;rej(new Error("PeerJS blocked"))};document.head.appendChild(s)});return peerLib}

/* ---------- Kid side: link to parent devices ---------- */
const TAB=rnd(6);let bc=null;safe(()=>{bc=new BroadcastChannel("ths-family")});
const conns=new Set();let peer=null,leader=false,lastHB=0,retry=1500,retryT=0;const pending={};const listeners=[];
function online(){return leader?[...conns].some(c=>c.open&&c._ok):Date.now()-lastHB<5000&&lastLeaderOnline}
let lastLeaderOnline=false;
function stateMsg(){const f=load();const u=usage();return {t:"state",nick:f&&f.nick,avatar:f&&f.avatar,age:f&&f.age,settings:f&&f.settings,usage:{day:u.day,sec:Math.round(u.sec),bonus:u.bonus||0,log:u.log.slice(-25)},status:jget(SK),online:true,at:Date.now()}}
function sendAll(m){conns.forEach(c=>{if(c.open&&c._ok)safe(()=>c.send(m))})}
function pushState(){if(leader)sendAll(stateMsg());}
function relay(m){safe(()=>bc&&bc.postMessage(m))}
function handleParent(c,d){if(!d||typeof d!=="object")return;
 if(!c._ok){if(d.t==="hello"){const f=load();if(f&&d.secret===f.secret){c._ok=true;c._name=String(d.name||"Parent device").slice(0,30);const p=f.parents.find(x=>x.pid===d.pid);if(p){p.name=c._name;p.last=Date.now()}else f.parents.push({pid:String(d.pid||"").slice(0,40),name:c._name,last:Date.now()});f.parents=f.parents.slice(-6);save(f);if(!p)logIt("📱 "+c._name+" linked");safe(()=>c.send(stateMsg()));relay({t:"linked"});fire();return}}
  safe(()=>c.send({t:"denied"}));setTimeout(()=>safe(()=>c.close()),200);return}
 const f=load();if(!f)return;
 if(d.t==="settings"&&d.s){if((+d.v||0)>(f.settings.v||0)){const before=f.settings;f.settings=merge(d.s);f.settings.v=+d.v;if(d.age&&GROUPS[d.age])f.age=d.age;save(f);if(!before.paused&&f.settings.paused)logIt("⏸️ Paused by "+c._name);if(before.paused&&!f.settings.paused)logIt("▶️ Resumed by "+c._name);relay({t:"changed"});enforce()}pushState();return}
 if(d.t==="msg"&&d.text){const m={t:"msg",text:String(d.text).slice(0,140),from:c._name};logIt("💬 "+c._name+": "+m.text);showMsg(m);relay(m);pushState();return}
 if(d.t==="addtime"){const u=usage();u.bonus=(u.bonus||0)+Math.max(0,Math.min(240,+d.min||15));saveU(u);logIt("➕ "+(+d.min||15)+" min from "+c._name);relay({t:"changed"});enforce();showMsg({text:"Your grown-up gave you "+(+d.min||15)+" more minutes! 🎉",from:c._name});relay({t:"msg",text:"Your grown-up gave you "+(+d.min||15)+" more minutes! 🎉",from:c._name,quiet:1});pushState();return}
 if(d.t==="answer"&&d.id){answer(d.id,!!d.ok,c._name);relay({t:"answer",id:d.id,ok:!!d.ok,from:c._name});sendAll({t:"answered",id:d.id,ok:!!d.ok});return}
 if(d.t==="ping"){safe(()=>c.send(stateMsg()))}}
function bindConn(c){c._ok=false;c.on("data",d=>handleParent(c,d));c.on("close",()=>{conns.delete(c);fire()});c.on("error",()=>{conns.delete(c);fire()});conns.add(c);setTimeout(()=>{if(!c._ok)safe(()=>c.close())},15000)}
async function startPeer(){const f=load();if(!f)return;let P;try{P=await loadPeer()}catch(e){return}
 if(peer)return;try{peer=new P(peerIdOf(f.id),peerOpts())}catch(e){peer=null;return}
 peer.on("open",()=>{leader=true;retry=1500;fire();pushState()});
 peer.on("connection",bindConn);
 peer.on("disconnected",()=>{safe(()=>peer.reconnect())});
 peer.on("error",e=>{const t=e&&e.type;if(t==="unavailable-id"){safe(()=>peer.destroy());peer=null;leader=false;schedule();return}
  if(t==="network"||t==="server-error"||t==="socket-error"||t==="socket-closed"){safe(()=>peer.destroy());peer=null;leader=false;schedule()}});}
function schedule(){clearTimeout(retryT);retryT=setTimeout(()=>{if(!peer&&(Date.now()-lastHB>4000))startPeer();else schedule()},retry);retry=Math.min(30000,retry*1.7)}
function stopPeer(){safe(()=>{conns.forEach(c=>c.close());peer&&peer.destroy()});peer=null;leader=false}
let beat=0;setInterval(()=>{if(!leader)return;relay({t:"hb",on:[...conns].some(c=>c.open&&c._ok)});if(++beat%10===0)pushState()},2000);
if(bc)bc.onmessage=e=>{const d=e.data||{};
 if(d.t==="hb"){lastHB=Date.now();lastLeaderOnline=!!d.on;return}
 if(d.t==="msg"){showMsg(d);return}
 if(d.t==="answer"){answer(d.id,d.ok,d.from);return}
 if(d.t==="changed"||d.t==="linked"){enforce();fire();if(leader)pushState();return}
 if(d.t==="req"&&leader){sendAll({t:"req",id:d.id,what:d.what,at:Date.now()});return}
 if(d.t==="state?"&&leader){pushState()}};
addEventListener("storage",e=>{if(e.key===FK||e.key===UK||e.key===SK){if(e.key===FK){const f=load();if(!f){stopPeer()}else if(!peer)startPeer()}enforce();fire();if(leader)pushState()}});
addEventListener("pagehide",()=>stopPeer());

/* ---------- Requests ---------- */
function answer(id,ok,from){const p=pending[id];if(!p)return;delete pending[id];logIt((ok?"✅ Allowed: ":"❌ Not now: ")+p.what+(from?" ("+from+")":""));p.done(ok,from)}
function ask(what,opt){what=String(what||"Something").slice(0,80);return new Promise(res=>{const f=load();if(!f){res(false);return}
 const id=TAB+"-"+rnd(6);const box=modalBox();const on=online();
 const finish=(ok,from)=>{box.remove();unInert();res(ok);toast(ok?"✅ Your grown-up said yes!":"Your grown-up said not right now.")};
 pending[id]={what,done:finish};
 box.innerHTML=`<div class="thsf-card" role="dialog" aria-modal="true" aria-label="Ask a grown-up"><div class="thsf-em">🙋</div><h2>Ask a grown-up</h2><p>You asked for: <b>${esc(what)}</b></p>${on?`<p class="thsf-wait">📱 Sent to your grown-up's phone. Waiting…</p>`:`<p class="thsf-wait">No grown-up phone is linked right now.</p>`}<label class="thsf-f">Grown-up here? Type the PIN<input type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label><p class="thsf-err" role="alert"></p><div class="thsf-row"><button class="thsf-btn" data-k="ok">OK</button><button class="thsf-btn ghost" data-k="no">Cancel</button></div></div>`;
 inert();const inp=box.querySelector("input");setTimeout(()=>inp.focus(),50);
 const tryPin=async()=>{if(await pinOK(inp.value)){delete pending[id];logIt("✅ Allowed with PIN: "+what);box.remove();unInert();res(true);toast("✅ Allowed!")}else box.querySelector(".thsf-err").textContent="That PIN isn't right."};
 box.querySelector('[data-k="ok"]').onclick=tryPin;inp.onkeydown=e=>{if(e.key==="Enter")tryPin()};
 box.querySelector('[data-k="no"]').onclick=()=>{delete pending[id];box.remove();unInert();res(false)};
 logIt("🙋 Asked: "+what);
 if(leader)sendAll({t:"req",id,what,at:Date.now()});else relay({t:"req",id,what});})}

/* ---------- UI: styles, overlays, toasts ---------- */
const css=`#thsf,.thsf-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(6,24,66,.94);font-family:"Atkinson Hyperlegible",system-ui,sans-serif;color:#fff;overflow:auto}
.thsf-card{background:#0F3C99;border:3px solid #FFD21F;border-radius:26px;max-width:460px;width:100%;padding:24px 20px;text-align:center;display:grid;gap:10px;box-shadow:0 20px 50px rgba(0,0,0,.4)}
.thsf-card h2{font:800 clamp(1.5rem,6vw,2rem)/1.1 "Baloo 2",system-ui;color:#FFD21F;margin:0}.thsf-card p{margin:0;line-height:1.45;color:#DCE8FB}
.thsf-em{font-size:3.4rem;line-height:1}.thsf-msg{background:#fff;color:#0A2A6B;border-radius:18px;padding:12px 14px;font:700 1.15rem/1.35 "Baloo 2",system-ui}
.thsf-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border:2px solid #FFD21F;background:#FFD21F;color:#0A2A6B;font:800 1.05rem "Baloo 2",system-ui;border-radius:999px;padding:8px 20px;cursor:pointer;text-decoration:none}
.thsf-btn.ghost{background:transparent;color:#fff}.thsf-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.thsf-f{display:grid;gap:6px;text-align:left;font-weight:700;font-size:.95rem}.thsf-f input{font:800 1.3rem "Baloo 2",system-ui;padding:10px 12px;border-radius:14px;border:2px solid #2F5DB8;background:#0A2A6B;color:#fff;letter-spacing:.3em;text-align:center;width:100%;box-sizing:border-box}
.thsf-err{color:#FFB3B3!important;min-height:1.2em;font-weight:700}.thsf-wait{font-weight:700;color:#FFF3B0!important}
.thsf-small{font-size:.85rem;opacity:.85}
.thsf-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 18px);z-index:2147483001;background:#FFD21F;color:#0A2A6B;font:800 1.05rem "Baloo 2",system-ui;border-radius:18px;padding:12px 18px;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(92vw,520px);text-align:center}
.thsf-banner{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:2147483001;width:min(92vw,520px);background:#fff;color:#0A2A6B;border:3px solid #FFD21F;border-radius:22px;padding:14px 16px;box-shadow:0 18px 40px rgba(0,0,0,.4);display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;font-family:"Atkinson Hyperlegible",system-ui}
.thsf-banner b{display:block;font:800 .8rem system-ui;letter-spacing:.1em;text-transform:uppercase;color:#1F5FAD}.thsf-banner span{font:800 1.25rem/1.3 "Baloo 2",system-ui}.thsf-banner .e{font-size:2rem}
.thsf-banner button{border:0;background:#0A2A6B;color:#fff;border-radius:999px;font:800 .95rem "Baloo 2",system-ui;padding:8px 14px;cursor:pointer;min-height:40px}
.thsf-chip{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);z-index:2147482000;background:#0A2A6B;color:#fff;border:2px solid #FFD21F;border-radius:999px;font:800 .85rem "Baloo 2",system-ui;padding:5px 12px;box-shadow:0 6px 16px rgba(0,0,0,.3)}`;
function addCSS(){if(document.getElementById("thsf-css"))return;const s=document.createElement("style");s.id="thsf-css";s.textContent=css;document.head.appendChild(s)}
let inertEls=[];function inert(){unInert();safe(()=>{inertEls=[...document.body.children].filter(e=>!(e.id==="thsf"||e.classList.contains("thsf-modal")||e.classList.contains("thsf-banner")||e.tagName==="SCRIPT"||e.tagName==="STYLE"));inertEls.forEach(e=>e.inert=true)})}
function unInert(){if(document.getElementById("thsf")||document.querySelector(".thsf-modal"))return;inertEls.forEach(e=>e.inert=false);inertEls=[]}
function modalBox(){addCSS();const b=document.createElement("div");b.className="thsf-modal";document.body.appendChild(b);return b}
function toast(t){if(!document.body)return;addCSS();const e=document.createElement("div");e.className="thsf-toast";e.setAttribute("role","status");e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)}
function showMsg(m){if(PORTAL||!document.body)return;addCSS();document.querySelectorAll(".thsf-banner").forEach(x=>x.remove());const b=document.createElement("div");b.className="thsf-banner";b.setAttribute("role","alert");b.innerHTML=`<span class="e" aria-hidden="true">💌</span><div><b>Message from ${esc(m.from||"your grown-up")}</b><span>${esc(m.text)}</span></div><button type="button">OK</button>`;b.querySelector("button").onclick=()=>b.remove();document.body.appendChild(b);setTimeout(()=>b.remove(),20000);safe(()=>{if(navigator.vibrate)navigator.vibrate(120)})}
function stopMedia(){safe(()=>{document.querySelectorAll("audio,video").forEach(m=>{if(!m.paused)m.pause()});window.speechSynthesis&&speechSynthesis.cancel()})}
let cur="";
function overlay(kind,html){addCSS();let o=document.getElementById("thsf");if(!kind){cur="";if(o){o.remove();unInert()}return}if(cur===kind&&o)return;cur=kind;
 if(!o){o=document.createElement("div");o.id="thsf";document.body.appendChild(o)}o.innerHTML=`<div class="thsf-card" role="dialog" aria-modal="true">${html}</div>`;inert();stopMedia();
 o.querySelectorAll("[data-pin]").forEach(btn=>{const inp=o.querySelector("input");const go=async()=>{if(await pinOK(inp.value)){const k=btn.dataset.pin;const f=load(),u=usage();
  if(k==="time"){u.bonus=(u.bonus||0)+15;saveU(u);logIt("➕ 15 min with PIN")}else if(k==="bed"){u.bedSkip=Date.now()+30*60000;saveU(u);logIt("🌙 Bedtime skipped 30 min with PIN")}else if(k==="pause"){settingsChange(f,{paused:false});logIt("▶️ Resumed with PIN")}else if(k==="area"){const a=ALLOWKEY[AREA];if(a){const al=Object.assign({},f.settings.allow,{[a]:true});settingsChange(f,{allow:al});logIt("🔓 Opened "+AREAS[AREA][0]+" with PIN")}}
  relay({t:"changed"});cur="";enforce();pushState()}else o.querySelector(".thsf-err").textContent="That PIN isn't right."};btn.onclick=go;if(inp)inp.onkeydown=e=>{if(e.key==="Enter")go()}});
 o.querySelectorAll("[data-skip]").forEach(btn=>btn.onclick=()=>{try{localStorage.setItem("ths-family-skip","1")}catch(e){}overlay(null)});
 o.querySelectorAll("[data-ask]").forEach(btn=>btn.onclick=async()=>{const k=btn.dataset.ask;o.style.display="none";const ok=await ask(btn.dataset.what);o.style.display="";if(ok){const f=load(),u=usage();if(k==="time"){u.bonus=(u.bonus||0)+15;saveU(u)}else if(k==="bed"){u.bedSkip=Date.now()+30*60000;saveU(u)}else if(k==="area"){const a=ALLOWKEY[AREA];if(a)settingsChange(f,{allow:Object.assign({},f.settings.allow,{[a]:true})})}relay({t:"changed"});cur="";enforce();pushState()}})}
const pinBox=(k,label)=>`<label class="thsf-f">${label}<input type="password" inputmode="numeric" maxlength="6" autocomplete="off" aria-label="Grown-up PIN"></label><p class="thsf-err" role="alert"></p><div class="thsf-row"><button class="thsf-btn" data-pin="${k}">Unlock</button>`;
function enforce(){if(PORTAL||!document.body)return;const f=load();
 if(!f){let sk=false;try{sk=localStorage.getItem("ths-family-skip")==="1"}catch(e){}if(sk){if(cur==="setup")overlay(null);return}overlay("setup",`<div class="thsf-em">🧸👪</div><h2>Ask a grown-up to set up the Parent Portal</h2><p>Before you play, a grown-up sets up The Hero Shift on this device. It takes about 2 minutes.</p><p class="thsf-small">Grown-ups: you'll pick a PIN, a nickname and play rules, and you can link your phone to pause play, add time and send messages.</p><div class="thsf-row"><a class="thsf-btn" href="parent.html">👪 Open the Parent Portal</a><button class="thsf-btn ghost" data-skip>▶ Skip and play now</button></div><p class="thsf-small">No time right now? Skip it and play. You can set up the Parent Portal anytime from the menu under Families &amp; schools.</p>`);return}
 const s=f.settings,u=usage(),a=ALLOWKEY[AREA];
 if(a&&s.allow[a]===false){overlay("area",`<div class="thsf-em">🔒</div><h2>This area is turned off</h2><p>Your grown-up turned off ${esc(AREAS[AREA][0])} for now.</p><div class="thsf-row"><button class="thsf-btn" data-ask="area" data-what="Open ${esc(AREAS[AREA][0])}">🙋 Ask to open it</button><a class="thsf-btn ghost" href="index.html">🩹 Go to the game</a></div>${pinBox("area","Grown-up: type the PIN to open it")}</div>`);return}
 if(s.paused){overlay("pause",`<div class="thsf-em">⏸️</div><h2>Paused by your grown-up</h2>${s.pauseMsg?`<div class="thsf-msg">“${esc(s.pauseMsg)}”</div>`:`<p>Take a hero break! Your game will be right here when you come back.</p>`}${pinBox("pause","Grown-up here? Type the PIN to resume")}</div>`);return}
 if(inBed(f,u)){overlay("bed",`<div class="thsf-em">🌙</div><h2>It's bedtime, ${esc(f.nick)}</h2><p>Heroes need sleep to be strong. You can play again at <b>${esc(s.bed.to)}</b>.</p><div class="thsf-row"><button class="thsf-btn" data-ask="bed" data-what="30 more minutes before bed">🙋 Ask for 30 more minutes</button></div>${pinBox("bed","Grown-up: type the PIN for 30 more minutes")}</div>`);return}
 if(remaining(f,u)<=0){overlay("time",`<div class="thsf-em">⏰</div><h2>Time's up for today!</h2><p>You played <b>${Math.round(u.sec/60)} minutes</b>. Great hero work, ${esc(f.nick)}!</p><p>Stretch, drink some water and tell a grown-up your favorite part.</p><div class="thsf-row"><button class="thsf-btn" data-ask="time" data-what="15 more minutes">🙋 Ask for 15 more minutes</button></div>${pinBox("time","Grown-up: type the PIN for 15 more minutes")}</div>`);return}
 overlay("");chip(f,u)}
function chip(f,u){if(PORTAL)return;let c=document.querySelector(".thsf-chip");const r=remaining(f,u);if(r===Infinity||r>5*60){if(c)c.remove();return}addCSS();if(!c){c=document.createElement("div");c.className="thsf-chip";c.setAttribute("role","status");document.body.appendChild(c)}c.textContent="⏰ "+Math.max(1,Math.ceil(r/60))+" min left"}

/* ---------- Usage tick and links ---------- */
function tick(){if(PORTAL)return;const f=load();if(!f)return;if(cur)return;if(document.visibilityState!=="visible")return;const u=usage();const now=Date.now();const add=Math.max(0,Math.min(20,(now-(u.last||0))/1000));u.last=now;u.sec+=add;saveU(u);enforce()}
setInterval(tick,10000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){const u=usage();u.last=Date.now();saveU(u);enforce();status({})}});
document.addEventListener("click",e=>{if(PORTAL)return;const a=e.target.closest&&e.target.closest("a[href]");if(!a)return;const f=load();if(!f)return;const h=a.getAttribute("href")||"";
 const which=/community\.html|discord\.(gg|com)/i.test(h)?"community":/roblox\.html|roblox\.com/i.test(h)?"roblox":/games\.html/.test(h)?"puzzles":/biscuit\.html/.test(h)?"biscuit":/workstation\.html/.test(h)?"workstation":"";
 if(which&&f.settings.allow[which]===false){e.preventDefault();toast("🔒 "+AREAS[which][0].replace(/^the /,"")+" is turned off by your grown-up.")}},true);

/* ---------- Status ---------- */
let lastStatus="";
function status(o){if(PORTAL)return;o=o||{};const st={page:(location.pathname.split("/").pop()||"index.html"),area:AREA,where:AREAS[AREA]?AREAS[AREA][0]:AREA,icon:AREAS[AREA]?AREAS[AREA][1]:"🩹",title:document.title,detail:String(o.detail||"").slice(0,90),t:Date.now()};
 jset(SK,st);const key=st.area+"|"+st.detail;if(key!==lastStatus){lastStatus=key;logIt(st.icon+" "+(st.detail||"Opened "+st.where))}if(leader)pushState()}

/* ---------- Change listeners ---------- */
function fire(){listeners.forEach(f=>safe(()=>f(api.settings())))}
const api={area:AREA,
 setup:()=>!!load(),settings:()=>{const f=load();return f?Object.assign({},f.settings,{nick:f.nick,avatar:f.avatar,age:f.age}):null},
 ageGroup:()=>{const f=load();return f?f.age:null},
 lockedTier:()=>{const f=load();return f&&f.settings.lockAge?GROUPS[f.age][0]:null},
 allowed:k=>{const f=load();if(!f)return true;return f.settings.allow[k]!==false},
 minutesLeft:()=>{const r=remaining();return r===Infinity?null:Math.max(0,Math.ceil(r/60))},
 linked:()=>online(),ask,status,onChange:fn=>{if(typeof fn==="function")listeners.push(fn)},
 _:{load,save,usage,saveU,newFamily,settingsChange,hash,pinOK,codeOf,parseCode,peerIdOf,loadPeer,peerOpts,GROUPS,DEF,merge,rnd,logIt,pushState,restart:()=>{stopPeer();startPeer()},relay,isLeader:()=>leader,conns:()=>[...conns].filter(c=>c.open&&c._ok).map(c=>c._name),stopPeer}};
window.THSFamily=api;

function boot(){try{if(!PORTAL){enforce();status({});const u=usage();u.last=Date.now();saveU(u)}if(load())startPeer();relay({t:"state?"})}catch(e){}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
