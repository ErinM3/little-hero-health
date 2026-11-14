/* The Hero Shift rooms: friends join a shift from their own devices with a 6-letter code.
   OFF until a grown-up deploys the small rooms service (see rooms/HOW-TO-TURN-ON-ROOMS.txt in the repo)
   and puts its address below. Rooms keep nothing: no accounts, no saving, gone when the host closes the room. */
(()=>{
const ROOMS_URL=""; // e.g. "wss://ths-rooms.YOUR-ACCOUNT.workers.dev"
let url=ROOMS_URL;
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){const q=new URLSearchParams(location.search).get("roomsTest");if(q)url=q;}
const AL="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>AL[b%AL.length]).join("");
function connect(c,onMsg,onState){
  let ws;try{ws=new WebSocket(url.replace(/\/$/,"")+"/room/"+c)}catch(e){setTimeout(()=>onState("error"),0);return{send(){},close(){}}}
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(m&&typeof m==="object")onMsg(m)};
  ws.onopen=()=>onState("open");ws.onclose=()=>onState("closed");ws.onerror=()=>onState("error");
  return{send:o=>{if(ws.readyState===1)ws.send(JSON.stringify(o))},close:()=>{try{ws.close()}catch(e){}}};}
window.THSRooms={on:()=>!!url,code,connect,valid:c=>/^[A-Z2-9]{6}$/.test(c),clean:c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)};
})();
