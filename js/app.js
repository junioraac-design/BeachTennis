"use strict";
/* =====================================================================
 * Beach Tennis Score — interface
 *
 *  M          partida do motor de regras { S, undo, G } (js/engine.js)
 *  S          atalho para M.S (estado da partida, sem fotos)
 *  P          fotos [[dupla1], [dupla2]] (data URLs pequenas, salvas à parte)
 *  T          relógio  { base, runStart }
 * ===================================================================== */
const E = BTEngine;
const KEY = "beachtennis:v3", KEY_PHOTOS = "beachtennis:photos", KEY_CFG = "beachtennis:cfg";
const PT = E.PT;

let M = null, S = null, P = [[null, null], [null, null]], T = null;
let savedId = null;      // id da partida no histórico (se já foi salva)
let tref = null;         // vínculo com torneio: { id, matchId }
let ticker = null, wakeLock = null, lastTap = 0, alertTimer = null;
const setupPhotos = [[null, null], [null, null]];

const $ = (id) => document.getElementById(id);
const other = E.other, clone = E.clone;
const safe = (fn) => { try { return fn(); } catch (_) { return undefined; } };

/* ---------------- Persistência ---------------- */
function save() {
  if (!M) return;
  safe(() => localStorage.setItem(KEY, JSON.stringify({ S: M.S, undo: M.undo, G: M.G, T, savedId, tref, savedAt: Date.now() })));
  safe(() => localStorage.setItem(KEY_PHOTOS, JSON.stringify(P)));
  if (typeof syncPush === "function") syncPush();
}
function loadSaved() {
  return safe(() => {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!d || !d.S || !d.T || !Array.isArray(d.S.names)) return null;
    if (!d.S.target) d.S.target = 6;
    d.P = JSON.parse(localStorage.getItem(KEY_PHOTOS) || "null") || [[null, null], [null, null]];
    return d;
  }) || null;
}

