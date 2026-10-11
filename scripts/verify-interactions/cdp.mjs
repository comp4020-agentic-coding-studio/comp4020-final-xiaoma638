// @ts-nocheck — developer-only Chrome driver, not part of the typed harness
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
let nextPort = 9600;
export async function browser({ cookie, w, h, dark = false, reduce = false }) {
  const port = nextPort++;
  const proc = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${tmpdir()}/srw-verify-prof-${port}-${Date.now()}`, "about:blank"], { stdio: "ignore" });
  let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
  const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) pending.get(m.id)?.(m.result ?? m.error); };
  const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  if (cookie) await send("Network.setCookie", { name: "srw_credential", value: cookie, url: process.env.APP_URL ?? "http://127.0.0.1:8080" });
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }, { name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
  const api = {
    send,
    async go(url, wait = 1800) { await send("Page.navigate", { url }); await sleep(wait); },
    async ev(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result?.value; },
    async shot(path) { const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 }); writeFileSync(path, Buffer.from(s.data, "base64")); },
    async key(key, code = key, keyCode = 0) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, text: key === "Enter" ? "\r" : undefined });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
    },
    async type(text) { await send("Input.insertText", { text }); },
    async click(selector) {
      const box = await api.ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: box[0], y: box[1], button: "left", clickCount: 1 });
    },
    // poll a DOM expression until it is truthy; returns ms waited
    async until(expr, timeout = 5000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await api.ev(expr)) return Date.now() - t0; await sleep(25); } return -1; },
    close() { ws.close(); proc.kill(); },
  };
  return api;
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
