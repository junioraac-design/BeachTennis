/* =====================================================================
 * TV ao vivo
 *
 *  Anfitrião (celular que marca os pontos): envia o estado da partida
 *    - para outras abas/janelas do mesmo aparelho (BroadcastChannel; não precisa configurar)
 *    - para um banco Firebase Realtime Database via REST, se o endereço estiver configurado
 *  Visualizador (TV): abre   index.html?tv=CODIGO&db=ENDERECO   e só exibe o placar.
 * ===================================================================== */
const TV_POLL_MS = 1000;
const tvChannel = ("BroadcastChannel" in self) ? new BroadcastChannel("beachtennis-tv") : null;
let tvPushTimer = null, tvPhotoKey = null;

/* ---------- Anfitrião ---------- */
function tvConfig() {
  const c = BTStore.getSettings();
  return { on: c.tvOn, db: (c.tvDb || "").trim().replace(/\/+$/, ""), code: c.tvCode };
}
function tvEnsureCode() {
  let { code } = tvConfig();
  if (!code) { code = Math.random().toString(36).slice(2, 8).toUpperCase(); BTStore.setSettings({ tvCode: code }); }
  return code;
}
function tvLink(local) {
  const { db } = tvConfig(), code = tvEnsureCode();
  const base = location.origin + location.pathname;
  return db && !local ? `${base}?tv=${code}&db=${encodeURIComponent(db)}` : `${base}?tv=local`;
}

function tvPayload() {
  if (!M || !S) return { idle: true, ts: Date.now() };
  return { ts: Date.now(), key: T.startedAt, S, flip: viewFlip, elapsed: elapsedMs(), running: !!T.runStart, startedAt: T.startedAt };
}
function syncPush() {
  if (!tvConfig().on) return;
  clearTimeout(tvPushTimer);
  tvPushTimer = setTimeout(tvSend, 200);          // agrupa vários salvamentos seguidos
}
function syncIdle() { if (tvConfig().on) { tvPhotoKey = null; tvSend(); } }

async function tvSend() {
  const { db, code } = tvConfig();
  const payload = tvPayload();
  const photos = payload.idle ? null : { key: payload.key, P };
  if (tvChannel) tvChannel.postMessage({ state: payload, photos });
  if (!db || !code) return;
  try {
    const url = `${db}/rooms/${code}`;
    if (photos && tvPhotoKey !== payload.key) {
      const r = await fetch(`${url}/photos.json?print=silent`, { method: "PUT", body: JSON.stringify(photos) });
      if (r.ok) tvPhotoKey = payload.key;
    }
    await fetch(`${url}/state.json?print=silent`, { method: "PUT", body: JSON.stringify(payload) });
  } catch (_) { /* sem internet: tenta de novo no próximo ponto */ }
}

/* ---------- Visualizador (TV) ---------- */
let tvLastTs = 0, tvSide = null;

function tvApply(state, photos) {
  if (!state || state.idle) { tvLastTs = state ? state.ts : 0; S = null; showScreen("tvwait"); return; }
  if (state.ts === tvLastTs) return;
  tvLastTs = state.ts;
  const prevSwapped = S && S.swapped, prevGames = S ? S.games[0] + S.games[1] : 0;
  S = state.S; viewFlip = state.flip || 0;
  if (!S.target) S.target = 6;
  if (photos && photos.key === state.key) P = photos.P;
  T = { base: state.elapsed, runStart: state.running ? Date.now() : null, startedAt: state.startedAt };
  savedId = null; tref = null;
  if (S.finished) {
    renderFinal(); $("fin-actions").hidden = true; $("view-actions").hidden = true;
    showScreen("final"); hideAlert(); return;
  }
  showScreen("game");
  render();
  if (prevSwapped !== null && prevSwapped !== undefined && prevSwapped !== S.swapped) {
    const n = S.games[0] + S.games[1];
    showAlert(S.tb ? "Tie-Break" : `Final do Game ${n || prevGames}`);
  }
}

function startViewer(code, db) {
  document.body.classList.add("tv");
  document.title = "Beach Tennis · TV";
  $("tv-code").textContent = code === "local" ? "mesma tela" : code;
  showScreen("tvwait");
  requestWake();
  setInterval(() => { if (S && !S.finished) renderTimer(); }, 500);
  // mesma tela/aparelho: chega pelo BroadcastChannel
  if (tvChannel) tvChannel.onmessage = (e) => tvApply(e.data.state, e.data.photos);
  if (code === "local" || !db) return;
  const url = `${db}/rooms/${code}`;
  let photoKey = null, photos = null;
  const poll = async () => {
    try {
      const r = await fetch(`${url}/state.json`, { cache: "no-store" });
      const state = r.ok ? await r.json() : null;
      if (state && !state.idle && state.key !== photoKey) {
        const pr = await fetch(`${url}/photos.json`, { cache: "no-store" });
        const ph = pr.ok ? await pr.json() : null;
        if (ph && ph.key === state.key) { photos = ph; photoKey = state.key; }
      }
      if (state) tvApply(state, photos);
    } catch (_) { /* offline: mantém o último placar */ }
  };
  poll(); setInterval(poll, TV_POLL_MS);
}

/* ---------- Configurações da TV ---------- */
function refreshTvSettings() {
  const c = BTStore.getSettings();
  $("s-tvon").checked = c.tvOn;
  $("s-tvdb").value = c.tvDb || "";
  $("tv-box").hidden = !c.tvOn;
  if (c.tvOn) tvEnsureCode();
}
$("s-tvon").addEventListener("change", (e) => { BTStore.setSettings({ tvOn: e.target.checked }); refreshTvSettings(); if (e.target.checked) syncPush(); });
$("s-tvdb").addEventListener("change", (e) => { BTStore.setSettings({ tvDb: e.target.value.trim() }); tvPhotoKey = null; syncPush(); });
$("tv-open").addEventListener("click", () => { window.open(tvLink(!tvConfig().db), "_blank"); });
$("tv-copy").addEventListener("click", async () => {
  const link = tvLink(false);
  try { await navigator.clipboard.writeText(link); toast("Link da TV copiado!"); }
  catch (_) { prompt("Copie o link da TV:", link); }
});
$("btn-settings").addEventListener("click", refreshTvSettings);
$("btn-set").addEventListener("click", refreshTvSettings);

(function initTv() {
  const q = new URLSearchParams(location.search);
  if (q.has("tv")) startViewer(q.get("tv") || "local", q.get("db") || "");
})();
