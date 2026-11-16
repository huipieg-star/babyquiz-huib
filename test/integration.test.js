const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let child, base, cookie, tmp;
async function request(url, options={}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(base + url, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const type = response.headers.get("content-type") || "";
  return { response, data: type.includes("application/json") ? await response.json() : await response.text() };
}
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "babyquiz-"));
  const port = 31000 + Math.floor(Math.random() * 20000);
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), DATA_FILE: path.join(tmp, "data.json") },
    stdio: "ignore"
  });
  for (let i=0; i<60; i++) {
    try { const r=await fetch(base+"/api/state?team=huib"); if(r.ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error("Server did not start");
});
after(() => {
  if (child) child.kill("SIGTERM");
  if (tmp) fs.rmSync(tmp, { recursive:true, force:true });
});

test("startpagina wordt geladen", async () => {
  const { response, data } = await request("/");
  assert.equal(response.status, 200);
  assert.match(data, /De grote babyquiz/);
});
test("Team Huib begint met zes vragen", async () => {
  const { response, data } = await request("/api/state?team=huib");
  assert.equal(response.status, 200);
  assert.equal(data.total, 6);
  assert.match(data.question.text, /welk land/i);
});
test("Team Naomy is als binnenkort beschikbaar gemarkeerd", async () => {
  const { data } = await request("/api/state?team=naomy");
  assert.equal(data.comingSoon, true);
});
test("een fout antwoord activeert een cooldown van 30 minuten", async () => {
  const { data } = await request("/api/answer", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({team:"huib",answer:0}) });
  assert.equal(data.correct, false);
  assert.ok(data.cooldownUntil > Date.now() + 29*60*1000);
});
test("de cooldown blokkeert nieuwe antwoorden", async () => {
  const { response } = await request("/api/answer", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({team:"huib",answer:2}) });
  assert.equal(response.status, 429);
});
