// The Hero Shift rooms service (Cloudflare Worker + Durable Object).
// It only passes messages between the devices in one room. It stores nothing,
// keeps no logs of messages, and a room disappears when everyone leaves.
const ALLOWED = ["https://theheroshift.com", "https://www.theheroshift.com"];
const MAX_DEVICES = 9;      // host + up to 8 heroes
const MAX_MSG = 8000;       // characters

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const m = u.pathname.match(/^\/room\/([A-Z2-9]{6})$/);
    if (!m) return new Response("The Hero Shift rooms service", { status: 200 });
    if (!ALLOWED.includes(req.headers.get("Origin") || "")) return new Response("Not allowed", { status: 403 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

export class Room {
  constructor(state) { this.state = state; }
  async fetch() {
    if (this.state.getWebSockets().length >= MAX_DEVICES) return new Response("Room is full", { status: 429 });
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > MAX_MSG) return;
    for (const other of this.state.getWebSockets()) if (other !== ws) { try { other.send(msg); } catch (e) {} }
  }
  webSocketClose(ws) { try { ws.close(); } catch (e) {} }
  webSocketError(ws) { try { ws.close(); } catch (e) {} }
}