/* ---------------- Relógio ---------------- */
const elapsedMs = () => T.base + (T.runStart ? Date.now() - T.runStart : 0);
function fmt(ms) {
  const s = Math.floor(ms / 1000), p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
function startClock() { if (!T.runStart) T.runStart = Date.now(); }
function stopClock() { if (T.runStart) { T.base += Date.now() - T.runStart; T.runStart = null; } }
function renderTimer() {
  $("timer").textContent = fmt(elapsedMs());
  $("timer").classList.toggle("paused", !T.runStart && !S.finished);
}

/* ---------------- Partida ---------------- */
function startMatch(cfg, photos, torneio) {
  M = E.create(cfg); S = M.S;
  P = clone(photos);
  T = { base: 0, runStart: Date.now(), startedAt: new Date().toISOString() };
  savedId = null; tref = torneio || null;
  save();
  boot();
}
const gamesPlayed = () => E.gamesPlayed(S);
const needSecond = () => E.needSecond(S);
const currentServer = () => E.currentServer(S);

function addPoint(t) {
  if (!M || S.finished || needSecond()) return;
  if (!T.runStart) startClock();
  const info = E.addPoint(M, t);
  if (info && info.finished) stopClock();
  afterChange(info);
}

/* ---------------- Correção ---------------- */
function undoPoint() {
  const r = E.undoPoint(M);
  if (!r.ok) return toast(r.reason);
  S = M.S;
  if (r.wasFinished) { startClock(); discardSaved(); }
  afterChange(null, true);
}
function undoGame() {
  const r = E.undoGame(M);
  if (!r.ok) return toast(r.reason);
  S = M.S;
  if (r.wasFinished) { startClock(); discardSaved(); }
  afterChange(null, true);
}
function openEdit() {
  $("e-g0").value = S.games[0]; $("e-g1").value = S.games[1];
  const tb = S.tb;
  $("e-p0").value = tb ? S.tbPts[0] : S.points[0] > 3 ? 3 : PT[S.points[0]];
  $("e-p1").value = tb ? S.tbPts[1] : S.points[1] > 3 ? 3 : PT[S.points[1]];
  $("e-pts-h").textContent = tb ? "PONTOS DO TIE-BREAK" : "PONTOS (0, 15, 30, 40)";
  $("edit-note").textContent = "Ajuste os games e os pontos do game atual.";
  $("e-g0").max = $("e-g1").max = S.target + 1;
  $("dlg-edit").showModal();
}
function applyEdit() {
  const r = E.applyEdit(M, [+$("e-g0").value, +$("e-g1").value], [$("e-p0").value, $("e-p1").value]);
  if (!r.ok) return toast(r.reason);
  if (S.finished) stopClock(); else if (savedId) discardSaved();
  $("dlg-edit").close();
  afterChange(null, true);
}

/* ---------------- Render ---------------- */
const joinNames = (t) => `${S.names[t][0]} e ${S.names[t][1]}`;
const initial = (n) => (n.trim()[0] || "?").toUpperCase();

function paintPhoto(el, url, name) {
  el.style.backgroundImage = url ? `url("${url}")` : "";
  el.textContent = url ? "" : initial(name);
}
function makePhoto(url, name, extraClass) {
  const d = document.createElement("div");
  d.className = "photo " + (extraClass || "");
  paintPhoto(d, url, name);
  return d;
}

function renderTiles() {
  const [st, sp] = needSecond() ? [-1, -1] : (S.finished ? [-1, -1] : currentServer());
  for (const t of [0, 1]) {
    const box = $("tiles-" + t);
    box.textContent = "";
    for (let i = 0; i < 2; i++) {
      const serving = st === t && sp === i;
      const tile = document.createElement("div");
      tile.className = "tile";
      const ph = makePhoto(P[t][i], S.names[t][i], serving ? "serving" : "");
      if (serving) { const b = document.createElement("span"); b.className = "ball"; b.textContent = "🎾"; ph.appendChild(b); }
      const nm = document.createElement("div");
      nm.className = "nm" + (serving ? " srv" : "");
      nm.textContent = S.names[t][i];
      tile.append(ph, nm);
      box.appendChild(tile);
    }
  }
}

function xScore(a, b) {
  return `<span class="c1">${a}</span><span class="x"> x </span><span class="c2">${b}</span>`;
}
/* Placar na ordem em que as duplas aparecem na tela (esquerda x direita) */
function sideScore(v) {
  return S.swapped
    ? `<span class="c2">${v[1]}</span><span class="x"> x </span><span class="c1">${v[0]}</span>`
    : xScore(v[0], v[1]);
}
/* Cada dupla ocupa o lado em que está na quadra; ao trocar, desliza até o novo lado */
let lastSwapped = null;
function placeTeams() {
  const cards = [$("team-0"), $("team-1")];
  const animate = lastSwapped !== null && lastSwapped !== S.swapped && $("game").classList.contains("active") &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const before = cards.map((c) => [c.offsetLeft, c.offsetTop]);
  cards.forEach((c, t) => { c.style.gridArea = (t === 0) !== S.swapped ? "t1" : "t2"; });
  if (animate) {
    cards.forEach((c, t) => {
      const dx = before[t][0] - c.offsetLeft, dy = before[t][1] - c.offsetTop;
      if (!dx && !dy) return;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 2 }, { transform: "none", zIndex: 2 }],
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
    for (const id of ["pts", "games"]) {
      $(id).animate([{ opacity: 0, transform: "scale(.8)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "ease-out" });
    }
  }
  lastSwapped = S.swapped;
}

function render() {
  renderTiles();
  const tb = S.tb;
  $("lbl-pts").textContent = tb ? "Tie-Break" : (S.points[0] === 3 && S.points[1] === 3 ? "Ponto de ouro" : "Pontos");
  $("lbl-pts").classList.toggle("hot", tb || (S.points[0] === 3 && S.points[1] === 3));
  const p = tb ? S.tbPts : S.points.map((v) => PT[Math.min(v, 3)]);
  $("pts").innerHTML = sideScore(p);
  $("games").innerHTML = sideScore(S.games);
  placeTeams();
  $("gamenum").textContent = (tb ? "" : `Game ${gamesPlayed() + 1}`) + (S.target !== 6 ? ` · set de ${S.target} games` : "");
  $("btn-pause").textContent = T.runStart ? "⏸ PAUSAR" : "▶ RETOMAR";
  renderTimer();
}

/* Registro da partida (o que vai para o histórico e para o resumo final) */
function buildRecord() {
  return { id: savedId || undefined, date: T.startedAt, names: S.names, photos: P, winner: S.winner,
    games: S.games.slice(), target: S.target, log: S.log, tbResult: S.tbResult, totalPoints: S.totalPoints,
    duration: elapsedMs(), tournament: tref || undefined };
}
const joinRec = (rec, t) => `${rec.names[t][0]} e ${rec.names[t][1]}`;

function renderRecord(rec) {
  const w = rec.winner;
  const ph = $("f-photos");
  ph.textContent = "";
  for (let i = 0; i < 2; i++) ph.appendChild(makePhoto(rec.photos && rec.photos[w] && rec.photos[w][i], rec.names[w][i]));
  $("f-winner").textContent = joinRec(rec, w);
  $("f-score").innerHTML = xScore(rec.games[0], rec.games[1]);
  $("f-time").textContent = fmt(rec.duration);
  $("f-date").textContent = rec.date ? new Date(rec.date).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }) : "";
  $("f-tb").hidden = !rec.tbResult;
  if (rec.tbResult) {
    const r = rec.tbResult;
    $("f-tb-text").textContent = `${joinRec(rec, r.winner)} venceram: ${r.score[0]} x ${r.score[1]}`;
  }
  const log = $("f-log");
  log.textContent = "";
  rec.log.forEach((g) => {
    const row = document.createElement("div");
    row.className = "g-row w" + (g.winner + 1);
    const a = document.createElement("div"); a.className = "g"; a.textContent = `Game ${g.game}`;
    const b = document.createElement("div"); b.className = "who"; b.textContent = `Dupla ${g.winner + 1} venceu`;
    const c = document.createElement("div"); c.className = "sc num";
    c.innerHTML = g.winner === 0 ? `<em>GAME</em> x ${g.loserScore}` : `${g.loserScore} x <em>GAME</em>`;
    row.append(a, b, c);
    log.appendChild(row);
  });
}
function renderFinal() {
  $("fin-actions").hidden = false; $("view-actions").hidden = true;
  $("btn-new").textContent = tref ? "↩ Voltar ao torneio" : "🔄 Nova partida";
  renderRecord(buildRecord());
  updateSaveButton();
}

function afterChange(info, quiet) {
  save();
  if ((S.finished || !needSecond()) && $("dlg-pick").open) $("dlg-pick").close();
  if (S.finished) { if (!quiet && info) announce(info); renderFinal(); showScreen("final"); releaseWake(); hideAlert(); $("toast").classList.remove("show"); if (BTStore.getSettings().autoSave || tref) saveCurrentMatch(true); return; }
  showScreen("game");
  render();
  if (!quiet && navigator.vibrate) navigator.vibrate(18);
  if (!quiet && info) announce(info);
  if (needSecond()) { openPick(info && info.side); return; }
  if (info && info.tb) toast("TIE-BREAK! Diferença mínima de 2 pontos");
  if (info && info.side) sideNotice(info.side);
}

function showScreen(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id)); applyLayout(); }

