// Tiny local server: serves ./public and relays events to the page over SSE.
// Send events from anywhere on this machine:
//   curl "localhost:1337/event?type=commit&msg=fix%20typo"
//   curl -X POST localhost:1337/event -d '{"type":"incident"}'
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { startWatching } from "./watch.js";

const PORT = process.env.PORT || 1337;
const ROOTS = (process.env.PIXELTOWN_ROOTS || "~/src/github.com/Shopify:~/src/github.com/carmelal").split(":");
const PUB = path.join(import.meta.dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const clients = new Set();
let lastEvents = [];

function broadcast(ev) {
  ev.at = Date.now();
  lastEvents = [...lastEvents.slice(-19), ev];
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) res.write(line);
  console.log(new Date().toLocaleTimeString(), ev.type, ev.msg ?? "");
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({ type: "hello", recent: lastEvents })}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/event") {
    let body = "";
    for await (const c of req) body += c;
    let ev = Object.fromEntries(url.searchParams);
    if (body) try { ev = { ...ev, ...JSON.parse(body) }; } catch {}
    if (!ev.type) { res.writeHead(400); return res.end("type required"); }
    broadcast(ev);
    res.writeHead(200); return res.end("ok\n");
  }
  const file = path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname);
  if (!file.startsWith(PUB) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => { console.log(`pixeltown → http://localhost:${PORT}`); startWatching(ROOTS, broadcast); });
