// @ts-nocheck — developer-only Chrome driver, not part of the typed harness
import { mkdirSync } from "node:fs";
import { browser, sleep } from "./cdp.mjs";
// Drives three real headless Chrome windows (shared screen, phone, host room)
// through a live review and prints PASS/FAIL per check. Developer check only:
// it is not part of pnpm check because it needs Chrome and takes about a minute.
// Usage: pnpm build && pnpm preview, then
//   APP_URL=http://127.0.0.1:8080 node scripts/verify-interactions/verify.mjs [screenshot-dir]
const base = process.env.APP_URL ?? "http://127.0.0.1:8080";
const outDir = process.argv[2] ?? "verify-shots";
mkdirSync(outDir, { recursive: true });
class C { jar = new Map();
  async req(m, p, b) { const r = await fetch(base + p, { method: m, headers: { cookie: [...this.jar].map(([k,v])=>`${k}=${v}`).join("; "), ...(b?{"content-type":"application/json"}:{}) }, body: b?JSON.stringify(b):undefined });
    for (const l of r.headers.getSetCookie()) { const [pair]=l.split(";"); const i=pair.indexOf("="); this.jar.set(pair.slice(0,i), pair.slice(i+1)); }
    const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; }
  get cred() { return this.jar.get("srw_credential"); } }
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// --- setup: host, six participants (P0 drives a real phone browser)
const host = new C();
const orgId = (await host.req("POST", "/api/orgs", { name: "Friday design crit", nickname: "Sam" })).body.orgId;
const code = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body.org.joinCode;
const people = [];
for (let i = 0; i < 6; i++) { const c = new C(); await c.req("POST", "/api/join", { code, nickname: "P" + i }); people.push(c); }
const qid = (await host.req("POST", `/api/orgs/${orgId}/questions`, { kind: "open", prompt: "What would make our next review better?", durationSec: 40 })).body.questionId;

const present = await browser({ cookie: host.cred, w: 1920, h: 1080 });
const phone = await browser({ cookie: people[0].cred, w: 390, h: 844 });
const room = await browser({ cookie: host.cred, w: 1280, h: 900 });
await present.go(`${base}/o/${orgId}/present`);
await phone.go(`${base}/o/${orgId}`);
await room.go(`${base}/o/${orgId}`);

// --- draft → start, seen live on the shared screen
await present.shot(`${outDir}/01-present-draft.jpg`);
await host.req("POST", `/api/questions/${qid}/start`, {});
let t = await present.until(`document.querySelector('.countdown') !== null`);
check("shared screen switches to Answering live after start", t >= 0, `${t}ms`);
const snap = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
const deadline = snap.current.deadline + (Date.now() - snap.now);

// --- keyboard: QR dialog in the host's room
await room.ev(`document.querySelector('[aria-label="Show QR code"]').focus()`);
await room.key("Enter", "Enter", 13);
await sleep(200);
const opened = await room.ev(`[document.querySelector('dialog.qr-dialog').open, document.activeElement?.textContent.trim()]`);
check("Enter on QR button opens dialog with focus inside", opened[0] && opened[1] === "Close", JSON.stringify(opened));
await room.key("Escape", "Escape", 27);
await sleep(200);
const closed = await room.ev(`[document.querySelector('dialog.qr-dialog').open, document.activeElement?.getAttribute('aria-label')]`);
check("Escape closes dialog and returns focus to QR button", !closed[0] && closed[1] === "Show QR code", JSON.stringify(closed));