let toastTimer;
function toast(msg, ms) {
  $("toast").textContent = msg; $("toast").classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), ms || 3200);
}
function showAlert(sub) {
  $("side-sub").textContent = sub || "";
  $("side-alert").classList.add("show");
  clearTimeout(alertTimer); alertTimer = setTimeout(hideAlert, 8000);
}
function hideAlert() { $("side-alert").classList.remove("show"); clearTimeout(alertTimer); }

/* ---------------- Escolha do sacador do Game 2 ---------------- */
function openPick(sideNote) {
  const t = other(S.first[0]);
  $("pick-note").textContent = `${sideNote ? "🔄 TROCA DE LADO — " : ""}Selecione o atleta da Dupla ${t + 1} que irá sacar.`;
  const row = $("pick-row");
  row.textContent = "";
  for (let i = 0; i < 2; i++) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pick-btn";
    b.append(makePhoto(P[t][i], S.names[t][i]), document.createTextNode(S.names[t][i]));
    b.addEventListener("click", () => { S.second = i; $("dlg-pick").close(); save(); render(); if (sideNote) sideNotice(sideNote); });
    row.appendChild(b);
  }
  if (!$("dlg-pick").open) $("dlg-pick").showModal();
}
$("dlg-pick").addEventListener("cancel", (e) => e.preventDefault());

