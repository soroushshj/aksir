/* Aksir offline — everything runs on the device: OCR (Tesseract WASM), drug matching, Q&A, history, voice. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DRUGS = window.DRUGS || {};
const ALIASES = window.ALIASES || {};

/* ------------------------------------------------------------------ icons */
const ICONS = {
  upload: '<path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  camera: '<path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.4"/>',
  send: '<path d="M4 12 20 4l-5 16-3-6.5z"/><path d="m12 13.5 8-9.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  vol: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  pill: '<g transform="rotate(-45 12 12)"><rect x="3" y="7.5" width="18" height="9" rx="4.5"/><path d="M12 7.5v9"/></g>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ------------------------------------------------------------------ state / settings */
const PRESETS = [["#2dd4a8", "Emerald"], ["#8b7cf6", "Violet"], ["#38a8f8", "Ocean"], ["#f472a8", "Rose"], ["#f5b13d", "Amber"], ["#ff7a59", "Coral"], ["#a3e635", "Lime"]];
const DEF = { lang: "fa", appearance: "dark", accent: "#2dd4a8", fontSize: 100, ocr: "fas+eng" };
let S = { ...DEF };
try { S = { ...DEF, ...JSON.parse(localStorage.getItem("aksir.m.settings") || "{}") }; } catch {}
const saveS = () => { try { localStorage.setItem("aksir.m.settings", JSON.stringify(S)); } catch {} };
const st = { images: [], busy: false, cur: null, view: "scan", audio: null, hist: [], lastOcr: null };
const t = (k, v) => {
  let s = (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.fa[k] ?? k;
  if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, b);
  return s;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2800); }

/* ------------------------------------------------------------------ theme + language */
function applyTheme() {
  const dark = S.appearance === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : S.appearance === "dark";
  const r = document.documentElement;
  r.dataset.mode = dark ? "dark" : "light";
  r.style.setProperty("--accent", S.accent);
  const n = parseInt(S.accent.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
  r.style.setProperty("--on-accent", (R * 299 + G * 587 + B * 114) / 1000 > 150 ? "#04110d" : "#ffffff");
  r.style.setProperty("--fs", S.fontSize + "%");
  $('meta[name="theme-color"]').content = dark ? "#080d11" : "#f2f6f7";
}
function applyLang() {
  const r = document.documentElement;
  r.lang = S.lang; r.dir = S.lang === "fa" ? "rtl" : "ltr";
  $("#langLabel").textContent = S.lang === "fa" ? "EN" : "فا";
  $$("[data-i18n]").forEach((e) => (e.innerHTML = t(e.dataset.i18n)));
  $$("[data-i18n-ph]").forEach((e) => (e.placeholder = t(e.dataset.i18nPh)));
  document.title = S.lang === "fa" ? "اکسیر · Aksir" : "Aksir · اکسیر";
  $("#camBtn").innerHTML = ico("camera") + t("cam");
  $("#pickBtn").innerHTML = ico("upload") + t("pick");
  $("#scanBtn").innerHTML = ico("scan") + t("scan");
  $("#dropIco").innerHTML = ico("pill");
  $("#sendBtn").innerHTML = ico("send");
  $("#settingsBtn").innerHTML = ico("gear");
  $("#closeSettings").innerHTML = ico("x");
  $("#backBtn").innerHTML = ico("back") + t("back");
  $("#reportBtn").innerHTML = ico("file") + t("report");
  $("#testVoice").innerHTML = ico("vol") + t("testVoice");
  $("#clearHist").textContent = t("clearHist");
  $("#installBtn").textContent = t("install");
  $$(".ti").forEach((e) => (e.innerHTML = ico(e.dataset.ico)));
  $("#dbInfo").textContent = t("dbInfo", { n: Object.keys(DRUGS).length, m: Object.keys(ALIASES).length }) + (S.lang === "en" ? " · " + t("contentLangNote") : "");
  renderThumbs(); renderSuggest(); renderHist(); if (st.cur) renderDrug(); if (st.lastOcr) renderCands();
  fillSettings();
}

/* ------------------------------------------------------------------ text normalisation + fuzzy drug matching */
const AR = { "ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "أ": "ا", "إ": "ا", "ؤ": "و", "ئ": "ی" };
function norm(s) {
  s = String(s || "").replace(/[يكۀةأإؤئ]/g, (c) => AR[c]);
  s = s.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  s = s.replace(/[ً-ٰٟـ]/g, "").replace(/‌/g, " ").replace(/‍/g, "").toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s+.]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}
const isFa = (s) => /[؀-ۿ]/.test(s);
const IDX = [];
for (const [key, names] of Object.entries(ALIASES)) {
  const seen = new Set();
  for (const nm of [key, ...names]) { const n = norm(nm); if (n.length >= 3 && !seen.has(n)) { seen.add(n); IDX.push({ n, key, raw: nm }); } }
}
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function findDrugs(text) {
  const t0 = norm(text), padded = " " + t0 + " ", toks = t0.split(" ").filter(Boolean);
  const found = new Map();
  const add = (key, score, hit) => { const c = found.get(key); if (!c || c.score < score) found.set(key, { key, score, hit }); };
  for (const x of IDX) if (x.n.length >= 4 && padded.includes(" " + x.n + " ")) add(x.key, 1, x.raw);
  // persian words are often glued or split by OCR: also look inside the space-free text
  const glued = t0.replace(/ /g, "");
  for (const x of IDX) if (isFa(x.n) && x.n.length >= 6 && glued.includes(x.n.replace(/ /g, ""))) add(x.key, 0.97, x.raw);
  for (const x of IDX) if (!isFa(x.n) && x.n.length >= 8 && glued.includes(x.n.replace(/ /g, ""))) add(x.key, 0.93, x.raw);
  const grams = new Set();
  for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= toks.length; i++) { const g = toks.slice(i, i + n).join(" "); if (g.length >= 6 && g.length <= 40) grams.add(g); }
  for (const g of grams) for (const x of IDX) {
    const L = x.n.length; if (L < 6) continue;
    const max = L >= 12 ? 3 : L >= 9 ? 2 : L >= 7 ? 1 : 0; if (!max) continue;
    const d = lev(g, x.n, max);
    if (d <= max) add(x.key, 0.95 - d * 0.07, x.raw);
  }
  return [...found.values()].filter((c) => c.score >= 0.8)
    .sort((a, b) => (b.score - a.score) || ((DRUGS[b.key] ? 1 : 0) - (DRUGS[a.key] ? 1 : 0)));
}
const faName = (key) => DRUGS[key]?.fa || (ALIASES[key] || []).find(isFa) || key;
const titleEn = (k) => k.replace(/\b\w/g, (c) => c.toUpperCase());