// --- live submissions: count, bump and pile on the shared screen
const answers = [
  ["More time to compare ideas after the reveal.", ["time", "discussion"]],
  ["Share the brief a day early.", ["preparation", "time"]],
  ["Rotate who opens the discussion.", ["discussion", "fairness"]],
  ["Keep it under twenty minutes.", ["time"]],
  ["Show examples of good feedback first.", ["examples", "preparation"]],
];
const lat = [];
for (const [i, [text, tags]] of answers.entries()) {
  await people[i + 1].req("PUT", `/api/questions/${qid}/response`, { text, tags, baseVersion: 0 });
  const t0 = Date.now();
  const waited = await present.until(`document.querySelector('.submitted .num')?.textContent.trim() === '${i + 1}'`);
  lat.push(waited < 0 ? -1 : Date.now() - t0);
  if (i === 1) { await sleep(120); await present.shot(`${outDir}/02-present-card-dropping.jpg`); }
}
check("shared screen count follows each submission", lat.every((x) => x >= 0), `latency ms: ${lat.join(", ")}`);
check("updates arrive within about a second", Math.max(...lat) < 1000, `max ${Math.max(...lat)}ms`);
const pile = await present.ev(`document.querySelectorAll('.pile .card').length`);
check("answer pile shows one face-down card per submission", pile === 5, `${pile} cards`);
const leak = await present.ev(`document.body.innerHTML.includes('twenty minutes') || document.body.innerHTML.includes('fairness')`);
check("no answer text or keyword in the shared screen before reveal", !leak);
const roomPile = await room.ev(`document.querySelectorAll('.answered .pile .card').length`);
check("room shows the small pile too", roomPile === 5, `${roomPile} cards`);

// --- the phone participant types and submits with real input events
await phone.click("#answer");
await phone.type("Start with one focused question so every voice has room.");
await phone.click("details.tag-editor summary");
await phone.click("#tags");
await phone.type("focus, time");
await phone.click("button[type=submit]");
t = await phone.until(`document.querySelector('.saved-badge') !== null`);
check("phone: Saved badge appears after server confirms", t >= 0, `${t}ms`);
await sleep(120);
await phone.shot(`${outDir}/03-phone-saved.jpg`);
t = await present.until(`document.querySelector('.submitted .num')?.textContent.trim() === '6'`);
check("shared screen picks up the phone's answer", t >= 0, `${t}ms`);
await present.shot(`${outDir}/04-present-six.jpg`);

// --- reveal: final countdown, then flip frames
await sleep(Math.max(0, deadline - 2200 - Date.now()));
const final = await present.ev(`document.querySelector('.final')?.textContent`);
check("big 3-2-1 shows in final seconds", ["1", "2", "3"].includes(final), `showed "${final}"`);
await present.shot(`${outDir}/05-present-final.jpg`);
const flipT = await present.until(`document.querySelectorAll('.wall > li').length === 6`, 6000);
const lag = Date.now() - deadline;
check("shared screen reveals by itself after the deadline", flipT >= 0, `${lag}ms after deadline`);
const frames = [];
for (const at of [60, 260, 520]) {
  await sleep(at - (frames.length ? [60, 260, 520][frames.length - 1] : 0));
  frames.push(await present.ev(`[...document.querySelectorAll('.wall > li')].map(li => { const s = getComputedStyle(li); return (+s.opacity).toFixed(2); }).join(' ')`));
  await present.shot(`${outDir}/06-flip-${at}ms.jpg`);
}
check("cards flip in one after another", frames[0] !== frames[2], frames.join(" | "));
await sleep(1500);
const settledOpacity = await present.ev(`[...document.querySelectorAll('.wall > li')].every(li => getComputedStyle(li).opacity === '1')`);
check("all cards fully visible after the flip", settledOpacity);