/* ---------------- Girar tela ---------------- */
const KEY_ROT = "beachtennis:rotation";
let rotMode = safe(() => localStorage.getItem(KEY_ROT)) || "auto";   // auto | land | land-flip | port

function applyLayout() {
  const g = $("game");
  const physPortrait = window.innerHeight > window.innerWidth;
  const want = rotMode === "port" ? "portrait" : rotMode === "auto" ? (physPortrait ? "portrait" : "landscape") : "landscape";
  const rotated = (want === "portrait") !== physPortrait;
  const ccw = rotated && rotMode === "land-flip";
  const onGame = g.classList.contains("active");   // diálogos só giram junto com a tela do jogo
  g.classList.toggle("portrait", want === "portrait");
  g.classList.toggle("rotated", rotated);
  g.classList.toggle("ccw", ccw);
  document.documentElement.classList.toggle("rot", rotated && onGame);
  document.documentElement.classList.toggle("ccw", ccw && onGame);
}

async function setRotation(mode) {
  rotMode = mode;
  safe(() => localStorage.setItem(KEY_ROT, mode));
  const o = screen.orientation;
  try {
    if (mode === "auto") o && o.unlock && o.unlock();
    else if (o && o.lock) {
      if (!document.fullscreenElement && !matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches) await document.documentElement.requestFullscreen?.();
      await o.lock(mode === "port" ? "portrait" : mode === "land-flip" ? "landscape-secondary" : "landscape");
    }
  } catch (_) { /* sem suporte: o giro por CSS (applyLayout) cuida disso */ }
  applyLayout();
  setTimeout(applyLayout, 300);
}

/* ---------------- Wake lock / tela cheia ---------------- */
async function requestWake() {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } } catch (_) {}
}
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (_) {} wakeLock = null; }
function toggleFs() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }

