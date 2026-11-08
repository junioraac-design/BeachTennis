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
/* Aceita o endereço colado de qualquer jeito (sem https, com / no fim ou com caminho) e fica só com o domínio */
function normDb(v) {
  v = (v || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { return new URL(v).origin; } catch (_) { return ""; }
}
function tvConfig() {
  const c = BTStore.getSettings();
  return { on: c.tvOn, db: normDb(c.tvDb), code: c.tvCode };
}

/* O Firebase descarta null e listas vazias e transforma listas com buracos em objetos.
   Estas funções refazem o estado completo antes de desenhar a TV. */
const asArr = (x, n, def) => Array.from({ length: n }, (_, i) => (x && x[i] !== undefined && x[i] !== null ? x[i] : def));
function normState(s) {
  const log = !s.log ? [] : Array.isArray(s.log) ? s.log : Object.keys(s.log).sort((a, b) => a - b).map((k) => s.log[k]);
  return Object.assign({}, s, {
    names: [0, 1].map((t) => asArr(s.names && s.names[t], 2, "?")),
    first: asArr(s.first, 2, 0),
    second: s.second === undefined ? null : s.second,
    target: s.target || 6,
    games: asArr(s.games, 2, 0), points: asArr(s.points, 2, 0), tbPts: asArr(s.tbPts, 2, 0), totalPoints: asArr(s.totalPoints, 2, 0),
    tb: !!s.tb, swapped: !!s.swapped, finished: !!s.finished,
    winner: s.winner === undefined ? -1 : s.winner,
    tbResult: s.tbResult ? { winner: s.tbResult.winner, score: asArr(s.tbResult.score, 2, 0) } : null,
    log
  });
}
const normPhotos = (p) => [0, 1].map((t) => [0, 1].map((i) => (p && p[t] && p[t][i]) || null));

/* Estado da transmissão, mostrado nas Configurações */
let tvStatus = "";
function setTvStatus(msg) { tvStatus = msg; const el = $("tv-status-host"); if (el) el.textContent = msg; }
const hhmmss = () => new Date().toLocaleTimeString("pt-BR");
function explain(status) {
  if (status === 401 || status === 403) return `Permissão negada (HTTP ${status}). Confira as Regras do Firebase (README).`;
  if (status === 404) return "Banco não encontrado (HTTP 404). Confira o endereço.";
  return `Resposta inesperada (HTTP ${status}).`;
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
  if (!db || !code) { setTvStatus("Sem endereço do Firebase: transmitindo só para a mesma tela/aparelho."); return; }
  try {
    const url = `${db}/rooms/${code}`;
    if (photos && tvPhotoKey !== payload.key) {
      const r = await fetch(`${url}/photos.json?print=silent`, { method: "PUT", body: JSON.stringify(photos) });
      if (r.ok) tvPhotoKey = payload.key; else return setTvStatus("❌ " + explain(r.status));
    }
    const r = await fetch(`${url}/state.json?print=silent`, { method: "PUT", body: JSON.stringify(payload) });
    setTvStatus(r.ok ? `✔ Transmitindo (último envio ${hhmmss()})` : "❌ " + explain(r.status));
  } catch (_) { setTvStatus("❌ Sem conexão com o banco. Confira o endereço e a internet; tento de novo no próximo ponto."); }
}

/* Botão "Testar conexão": escreve e lê um valor de teste no banco */
async function tvTest() {
  const { db, code } = tvConfig();
  if (!db) return setTvStatus("❌ Informe o endereço do Firebase primeiro.");
  setTvStatus("Testando…");
  try {
    const url = `${db}/rooms/${tvEnsureCode()}/teste.json`;
    const stamp = Date.now();
    const w = await fetch(url, { method: "PUT", body: JSON.stringify({ stamp }) });
    if (!w.ok) return setTvStatus("❌ Não consegui gravar: " + explain(w.status));
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return setTvStatus("❌ Não consegui ler: " + explain(r.status));
    const d = await r.json();
    setTvStatus(d && d.stamp === stamp ? "✔ Conexão OK! Já pode abrir o link na TV." : "❌ O banco respondeu algo inesperado.");
  } catch (_) { setTvStatus("❌ Não consegui falar com o endereço. Confira se ele está certo (começa com https://) e se há internet."); }
}

/* ---------- Visualizador (TV) ---------- */
let tvLastTs = 0, tvSide = null;

function tvApply(state, photos) {
  if (!state || state.idle) { tvLastTs = state ? state.ts : 0; S = null; showScreen("tvwait"); return; }
  if (state.ts === tvLastTs) return;
  tvLastTs = state.ts;
  const prevSwapped = S && S.swapped, prevGames = S ? S.games[0] + S.games[1] : 0;
  S = normState(state.S); viewFlip = state.flip || 0;
  if (photos && photos.key === state.key) P = normPhotos(photos.P);
  else if (!Array.isArray(P) || !P[0]) P = normPhotos(null);
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
  const status = (t) => { const el = $("tv-status"); if (el) el.textContent = t; };
  status("Conectando ao banco…");
  const poll = async () => {
    try {
      const r = await fetch(`${url}/state.json`, { cache: "no-store" });
      if (!r.ok) return status("❌ " + explain(r.status));
      const state = await r.json();
      if (!state) return status("✔ Conectado. Aguardando o celular iniciar a partida…");
      if (!state.idle && state.key !== photoKey) {
        const pr = await fetch(`${url}/photos.json`, { cache: "no-store" });
        const ph = pr.ok ? await pr.json() : null;
        if (ph && ph.key === state.key) { photos = ph; photoKey = state.key; }
      }
      status("✔ Conectado");
      tvApply(state, photos);
    } catch (e) {
      status("❌ Sem conexão com o banco (" + (e && e.message ? e.message : "erro") + "). Confira o link e a internet.");
    }
  };
  poll(); setInterval(poll, TV_POLL_MS);
}

/* ---------- Configurações da TV ---------- */
function refreshTvSettings() {
  const c = BTStore.getSettings();
  $("s-tvon").checked = c.tvOn;
  $("s-tvdb").value = c.tvDb || "";
  $("tv-box").hidden = !c.tvOn;
  $("tv-status-host").textContent = tvStatus;
  if (c.tvOn) tvEnsureCode();
}
$("s-tvon").addEventListener("change", (e) => { BTStore.setSettings({ tvOn: e.target.checked }); refreshTvSettings(); if (e.target.checked) syncPush(); });
$("s-tvdb").addEventListener("change", (e) => {
  const raw = e.target.value.trim(), fixed = normDb(raw);
  if (raw && !fixed) { setTvStatus("❌ Endereço inválido. Ele deve ser parecido com https://seu-projeto-default-rtdb.firebaseio.com"); return; }
  e.target.value = fixed;                      // mostra o endereço já corrigido
  BTStore.setSettings({ tvDb: fixed }); tvPhotoKey = null; syncPush();
  if (fixed) tvTest();
});
$("tv-test").addEventListener("click", tvTest);
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