// --- likes: phone uses real clicks; shared screen orders by likes and animates
await present.click(".segmented button:nth-child(2)");
await phone.ev(`document.querySelector('.wall').scrollIntoView()`);
await sleep(300);
const firstOther = await phone.ev(`[...document.querySelectorAll('.wall > li')].findIndex(li => li.querySelector('button.like'))`);
await phone.click(`.wall > li:nth-child(${firstOther + 1}) button.like`);
await sleep(80);
const popping = await phone.ev(`!!document.querySelector('.heart.pop')`);
check("phone: heart pops on like", popping);
t = await phone.until(`document.querySelector('.budget')?.textContent.includes('2 of 3')`);
check("phone: budget drops to 2 of 3", t >= 0);
// three other people like the 'twenty minutes' answer → it should rise on the shared screen
const revealed = (await host.req("GET", `/api/questions/${qid}`)).body.results.responses;
const target = revealed.find((r) => r.text.includes("twenty"));
const before = await present.ev(`[...document.querySelectorAll('.wall > li .text')].map(x => x.textContent).findIndex(t => t.includes('twenty'))`);
// follow the card frame by frame while three people like it
const path = present.ev(`(async () => {
  const el = [...document.querySelectorAll('.wall > li')].find(li => li.textContent.includes('twenty'));
  const ys = []; const t0 = performance.now();
  while (performance.now() - t0 < 1500) { await new Promise(r => requestAnimationFrame(r)); ys.push(Math.round(el.getBoundingClientRect().top)); }
  return ys;
})()`);
await sleep(50);
const t1 = Date.now();
for (const p of [people[1], people[2], people[3]]) await p.req("PUT", `/api/responses/${target.id}/like`, { liked: true });
await sleep(180);
await present.shot(`${outDir}/07-present-reorder-mid.jpg`);
const ys = await path;
const reorderLat = Date.now() - t1;
const distinct = new Set(ys).size;
const maxStep = Math.max(...ys.slice(1).map((y, i) => Math.abs(y - ys[i])));
const top = await present.ev(`document.querySelector('.wall > li .text')?.textContent.includes('twenty')`);
check("most liked answer moves to the top of the shared screen", before > 0 && top, `from position ${before + 1} → 1`);
check("card glides there instead of jumping", distinct > 8 && maxStep < 120, `${distinct} distinct positions, largest single-frame step ${maxStep}px, travel ${ys[0] - ys.at(-1)}px`);
await sleep(700);
await present.shot(`${outDir}/08-present-reordered.jpg`);
const yours = await present.ev(`document.body.innerText.includes('Your answer')`);
check("shared screen never marks the host's answer", !yours);

// --- keyword bubble by keyboard on the phone
await phone.ev(`document.querySelector('details.keywords').open = true; document.querySelector('.bubble').focus()`);
await phone.key(" ", "Space", 32);
await sleep(200);
const filtered = await phone.ev(`document.querySelector('.filtered')?.textContent.trim().replace(/\\s+/g, ' ')`);
check("Space on a keyword bubble filters answers", !!filtered, filtered);
await phone.ev(`document.querySelector('.filtered').scrollIntoView({block:'start'}); window.scrollBy(0,-70)`);
await phone.shot(`${outDir}/09-phone-filtered.jpg`);

// --- full screen toggle
await present.click(".tools button");
await sleep(400);
const fs = await present.ev(`[!!document.fullscreenElement, document.querySelector('.tools button').textContent]`);
check("full screen toggle works", fs[0] && fs[1].includes("Exit"), JSON.stringify(fs));

// --- reduced motion and dark theme
const calm = await browser({ cookie: people[4].cred, w: 1280, h: 900, dark: true, reduce: true });
await calm.go(`${base}/o/${orgId}`, 1500);
const calmAnim = await calm.ev(`[...document.querySelectorAll('.wall > li')].map(li => getComputedStyle(li).animationName).join(',')`);
check("reduced motion turns off the card flip", calmAnim.split(",").every((n) => n === "none"), calmAnim);
await calm.shot(`${outDir}/10-dark-reduced.jpg`);
calm.close();

// --- overflow
for (const [name, b] of [["present", present], ["phone", phone], ["room", room]]) {
  check(`${name}: no horizontal overflow`, !(await b.ev(`document.documentElement.scrollWidth > innerWidth`)));
}

present.close(); phone.close(); room.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