/* ---------------- Cadastro: fotos e nomes ---------------- */
function resizeImage(file, size = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
      c.getContext("2d").drawImage(img, sx, sy, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

const photoEls = [[null, null], [null, null]];
let photoTarget = null;

function openPhotoDialog(t, i) {
  photoTarget = [t, i];
  const nm = ($(`n-${t}-${i}`).value || `Atleta ${t * 2 + i + 1}`).toUpperCase();
  $("ph-title").textContent = `Foto de ${nm}`;
  $("ph-del").hidden = !setupPhotos[t][i];
  $("dlg-photo").showModal();
}
async function onPhotoPicked(input) {
  const f = input.files[0];
  input.value = "";
  if (!f || !photoTarget) return;
  const [t, i] = photoTarget;
  try {
    setupPhotos[t][i] = await resizeImage(f);
    const ph = photoEls[t][i];
    paintPhoto(ph, setupPhotos[t][i], "");
    ph.classList.add("has");
  } catch (_) { toast("Não foi possível ler a imagem"); }
}
function removePhoto() {
  const [t, i] = photoTarget;
  setupPhotos[t][i] = null;
  const ph = photoEls[t][i];
  paintPhoto(ph, null, "");
  ph.textContent = "📷"; ph.classList.remove("has");
}

function buildSetup(cfg) {
  for (const t of [0, 1]) {
    const box = $("ath-" + t);
    box.textContent = "";
    for (let i = 0; i < 2; i++) {
      const card = document.createElement("div");
      card.className = "athlete-card";
      const ph = makePhoto(setupPhotos[t][i], cfg.names[t][i] || "?", setupPhotos[t][i] ? "has" : "");
      photoEls[t][i] = ph;
      ph.title = "Adicionar foto";
      ph.setAttribute("role", "button"); ph.tabIndex = 0;
      if (!setupPhotos[t][i]) ph.textContent = "📷";
      ph.addEventListener("click", () => openPhotoDialog(t, i));
      ph.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhotoDialog(t, i); } });
      const name = document.createElement("input");
      name.type = "text"; name.id = `n-${t}-${i}`; name.maxLength = 18; name.autocomplete = "off";
      name.placeholder = `Atleta ${t * 2 + i + 1}`; name.value = cfg.names[t][i] || "";
      name.setAttribute("list", "athlete-names");
      name.addEventListener("change", () => autofillPhoto(t, i));
      const lab = document.createElement("label");
      lab.className = "first-pick";
      const r = document.createElement("input");
      r.type = "radio"; r.name = "first"; r.value = `${t}-${i}`;
      r.checked = cfg.first[0] === t && cfg.first[1] === i;
      lab.append(r, document.createTextNode("🎾 Saca primeiro"));
      card.append(ph, name, lab);
      box.appendChild(card);
    }
  }
}
/* Se o nome já foi usado antes, reaproveita a foto guardada */
function autofillPhoto(t, i) {
  if (setupPhotos[t][i]) return;
  const key = $(`n-${t}-${i}`).value.trim().replace(/\s+/g, " ").toUpperCase();
  const a = BTStore.getAthletes()[key];
  if (!a || !a.photo) return;
  setupPhotos[t][i] = a.photo;
  paintPhoto(photoEls[t][i], a.photo, ""); photoEls[t][i].classList.add("has");
}

function readSetup() {
  const names = [0, 1].map((t) => [0, 1].map((i) => {
    const v = $(`n-${t}-${i}`).value.trim().replace(/\s+/g, " ");
    return (v || `Atleta ${t * 2 + i + 1}`).toUpperCase();
  }));
  const [ft, fi] = document.querySelector('input[name="first"]:checked').value.split("-").map(Number);
  return { names, first: [ft, fi], target: BTStore.getSettings().setSize };
}

/* ---------------- Fluxo ---------------- */
function boot() {
  lastSwapped = null;
  clearInterval(ticker);
  ticker = setInterval(() => { if (S && !S.finished) renderTimer(); }, 500);
  requestWake();
  hideAlert();
  if (S.finished) { renderFinal(); showScreen("final"); }
  else { showScreen("game"); render(); if (needSecond()) openPick(); }
}
function goSetup() {
  const back = tref;
  safe(() => localStorage.removeItem(KEY));
  M = null; S = null; T = null; savedId = null; tref = null;
  clearInterval(ticker); hideAlert(); releaseWake();
  $("resume-box").classList.remove("show");
  const cfg = safe(() => JSON.parse(localStorage.getItem(KEY_CFG) || "null"));
  buildSetup(cfg && cfg.names ? cfg : { names: [["", ""], ["", ""]], first: [0, 0] });
  refreshAthleteList();
  if (typeof syncIdle === "function") syncIdle();
  if (back) { openTourneyDetail(back.id); return; }
  showScreen("setup");
}
function confirmDialog(title, text, ok, fn) {
  $("c-title").textContent = title; $("c-text").textContent = text; $("c-ok").textContent = ok;
  $("c-ok").onclick = () => { $("dlg-confirm").close(); fn(); };
  $("c-cancel").onclick = () => $("dlg-confirm").close();
  $("dlg-confirm").showModal();
}