function extractFacts(text) {
  const t0 = String(text || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const out = [], seen = new Set();
  const push = (k, v) => { v = v.replace(/\s+/g, " ").trim(); if (v && !seen.has(k + v)) { seen.add(k + v); out.push([k, v]); } };
  for (const m of t0.matchAll(/(\d+(?:[.,٫]\d+)?)\s*(mg|mcg|µg|g|ml|iu|میلی\s?گرم|میکروگرم|گرم|میلی\s?لیتر|واحد)\b/gi)) push(S.lang === "fa" ? "مقدار" : "Strength", m[0]);
  const q = t0.match(/(\d{1,4})\s*(قرص|کپسول|عدد|آمپول|tablets?|capsules?|tabs?|caps?|ampoules?)/i); if (q) push(S.lang === "fa" ? "تعداد" : "Quantity", q[0]);
  const f = t0.match(/(قرص|کپسول|شربت|آمپول|قطره|پماد|کرم|اسپری|سوسپانسیون|tablets?|capsules?|syrup|injection|cream|ointment|drops|spray|suspension)/i); if (f) push(S.lang === "fa" ? "شکل" : "Form", f[0]);
  const e = t0.match(/(exp(?:iry)?\.?|تاریخ انقضا|انقضا)[^\d]{0,10}(\d{2,4}[\/\-.]\d{1,2}(?:[\/\-.]\d{1,4})?)/i); if (e) push(S.lang === "fa" ? "انقضا" : "Expiry", e[2]);
  return out.slice(0, 8);
}

/* ------------------------------------------------------------------ images + OCR */
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { return await createImageBitmap(file); }
}
async function shrink(file, max, q = 0.85) {
  const bmp = await loadBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, "image/jpeg", q));
}
async function addFiles(list) {
  for (const f of [...list]) {
    if (!f.type.startsWith("image/")) continue;
    if (st.images.length >= 4) { toast(t("maxImgs")); break; }
    try {
      const blob = await shrink(f, 2000, 0.9), thumb = await shrink(f, 360, 0.7);
      const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(thumb); });
      st.images.push({ blob, url });
    } catch { toast(t("badImg")); }
  }
  renderThumbs();
}
function renderThumbs() {
  $("#thumbs").innerHTML = st.images.map((im, i) => `<div class="thumb"><img src="${im.url}" alt=""><button data-rm="${i}" aria-label="remove">${ico("x")}</button></div>`).join("");
  $("#imgCount").textContent = st.images.length ? `${st.images.length}/4 ${t("images")}` : "";
  $("#scanBtn").disabled = !st.images.length || st.busy;
}
function binarize(ctx, c, invert) {
  const w = c.width, h = c.height, im = ctx.getImageData(0, 0, w, h), d = im.data, g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; g[j] = invert ? 255 - v : v; }
  const W = w + 1, ii = new Uint32Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; ii[(y + 1) * W + x + 1] = ii[y * W + x + 1] + row; } }
  const r = Math.max(8, (Math.min(w, h) / 20) | 0);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = g[y * w + x] < mean * 0.93 ? 0 : 255, o = (y * w + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = v;
    }
  }
  ctx.putImageData(im, 0, 0);
}
function stretch(ctx, c) {
  const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++; }
  const total = c.width * c.height; let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.02) { hi = i; break; } }
  const span = Math.max(40, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(im, 0, 0);
}
/* mode: enh (contrast stretch) | bin (adaptive threshold) | inv (adaptive threshold on inverted image); rot: 0/90/270 */
async function prepCanvas(blob, mode, rot = 0, maxSide = 1500) {
  const bmp = await loadBitmap(blob);
  const k = Math.min(1.5, maxSide / Math.max(bmp.width, bmp.height)), sw = Math.round(bmp.width * k), sh = Math.round(bmp.height * k);
  const c = document.createElement("canvas"), swap = rot === 90 || rot === 270;
  c.width = swap ? sh : sw; c.height = swap ? sw : sh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate((rot * Math.PI) / 180); ctx.drawImage(bmp, -sw / 2, -sh / 2, sw, sh); ctx.restore();
  if (mode === "enh") stretch(ctx, c); else if (mode === "bin") { stretch(ctx, c); binarize(ctx, c, false); } else if (mode === "inv") { stretch(ctx, c); binarize(ctx, c, true); }
  return c;
}
const WORKERS = {};
const abs = (p) => new URL(p, location.href).href.replace(/\/$/, "");
const NATIVE = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const DBG = []; let LIVE = () => {}, T0 = Date.now();
const dbg = (m) => { DBG.push(((Date.now() - T0) / 1000).toFixed(1) + "s " + m); if (DBG.length > 80) DBG.shift(); };
function getWorker(lang) {
  if (WORKERS[lang]) return WORKERS[lang];
  const H = { f: null }; dbg("create worker " + lang);
  const p = Tesseract.createWorker(lang, 1, {
    workerPath: abs("lib/tess/worker.min.js"), corePath: abs("lib/tess/core"), langPath: abs("lib/tess/lang"),
    gzip: true, workerBlobURL: false, cacheMethod: "none",
    logger: (m) => { if (m.status !== "recognizing text") dbg(m.status + " " + Math.round((m.progress || 0) * 100) + "%"); LIVE(m); H.f && H.f(m); },
  }).then((w) => { dbg("worker ready " + lang); w._set = (f) => { H.f = f; }; return w; });
  p.catch((e) => { dbg("worker error " + (e && e.message)); delete WORKERS[lang]; });
  return (WORKERS[lang] = p);
}
const withTimeout = (p, ms, label) => new Promise((res, rej) => { const id = setTimeout(() => rej(new Error("timeout " + label)), ms); p.then((v) => { clearTimeout(id); res(v); }, (e) => { clearTimeout(id); rej(e); }); });
async function mlkitText(blob, i) {
  const P = window.Capacitor.Plugins, FS = P.Filesystem, TR = P.TextRecognition;
  if (!FS || !TR) throw new Error("plugin missing");
  const b64 = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.onerror = j; fr.readAsDataURL(blob); });
  const f = await FS.writeFile({ path: "aksir_scan_" + i + ".jpg", data: b64, directory: "CACHE" });
  try { const res = await TR.processImage({ path: f.uri, script: "LATIN" }); return res.text || ""; }
  finally { try { await FS.deleteFile({ path: f.uri }); } catch {} }
}
function planFor(pref) {
  const E = [["eng", "11", "enh", 0, "eng"], ["eng", "11", "bin", 0, "alt"], ["eng", "11", "enh", 90, "rot"], ["eng", "11", "enh", 270, "rot"]];
  const F = (l) => [[l, "11", "enh", 0, "fas"], [l, "3", "bin", 0, "fas"], [l, "11", "enh", 90, "rot"], [l, "11", "enh", 270, "rot"]];
  return pref === "eng" ? E : pref === "fas" ? F("fas") : [E[0], ...F("fas+eng"), ...E.slice(1)];
}
async function runOcr(onStage, onProgress) {
  const imgs = st.images, n = imgs.length; let text = "", conf = 0, cnt = 0; const start = Date.now();
  DBG.length = 0; T0 = Date.now(); dbg("scan start, images=" + n + ", native=" + NATIVE());
  const good = () => (findDrugs(text)[0]?.score || 0) >= 0.9;
  const done = () => ({ text: text.trim(), conf: cnt ? conf / cnt : 0, log: DBG.join("\n") });
  if (NATIVE()) {
    onStage("native");
    for (let i = 0; i < n; i++) {
      try { const tx = await withTimeout(mlkitText(imgs[i].blob, i), 40000, "mlkit"); dbg("mlkit " + i + " chars=" + tx.length); text += "\n" + tx; conf += 80; cnt++; onProgress((i + 1) / n); }
      catch (e) { dbg("mlkit failed: " + (e && (e.message || e))); }
      if (good()) return done();
    }
  }
  for (const [lang, psm, mode, rot, label] of planFor(S.ocr)) {
    if (Date.now() - start > 170000) { dbg("time budget over"); break; }
    try {
      onStage("load");
      const w = await withTimeout(getWorker(lang), 120000, "load " + lang);
      onStage(label);
      await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_do_invert: mode === "inv" ? "1" : "0", preserve_interword_spaces: "1" });
      for (let i = 0; i < n; i++) {
        w._set((m) => { if (m.status === "recognizing text") onProgress((i + m.progress) / n); });
        const c = await prepCanvas(imgs[i].blob, mode, rot, 1100);
        const t1 = Date.now();
        let r;
        try { r = await withTimeout(w.recognize(c), 60000, "recognize"); }
        catch (e) { dbg("recognize failed " + e.message); try { w.terminate(); } catch {} delete WORKERS[lang]; throw e; }
        dbg("tess " + lang + " psm" + psm + " " + mode + " rot" + rot + " " + ((Date.now() - t1) / 1000).toFixed(1) + "s");
        text += "\n" + (r.data.text || ""); conf += r.data.confidence || 0; cnt++;
        await new Promise((r2) => setTimeout(r2, 0));
        if (good()) return done();
      }
    } catch (e) { dbg("step failed: " + (e && e.message)); }
  }
  return done();
}
async function doScan() {
  if (!st.images.length || st.busy) return;
  st.busy = true; $("#scanBtn").disabled = true; $("#progress").hidden = false;
  const t0 = Date.now(), pt = $("#progressText"), fill = $("#barFill");
  const timer = setInterval(() => { const base = pt.dataset.base || ""; pt.textContent = base + ` · ${Math.round((Date.now() - t0) / 1000)} ${t("sec")}`; }, 1000);
  LIVE = (m) => { if (m.status && m.status !== "recognizing text") { pt.dataset.base = (pt.dataset.stage || "") + " · " + m.status + " " + Math.round((m.progress || 0) * 100) + "%"; } };
  const setStage = (k) => { pt.dataset.stage = t("stage_" + k); pt.dataset.base = t("stage_" + k); pt.textContent = pt.dataset.base; if (k === "load") fill.style.width = "6%"; };
  try {
    const r = await runOcr(setStage, (p) => (fill.style.width = Math.max(8, Math.round(p * 100)) + "%"));
    fill.style.width = "100%";
    st.lastOcr = { log: r.log, text: r.text, conf: r.conf, found: findDrugs(r.text), facts: extractFacts(r.text), thumb: st.images[0]?.url || "" };
    renderCands();
    $("#candCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (st.lastOcr.found.length === 1 || (st.lastOcr.found[0] && st.lastOcr.found[0].score >= 0.97 && DRUGS[st.lastOcr.found[0].key])) { /* wait for user tap: avoids wrong auto-picks */ }
  } catch (e) { console.warn(e); toast(t("ocrFail")); }
  clearInterval(timer); st.busy = false; $("#progress").hidden = true; fill.style.width = "0%"; renderThumbs();
}
function renderCands() {
  const o = st.lastOcr; if (!o) return;
  $("#candCard").hidden = false;
  $("#ocrChip").textContent = o.conf >= 60 ? t("ocrDone") : t("ocrLow");
  const list = o.found.slice(0, 5);
  $("#cands").innerHTML = list.length ? list.map((c, i) => `<button class="cand" data-key="${esc(c.key)}">
      <span class="nm"><b>${esc(faName(c.key))}</b><small>${esc(titleEn(c.key))}</small></span>
      <span class="badge ${c.score >= 0.97 ? "" : "maybe"}">${c.score >= 0.97 ? t("sure") : t("maybe")}</span><span class="go">${ico("chev")}</span></button>`).join("")
    + (list.length > 1 ? `<button class="btn soft" data-all="1">${S.lang === "fa" ? "همهٔ این‌ها (بستهٔ ترکیبی)" : "All of these (combination pack)"}</button>` : "")
    : `<p class="muted sm">${t("noMatch")}</p>`;
  $("#facts").innerHTML = o.facts.map(([k, v]) => `<span><b>${esc(k)}</b>${esc(v)}</span>`).join("");
  $("#rawText").textContent = o.text + (o.log ? "\n\n--- log ---\n" + o.log : "");
}

/* ------------------------------------------------------------------ history (IndexedDB with localStorage fallback) */
const HIST = {
  db: null,
  async open() {
    if (this.db) return this.db;
    return (this.db = await new Promise((res, rej) => {
      const r = indexedDB.open("aksir-offline", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("scans", { keyPath: "id" });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async all() {
    try { const db = await this.open(); return await new Promise((res, rej) => { const q = db.transaction("scans").objectStore("scans").getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
    catch { try { return JSON.parse(localStorage.getItem("aksir.m.hist") || "[]"); } catch { return []; } }
  },
  async put(rec) {
    try { const db = await this.open(); await new Promise((res, rej) => { const q = db.transaction("scans", "readwrite").objectStore("scans").put(rec); q.onsuccess = res; q.onerror = () => rej(q.error); }); }
    catch { const a = await this.all(); const i = a.findIndex((x) => x.id === rec.id); if (i >= 0) a[i] = rec; else a.push(rec); try { localStorage.setItem("aksir.m.hist", JSON.stringify(a)); } catch {} }
  },
  async del(id) {
    try { const db = await this.open(); await new Promise((res) => { const q = db.transaction("scans", "readwrite").objectStore("scans").delete(id); q.onsuccess = res; q.onerror = res; }); }
    catch { const a = (await this.all()).filter((x) => x.id !== id); try { localStorage.setItem("aksir.m.hist", JSON.stringify(a)); } catch {} }
  },
  async clear() { for (const r of await this.all()) await this.del(r.id); try { localStorage.removeItem("aksir.m.hist"); } catch {} },
};
async function loadHist() { st.hist = (await HIST.all()).sort((a, b) => b.ts - a.ts); renderHist(); }
function renderHist() {
  const box = $("#histList"); if (!box) return;
  const loc = S.lang === "fa" ? "fa-IR" : "en-GB";
  box.innerHTML = st.hist.length ? st.hist.map((h) => `<div class="hitem" data-id="${h.id}">
      ${h.thumb ? `<img src="${h.thumb}" alt="">` : `<span class="ph">${ico("pill")}</span>`}
      <button class="tx" data-open="${h.id}"><b>${esc(h.keys.map(faName).join(" + "))}</b><small>${esc(new Date(h.ts).toLocaleString(loc))}${h.qa?.length ? " · " + h.qa.length + (S.lang === "fa" ? " پرسش" : " Q") : ""}</small></button>
      <button class="rm" data-del="${h.id}" aria-label="${t("del")}">${ico("trash")}</button></div>`).join("")
    : `<p class="muted sm">${t("emptyHist")}</p>`;
  const si = $("#storageInfo"); if (si) si.textContent = t("storage", { n: st.hist.length });
}
async function saveCur() {
  const c = st.cur; if (!c) return;
  const rec = { id: c.id, ts: c.ts, keys: c.keys, thumb: c.thumb || "", ocr: (c.ocr || "").slice(0, 2000), qa: c.qa };
  await HIST.put(rec);
  const i = st.hist.findIndex((x) => x.id === rec.id); if (i >= 0) st.hist[i] = rec; else st.hist.unshift(rec);
  renderHist();
}

/* ------------------------------------------------------------------ views */
function showView(v, push) {
  st.view = v;
  $$(".view").forEach((e) => (e.hidden = e.id !== "v-" + v));
  $$("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.v === v || (v === "drug" && b.dataset.v === st.from)));
  if (v === "drug" && push !== false) history.pushState({ v: "drug" }, "");
  window.scrollTo({ top: 0 });
}
function openDrug(keys, extra = {}) {
  st.from = st.view === "history" ? "history" : "scan";
  st.cur = { id: extra.id || "s" + Date.now(), ts: extra.ts || Date.now(), keys: keys.slice(), active: keys[0], qa: extra.qa || [], thumb: extra.thumb || "", ocr: extra.ocr || "" };
  $("#messages").innerHTML = ""; renderDrug(); renderMessages(); showView("drug"); saveCur();
}
const SECS = ["use", "how", "side", "serious", "inter", "warn", "contra", "preg", "over"];
function renderDrug() {
  const c = st.cur; if (!c) return;
  const d = DRUGS[c.active];
  const head = $("#drugHead");
  head.innerHTML = `<h2>${esc(faName(c.active))}</h2><div class="en">${esc(titleEn(c.active))}</div>` +
    (d ? `<span class="chip cls">${esc(d.cls)}</span>` : "") +
    (c.keys.length > 1 ? `<p class="note">${t("combo")}</p>` : "") +
    (S.lang === "en" ? `<p class="note">${t("contentLangNote")}</p>` : "");
  $("#alts").innerHTML = c.keys.length > 1 ? c.keys.map((k) => `<button data-k="${esc(k)}" class="${k === c.active ? "on" : ""}">${esc(faName(k).split(" (")[0])}</button>`).join("") : "";
  const box = $("#sections");
  if (!d) { box.innerHTML = `<p class="muted">${t("unknownDrug")}<br>${t("unknownHelp")}</p>`; return; }
  box.innerHTML = SECS.filter((s) => d[s].length).map((s, i) => `<details class="${s === "serious" ? "serious" : ""}" ${s === "use" ? "open" : ""}>
      <summary>${t("s_" + s)}</summary><div class="body"><ul>${d[s].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="tools"><button class="ghost" data-listen="${s}">${ico("vol")}${t("listen")}</button></div></div></details>`).join("");
}
function renderSuggest() {
  $("#suggest").innerHTML = t("sug").map((q) => `<button type="button">${esc(q)}</button>`).join("");
}

/* ------------------------------------------------------------------ offline Q&A (keyword + section retrieval, no language model) */
const INTENT = {
  use: ["کاربرد", "برای چی", "چه کاری", "به چه درد", "مصرف میشه", "مصرف می شه", "چیه", "چیست", "used for", "what is", "use"],
  side: ["عارضه", "عوارض", "side effect", "adverse"],
  serious: ["جدی", "اورژانس", "فوری", "خطرناک", "serious", "emergency"],
  inter: ["تداخل", "همزمان", "با چه دارو", "با کدوم دارو", "interact"],
  warn: ["هشدار", "احتیاط", "مراقب", "warning", "caution"],
  contra: ["ممنوع", "نباید", "منع", "contraindic"],
  how: ["چطور", "چگونه", "نحوه", "قبل غذا", "بعد غذا", "ناشتا", "ساعت", "چند بار", "how to", "how do"],
  preg: ["بارداری", "حامله", "شیر", "شیردهی", "pregnan", "breastfeed", "lactat"],
  over: ["مسمومیت", "زیاد خوردم", "بیش از حد", "overdose"],
};
const TOPICS = {
  "الکل": ["الکل", "الكل", "alcohol"], "رانندگی": ["رانندگی", "driving"], "غذا": ["غذا", "ناشتا", "شیر", "لبنیات", "food", "milk"],
  "آفتاب": ["آفتاب", "نور", "sun"], "کودک": ["کودک", "بچه", "نوزاد", "child", "kid", "baby"], "سالمند": ["سالمند", "پیر", "elderly"],
  "کلیه": ["کلیه", "کلیوی", "kidney"], "کبد": ["کبد", "کبدی", "liver"], "قلب": ["قلب", "قلبی", "heart"], "معده": ["معده", "گوارش", "stomach"],
  "خواب": ["خواب", "sleep", "drowsy"], "فشار": ["فشار", "blood pressure"], "قند": ["قند", "دیابت", "diabetes", "sugar"],
  "وابستگی": ["وابستگی", "اعتیاد", "addict", "dependen"], "قطع": ["قطع", "ناگهانی", "stop"], "آلرژی": ["آلرژی", "حساسیت", "کهیر", "allerg"],
  "خونریزی": ["خونریزی", "کبودی", "bleed"], "تهوع": ["تهوع", "استفراغ", "nausea", "vomit"], "بارداری": ["بارداری", "حامله", "شیر", "pregnan"],
  "آنتی بیوتیک": ["آنتی بیوتیک", "antibiotic"], "ورزش": ["ورزش", "exercise"], "جراحی": ["جراحی", "عمل", "surgery"], "قارچ": ["قارچ"], "سرماخوردگی": ["سرماخوردگی", "سرما", "cold", "flu"],
};
const STOP = new Set(["این", "آن", "را", "با", "از", "به", "که", "در", "و", "یا", "هم", "می", "شه", "میشه", "است", "هست", "دارو", "قرص", "کنم", "کرد", "بعد", "قبل", "چه", "چی", "کدام", "آیا", "the", "is", "a", "of", "to", "can", "i", "it", "this", "drug", "medicine"]);
const stem = (w) => w.replace(/(ها|های|ان|ات|ی|ام|ایی)$/u, "");
function tokens(s) { return norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem); }
function answer(key, q) {
  const d = DRUGS[key], nq = norm(q);
  if (!d) return { html: `<p class="none">${t("noAnswer")}</p>`, text: t("noAnswer") };
  const intents = Object.entries(INTENT).filter(([, ws]) => ws.some((w) => nq.includes(norm(w)))).map(([k]) => k);
  const topics = Object.entries(TOPICS).filter(([, ws]) => ws.some((w) => nq.includes(norm(w)))).map(([, ws]) => ws.map(norm));
  const qt = tokens(q);
  const hits = [];
  for (const s of SECS) d[s].forEach((b, i) => {
    const nb = norm(b), bt = new Set(tokens(b)); let sc = 0;
    for (const w of qt) if (bt.has(w) || nb.includes(w)) sc += 1;
    for (const ws of topics) if (ws.some((w) => nb.includes(w))) sc += 3;
    if (intents.includes(s)) sc += 2;
    if (sc > 0) hits.push({ s, i, b, sc: sc + (s === "serious" || s === "inter" ? 0.1 : 0) });
  });
  let secs = [];
  if (intents.length && !topics.length) {
    secs = intents.filter((s) => d[s].length).slice(0, 2).map((s) => ({ s, items: d[s].map((b) => ({ b, mark: false })) }));
  } else {
    hits.sort((a, b) => b.sc - a.sc);
    const top = hits.filter((h) => h.sc >= Math.max(2, hits[0]?.sc - 3 || 2)).slice(0, 6);
    const by = {}; top.forEach((h) => (by[h.s] = by[h.s] || []).push({ b: h.b, mark: true }));
    secs = Object.entries(by).map(([s, items]) => ({ s, items }));
  }
  if (!secs.length) {
    const fb = ["use", "warn", "side"].filter((s) => d[s].length).slice(0, 2).map((s) => ({ s, items: d[s].slice(0, 3).map((b) => ({ b })) }));
    const txt = t("noAnswer");
    return { html: `<p class="none">${txt}</p><h4>${t("fromSections")}</h4>` + fb.map(secHtml).join(""), text: txt + " " + fb.map(secText).join(" ") };
  }
  return { html: secs.map(secHtml).join(""), text: secs.map(secText).join(" ") };
}
const secHtml = ({ s, items }) => `<h4>${t("s_" + s)}</h4><ul>${items.map((x) => `<li>${esc(x.b)}</li>`).join("")}</ul>`;
const secText = ({ s, items }) => t("s_" + s) + ": " + items.map((x) => x.b).join("؛ ") + ".";

function msgHTML(m, i) {
  if (m.role === "user") return `<div class="msg user"><div class="bubble">${esc(m.q)}</div></div>`;
  return `<div class="msg assistant" data-i="${i}"><div class="bubble ans">${m.html}</div>
    <div class="tools"><button class="ghost" data-act="listen">${ico("vol")}${t("listen")}</button><button class="ghost" data-act="copy">${ico("copy")}${t("copy")}</button></div></div>`;
}
function renderMessages() {
  const c = st.cur; if (!c) return;
  const out = []; c.qa.forEach((x, i) => { out.push(msgHTML({ role: "user", q: x.q })); out.push(msgHTML({ role: "assistant", html: x.html }, i)); });
  $("#messages").innerHTML = out.join("");
}
function ask(q) {
  q = (q || "").trim(); if (!q || !st.cur) return;
  const a = answer(st.cur.active, q);
  st.cur.qa.push({ q, html: a.html, text: a.text, key: st.cur.active });
  renderMessages(); saveCur();
  const last = $("#messages").lastElementChild; if (last) last.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ------------------------------------------------------------------ voice (device speech engine, offline if the voice pack is installed) */
let VOICES = [];
const loadVoices = () => { try { VOICES = speechSynthesis.getVoices(); } catch { VOICES = []; } fillSettings(); };
function voiceFor(lang) { return VOICES.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang)); }
function stopSpeak() { try { speechSynthesis.cancel(); } catch {} $$(".ghost.playing").forEach((b) => b.classList.remove("playing")); st.audio = null; }
function speak(text, btn) {
  if (!("speechSynthesis" in window)) return toast(t("noVoice"));
  const same = st.audio === btn; stopSpeak(); if (same) return;
  const lang = isFa(text) ? "fa" : "en", v = voiceFor(lang);
  if (lang === "fa" && !v) toast(t("noVoice"));
  const parts = text.replace(/\[\d+\]/g, "").split(/(?<=[.؛!؟?:])\s+/).flatMap((p) => (p.length > 220 ? p.split(/،|,/) : [p])).filter((p) => p.trim());
  btn.classList.add("playing"); st.audio = btn;
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p); u.lang = lang === "fa" ? "fa-IR" : "en-US"; if (v) u.voice = v; u.rate = 0.95;
    if (i === parts.length - 1) { u.onend = u.onerror = () => { if (st.audio === btn) stopSpeak(); }; }
    speechSynthesis.speak(u);
  });
}

/* ------------------------------------------------------------------ report */
function reportHTML() {
  const c = st.cur, d = DRUGS[c.active], fa = S.lang === "fa";
  const sec = d ? SECS.filter((s) => d[s].length).map((s) => `<h2>${t("s_" + s)}</h2><ul>${d[s].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("") : `<p>${t("unknownDrug")}</p>`;
  const qa = c.qa.map((x) => `<div class="q">${esc(x.q)}</div><div class="a">${x.html}</div>`).join("");
  return `<!doctype html><html lang="${S.lang}" dir="${fa ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(faName(c.active))}</title>
<style>body{font-family:Vazirmatn,Tahoma,system-ui,sans-serif;background:#f3f5f7;color:#16202a;margin:0;padding:24px 12px;line-height:1.9}main{max-width:780px;margin:auto;background:#fff;border-radius:20px;padding:30px}
header{border-bottom:3px solid ${esc(S.accent)};padding-bottom:12px}h1{margin:0}h2{font-size:17px;margin:22px 0 6px;color:#0b3d33}li{margin:4px 0}.q{background:#eef6f3;border-radius:12px;padding:8px 14px;margin:12px 0 4px;font-weight:700}.a{padding:2px 14px 8px;border-inline-start:3px solid ${esc(S.accent)}}.a h4{margin:6px 0 2px;color:#0b3d33}
.disc{background:#fff8e6;border:1px solid #f0d9a0;border-radius:12px;padding:12px;font-size:13px;margin-top:22px}footer{margin-top:16px;font-size:12px;color:#657786;display:flex;justify-content:space-between;flex-wrap:wrap}@media print{body{background:#fff;padding:0}}</style>
<main><header><h1>${esc(faName(c.active))}</h1><small>${esc(titleEn(c.active))} · ${new Date().toLocaleString(fa ? "fa-IR" : "en-GB")}</small></header>${c.thumb ? `<p><img src="${c.thumb}" style="height:120px;border-radius:12px"></p>` : ""}${sec}${qa ? `<h2>${t("askTitle")}</h2>${qa}` : ""}
<div class="disc">${t("disclaimer")}</div><footer><span>${t("footer")}</span></footer></main></html>`;
}
async function doReport() {
  if (!st.cur) return;
  const html = reportHTML(), file = new File([html], "aksir-report.html", { type: "text/html" });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Aksir" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = "aksir-report.html"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { const w = window.open(a.href, "_blank"); if (!w) toast(t("copied")); }, 300);
}

/* ------------------------------------------------------------------ manual search */
function suggest(inputEl, boxEl) {
  const q = norm(inputEl.value); if (q.length < 2) { boxEl.hidden = true; return; }
  const seen = new Map();
  for (const x of IDX) if (x.n.includes(q) && !seen.has(x.key)) seen.set(x.key, x.n.startsWith(q) ? 0 : 1);
  const res = [...seen.entries()].sort((a, b) => (a[1] - b[1]) || ((DRUGS[b[0]] ? 1 : 0) - (DRUGS[a[0]] ? 1 : 0))).slice(0, 8).map(([k]) => k);
  boxEl.innerHTML = res.map((k) => `<button type="button" data-key="${esc(k)}"><span>${esc(faName(k))}</span><small>${esc(titleEn(k))}</small></button>`).join("");
  boxEl.hidden = !res.length;
}

/* ------------------------------------------------------------------ settings dialog */
function fillSettings() {
  $$("#appearSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.appearance));
  $$("#ocrSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.ocr));
  $("#swatches").innerHTML = PRESETS.map(([c, n]) => `<button class="sw ${c.toLowerCase() === S.accent.toLowerCase() ? "on" : ""}" style="--c:${c}" data-c="${c}" title="${n}" type="button" aria-label="${n}"></button>`).join("");
  $("#accentPick").value = S.accent; $("#fontSize").value = S.fontSize;
  const vi = $("#voiceInfo"); if (vi) vi.textContent = voiceFor("fa") ? t("voiceOk") : t("voiceNone");
}
let DEFERRED = null;
function bindSettings() {
  $("#settingsBtn").onclick = () => { fillSettings(); $("#settings").showModal(); };
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") e.target.close(); });
  $("#appearSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.appearance = b.dataset.v; saveS(); applyTheme(); fillSettings(); });
  $("#ocrSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.ocr = b.dataset.v; saveS(); fillSettings(); });
  $("#swatches").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; S.accent = b.dataset.c; saveS(); applyTheme(); fillSettings(); });
  $("#accentPick").addEventListener("input", (e) => { S.accent = e.target.value; saveS(); applyTheme(); $$(".sw").forEach((s) => s.classList.remove("on")); });
  $("#fontSize").addEventListener("input", (e) => { S.fontSize = +e.target.value; saveS(); applyTheme(); });
  $("#testVoice").onclick = (e) => speak(S.lang === "fa" ? "سلام، من اکسیر هستم. اطلاعات دارو را برایت می‌خوانم." : "Hello, this is Aksir. I will read drug information aloud.", e.currentTarget);
  $("#clearHist").onclick = async () => { if (confirm(t("confirmClear"))) { await HIST.clear(); st.hist = []; renderHist(); toast(t("cleared")); } };
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); DEFERRED = e; $("#installBtn").hidden = false; });
  $("#installBtn").onclick = async () => { if (DEFERRED) { DEFERRED.prompt(); DEFERRED = null; $("#installBtn").hidden = true; } };
}

/* ------------------------------------------------------------------ wiring */
window.__aksir = { findDrugs, norm };
function init() {
  applyTheme(); bindSettings(); applyLang();
  if (!NATIVE()) setTimeout(() => { try { getWorker(S.ocr === "fas" ? "fas" : "eng"); } catch {} }, 1500);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => S.appearance === "system" && applyTheme());
  $("#langBtn").onclick = () => { S.lang = S.lang === "fa" ? "en" : "fa"; saveS(); applyLang(); };
  $("#camBtn").onclick = () => $("#capture").click(); $("#pickBtn").onclick = () => $("#file").click();
  $("#file").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
  $("#capture").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  $("#thumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { st.images.splice(+b.dataset.rm, 1); renderThumbs(); } });
  $("#scanBtn").onclick = doScan;
  $("#cands").addEventListener("click", (e) => {
    const o = st.lastOcr, b = e.target.closest("[data-key]"), all = e.target.closest("[data-all]");
    const base = { thumb: o?.thumb, ocr: o?.text };
    if (b) openDrug([b.dataset.key, ...o.found.map((c) => c.key).filter((k) => k !== b.dataset.key).slice(0, 0)], base);
    else if (all) openDrug(o.found.slice(0, 4).map((c) => c.key), base);
  });
  const q1 = $("#q1"), s1 = $("#sugg1");
  q1.addEventListener("input", () => suggest(q1, s1));
  q1.addEventListener("keydown", (e) => { if (e.key === "Enter") { const f = s1.querySelector("button"); if (f) f.click(); } });
  s1.addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) { s1.hidden = true; q1.value = ""; openDrug([b.dataset.key]); } });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) s1.hidden = true; });
  $("#backBtn").onclick = () => history.back();
  window.addEventListener("popstate", () => { if (st.view === "drug") { stopSpeak(); showView(st.from === "history" ? "history" : "scan", false); } });
  $("#alts").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b && st.cur) { st.cur.active = b.dataset.k; renderDrug(); } });
  $("#suggest").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) ask(b.textContent); });
  $("#composer").onsubmit = (e) => { e.preventDefault(); const i = $("#input"); const q = i.value; i.value = ""; ask(q); };
  $("#messages").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]"), msg = e.target.closest(".msg"); if (!act || !msg) return;
    const a = st.cur.qa[+msg.dataset.i]; if (act.dataset.act === "copy") { navigator.clipboard?.writeText(a.text); toast(t("copied")); } else speak(a.text, act);
  });
  $("#sections").addEventListener("click", (e) => {
    const b = e.target.closest("[data-listen]"); if (!b || !st.cur) return;
    const d = DRUGS[st.cur.active]; speak(t("s_" + b.dataset.listen) + ". " + d[b.dataset.listen].join("؛ ") + ".", b);
  });
  $("#reportBtn").onclick = doReport;
  $("#tabbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { stopSpeak(); showView(b.dataset.v); } });
  $("#histList").addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]"), r = e.target.closest("[data-del]");
    if (o) { const h = st.hist.find((x) => x.id === o.dataset.open); if (h) { st.view = "history"; openDrug(h.keys, { id: h.id, ts: h.ts, qa: h.qa, thumb: h.thumb, ocr: h.ocr }); } }
    if (r) { HIST.del(r.dataset.del).then(() => { st.hist = st.hist.filter((x) => x.id !== r.dataset.del); renderHist(); }); }
  });
  try { speechSynthesis.onvoiceschanged = loadVoices; loadVoices(); } catch {}
  loadHist();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register("sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", init);
})();