/* ---------------- Eventos ---------------- */
[0, 1].forEach((t) => $("pt-btn-" + t).addEventListener("click", () => {
  const now = Date.now();
  if (now - lastTap < 250) return;   // evita toque duplo acidental
  lastTap = now;
  addPoint(t);
}));
$("side-alert").addEventListener("click", hideAlert);
$("btn-pause").addEventListener("click", () => { T.runStart ? stopClock() : startClock(); save(); render(); });
$("btn-fs").addEventListener("click", toggleFs);
$("btn-rot").addEventListener("click", () => $("dlg-rot").showModal());
$("rot-close").addEventListener("click", () => $("dlg-rot").close());
document.querySelectorAll(".rot-opt").forEach((b) => b.addEventListener("click", () => { $("dlg-rot").close(); setRotation(b.dataset.mode); }));
window.addEventListener("resize", applyLayout);
window.addEventListener("orientationchange", () => setTimeout(applyLayout, 200));
$("ph-cam").addEventListener("click", () => { $("dlg-photo").close(); $("file-cam").click(); });
$("ph-gal").addEventListener("click", () => { $("dlg-photo").close(); $("file-gal").click(); });
$("ph-del").addEventListener("click", () => { $("dlg-photo").close(); removePhoto(); });
$("ph-cancel").addEventListener("click", () => $("dlg-photo").close());
$("file-cam").addEventListener("change", (e) => onPhotoPicked(e.target));
$("file-gal").addEventListener("change", (e) => onPhotoPicked(e.target));
$("btn-fix").addEventListener("click", () => $("dlg-fix").showModal());
$("fx-close").addEventListener("click", () => $("dlg-fix").close());
$("fx-point").addEventListener("click", () => { $("dlg-fix").close(); undoPoint(); });
$("fx-game").addEventListener("click", () => { $("dlg-fix").close(); undoGame(); });
$("fx-edit").addEventListener("click", () => { $("dlg-fix").close(); openEdit(); });
$("ed-ok").addEventListener("click", applyEdit);
$("ed-cancel").addEventListener("click", () => $("dlg-edit").close());
$("btn-reset").addEventListener("click", () => confirmDialog("Reiniciar partida?", "Todo o placar será perdido e você voltará à tela inicial.", "Reiniciar", goSetup));
$("btn-new").addEventListener("click", goSetup);
$("btn-back").addEventListener("click", () => { startClock(); undoPoint(); });
$("btn-start").addEventListener("click", () => {
  const cfg = readSetup();
  safe(() => localStorage.setItem(KEY_CFG, JSON.stringify(cfg)));
  startMatch(cfg, setupPhotos);
});
function resumeSaved() {
  const d = loadSaved(); if (!d) return false;
  M = { S: d.S, undo: d.undo || [], G: d.G || [] }; S = M.S; T = d.T; P = d.P; savedId = d.savedId || null; tref = d.tref || null;
  if (!T.startedAt) T.startedAt = new Date().toISOString();
  if (T.runStart) { T.base += Math.max(0, (d.savedAt || Date.now()) - T.runStart); T.runStart = Date.now(); }  // não conta o app fechado
  boot();
  return true;
}
$("btn-resume").addEventListener("click", resumeSaved);

document.addEventListener("keydown", (e) => {
  if (!S || S.finished || !$("game").classList.contains("active") || document.querySelector("dialog[open]")) return;
  const k = e.key.toLowerCase();
  if (k === "1" || k === "arrowleft") addPoint(0);
  else if (k === "2" || k === "arrowright") addPoint(1);
  else if (k === "u" || k === "z" || k === "backspace") undoPoint();
  else if (k === " ") { e.preventDefault(); $("btn-pause").click(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S && !S.finished) { requestWake(); renderTimer(); }
  else if (S) save();
});
window.addEventListener("pagehide", () => { if (S) save(); });

/* ---------------- Inicialização ---------------- */
(function init() {
  applyLayout();
  const cfg = safe(() => JSON.parse(localStorage.getItem(KEY_CFG) || "null"));
  buildSetup(cfg && cfg.names ? cfg : { names: [["", ""], ["", ""]], first: [0, 0] });
  const d = loadSaved();
  if (d && !d.S.finished) {
    const s = d.S;
    $("resume-desc").textContent = `${s.names[0].join("/")} ${s.games[0]} x ${s.games[1]} ${s.names[1].join("/")}`;
    $("resume-box").classList.add("show");
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
