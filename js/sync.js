/* =====================================================================
 * TV ao vivo
 *
 *  Anfitrião (celular que marca os pontos): envia o estado da partida
 *    - para outras abas/janelas do mesmo aparelho (BroadcastChannel; não precisa configurar)
 *    - para um banco Firebase Realtime Database via REST, se o endereço estiver configurado
 *  Visualizador (TV): abre   index.html?tv=CODIGO&db=ENDERECO   e só exibe o placar.
 * ===================================================================== */
const TV_POLL_MS = 1000;
const AUTH_BASE = window.BT_AUTH_BASE || "https://identitytoolkit.googleapis.com";
const TOKEN_BASE = window.BT_TOKEN_BASE || "https://securetoken.googleapis.com";
const KEY_TVAUTH = "beachtennis:tvauth";
const tvChannel = ("BroadcastChannel" in self) ? new BroadcastChannel("beachtennis-tv") : null;
let tvPushTimer = null, tvPhotoKey = null, tvBrandVer = null;

/* ---------- Anfitrião ---------- */
/* Aceita o endereço colado de qualquer jeito (sem https, com / no fim ou com caminho) e fica só com o domínio */
function normDb(v) {
  v = (v || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try { return new URL(v).origin; } catch (_) { return ""; }
}
const defaultDb = () => normDb(window.BT_DEFAULT_DB || "");
/* Forma curta do endereço no link: https://meu-proj-default-rtdb.firebaseio.com  →  p:meu-proj */
function compactDb(db) {
  const m = db.match(/^https:\/\/([a-z0-9-]+)-default-rtdb\.firebaseio\.com$/i);
  return m ? "p:" + m[1] : db;
}
function expandDb(v) {
  v = (v || "").trim();
  if (/^p:[a-z0-9-]+$/i.test(v)) return `https://${v.slice(2)}-default-rtdb.firebaseio.com`;
  return normDb(v);
}
const normCode = (v) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
function tvConfig() {
  const c = BTStore.getSettings();
  return { on: c.tvOn, db: normDb(c.tvDb) || defaultDb(), code: c.tvCode, apiKey: (c.tvApiKey || "").trim() };
}

/* Modo seguro: login anônimo do Firebase. O aparelho vira "dono" da sala (campo owner = uid);
   as regras só deixam o dono escrever, e qualquer pessoa com o link só lê. */
class TvError extends Error { constructor(msg) { super(msg); this.tv = true; } }
const readAuth = () => { try { return JSON.parse(localStorage.getItem(KEY_TVAUTH)) || null; } catch (_) { return null; } };
const writeAuth = (a) => { try { localStorage.setItem(KEY_TVAUTH, JSON.stringify(a)); } catch (_) {} };

async function authCall(url, init) {
  let r;
  try { r = await fetch(url, init); } catch (_) { throw new TvError("Sem conexão para fazer o login do Firebase."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (d.error && d.error.message) || "";
    if (/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(m)) throw new TvError("Ative o login Anônimo: Firebase → Authentication → Método de login → Anônimo.");
    if (/API.?KEY|API key/i.test(m)) throw new TvError("Chave de API inválida. Copie de novo em Configurações do projeto → Geral → Chave de API da Web.");
    throw new TvError("Falha no login do Firebase" + (m ? ` (${m})` : "") + ".");
  }
  return d;
}
/* Devolve { token, uid } (modo seguro) ou null (modo aberto, sem chave) */
async function tvAuth() {
  const { apiKey } = tvConfig();
  if (!apiKey) return null;
  let a = readAuth();
  if (a && a.apiKey === apiKey && a.exp > Date.now() + 60000) return { token: a.idToken, uid: a.uid };
  let d;
  if (a && a.apiKey === apiKey && a.refreshToken) {
    try {
      d = await authCall(`${TOKEN_BASE}/v1/token?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refreshToken)}` });
      a = { apiKey, uid: d.user_id, idToken: d.id_token, refreshToken: d.refresh_token, exp: Date.now() + (+d.expires_in || 3600) * 1000 };
    } catch (_) { d = null; }
  }
  if (!d) {
    d = await authCall(`${AUTH_BASE}/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    a = { apiKey, uid: d.localId, idToken: d.idToken, refreshToken: d.refreshToken, exp: Date.now() + (+d.expiresIn || 3600) * 1000 };
  }
  writeAuth(a);
  return { token: a.idToken, uid: a.uid };
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
  if (status === 401 || status === 403) return tvConfig().apiKey
    ? `Permissão negada (HTTP ${status}). Publique as regras seguras (botão "Copiar regras seguras"). Se esta sala foi criada por outro aparelho, use "Gerar novo link".`
    : `Permissão negada (HTTP ${status}). Confira as Regras do Firebase (README).`;
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
  if (!db || local) return `${base}?tv=local`;
  // com o banco definido no config.js o link leva só o código; senão leva o endereço, em forma curta
  const dbp = db === defaultDb() ? "" : "&db=" + encodeURIComponent(compactDb(db)).replace(/%3A/gi, ":");
  return `${base}?tv=${code}${dbp}`;
}
function showTvLink() {
  const el = $("tv-link");
  if (!el) return;
  const link = tvLink(!tvConfig().db);
  el.textContent = `Link da TV (${link.replace(/^https?:\/\//, "").length} caracteres): ${link.replace(/^https?:\/\//, "")}`;
}

function tvPayload() {
  const base = { brandVer: BTStore.getBrand().ver || 0 };
  if (!M || !S) return Object.assign(base, { idle: true, ts: Date.now() });
  return Object.assign(base, { ts: Date.now(), key: T.startedAt, S, flip: viewFlip, elapsed: elapsedMs(), running: !!T.runStart, startedAt: T.startedAt });
}
function syncPush() {
  if (!tvConfig().on) return;
  clearTimeout(tvPushTimer);
  tvPushTimer = setTimeout(tvSend, 200);          // agrupa vários salvamentos seguidos
}
function syncIdle() { if (tvConfig().on) { tvPhotoKey = null; tvSend(); } }

/* Endereço de uma operação na sala (com o token, no modo seguro) */
const roomUrl = (db, code, auth, extra) => `${db}/rooms/${code}.json?${extra ? extra + "&" : ""}${auth ? "auth=" + encodeURIComponent(auth.token) : ""}`;

async function tvSend() {
  const { db, code } = tvConfig();
  const payload = tvPayload();
  const photos = payload.idle ? null : { key: payload.key, P };
  const brand = BTStore.getBrand();
  if (tvChannel) tvChannel.postMessage({ state: payload, photos, brand });
  if (!db || !code) { setTvStatus("Sem endereço do Firebase: transmitindo só para a mesma tela/aparelho."); return; }
  try {
    const auth = await tvAuth();
    // um único PATCH atualiza o placar e, só quando mudaram, as fotos e a arena/patrocinador
    const body = { state: payload };
    if (auth) body.owner = auth.uid;
    if (photos && tvPhotoKey !== payload.key) body.photos = photos;
    if (tvBrandVer !== brand.ver) body.brand = brand;
    const r = await fetch(roomUrl(db, code, auth, "print=silent"), { method: "PATCH", body: JSON.stringify(body) });
    if (r.ok) {
      if (body.photos) tvPhotoKey = payload.key;
      if (body.brand) tvBrandVer = brand.ver;
      setTvStatus(`✔ Transmitindo${auth ? " (modo seguro)" : ""} (último envio ${hhmmss()})`);
    } else setTvStatus("❌ " + explain(r.status));
  } catch (e) {
    setTvStatus(e && e.tv ? "❌ " + e.message : "❌ Sem conexão com o banco. Confira o endereço e a internet; tento de novo no próximo ponto.");
  }
}

/* Botão "Testar conexão": escreve e lê um valor de teste na sala */
async function tvTest() {
  const { db } = tvConfig();
  if (!db) return setTvStatus("❌ Informe o endereço do Firebase primeiro.");
  setTvStatus("Testando…");
  try {
    const code = tvEnsureCode(), auth = await tvAuth(), stamp = Date.now();
    const body = { teste: { stamp } };
    if (auth) body.owner = auth.uid;
    const w = await fetch(roomUrl(db, code, auth), { method: "PATCH", body: JSON.stringify(body) });
    if (!w.ok) return setTvStatus("❌ Não consegui gravar: " + explain(w.status));
    const r = await fetch(`${db}/rooms/${code}/teste.json`, { cache: "no-store" });
    if (!r.ok) return setTvStatus("❌ Não consegui ler: " + explain(r.status));
    const d = await r.json();
    setTvStatus(d && d.stamp === stamp ? `✔ Conexão OK${auth ? " (modo seguro)" : ""}! Já pode abrir o link na TV.` : "❌ O banco respondeu algo inesperado.");
  } catch (e) {
    setTvStatus(e && e.tv ? "❌ " + e.message : "❌ Não consegui falar com o endereço. Confira se ele está certo (começa com https://) e se há internet.");
  }
}

/* "Gerar novo link": apaga a sala antiga (quem tinha o link deixa de ver) e cria outra */
async function tvNewLink() {
  const { db, code } = tvConfig();
  if (db && code) {
    try { const auth = await tvAuth(); await fetch(roomUrl(db, code, auth, "print=silent"), { method: "DELETE" }); } catch (_) { /* melhor esforço */ }
  }
  BTStore.setSettings({ tvCode: Math.random().toString(36).slice(2, 8).toUpperCase() });
  tvPhotoKey = null; tvBrandVer = null;
  syncPush();
  const link = tvLink(false);
  try { await navigator.clipboard.writeText(link); toast("Novo link gerado e copiado. O link antigo parou de funcionar."); }
  catch (_) { prompt("Novo link da TV (o antigo parou de funcionar):", link); }
}

/* Regras para publicar no Firebase (Realtime Database → Regras) */
const SECURE_RULES = {
  rules: { rooms: { $code: {
    ".read": true,
    ".write": "auth != null && (!data.exists() || data.child('owner').val() === auth.uid)",
    ".validate": "newData.hasChild('owner') && newData.child('owner').val() === auth.uid"
  } } }
};

/* ---------- Visualizador (TV) ---------- */
let tvLastTs = 0, tvSide = null;

function tvApply(state, photos, brand) {
  if (brand) applyBrand(brand);
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

const KEY_TVCODE = "beachtennis:tvcode";
function startViewer(code, db) {
  document.body.classList.add("tv");
  document.title = "Beach Tennis · TV";
  showScreen("tvwait");
  // sem código no link: usa o último código desta TV; se não houver, pede para digitar
  if (!code) { try { code = localStorage.getItem(KEY_TVCODE) || ""; } catch (_) {} }
  if (!code) {
    $("tv-code").textContent = "—";
    $("tv-status").textContent = db ? "" : "Falta o endereço do banco no link (veja o README).";
    if (db) {
      $("tv-form").hidden = false;
      $("tv-form").onsubmit = (e) => {
        e.preventDefault();
        const c = normCode($("tv-code-in").value);
        if (c.length < 4) { $("tv-status").textContent = "O código tem de 4 a 12 letras ou números."; return; }
        try { localStorage.setItem(KEY_TVCODE, c); } catch (_) {}
        location.replace(`${location.pathname}?tv=${c}` + (new URLSearchParams(location.search).get("db") ? `&db=${new URLSearchParams(location.search).get("db")}` : ""));
      };
      $("tv-code-in").focus();
    }
    return;
  }
  code = code === "local" ? code : normCode(code);
  if (code !== "local") { try { localStorage.setItem(KEY_TVCODE, code); } catch (_) {} }
  $("tv-code").textContent = code === "local" ? "mesma tela" : code;
  requestWake();
  setInterval(() => { if (S && !S.finished) renderTimer(); }, 500);
  // mesma tela/aparelho: chega pelo BroadcastChannel
  if (tvChannel) tvChannel.onmessage = (e) => tvApply(e.data.state, e.data.photos, e.data.brand);
  if (code === "local") return;
  if (!db) { $("tv-status").textContent = "❌ Falta o endereço do banco no link. Gere o link de novo no celular (Copiar link)."; return; }
  const url = `${db}/rooms/${code}`;
  let photoKey = null, photos = null, brandVer = null;
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
      // arena/patrocinador: só baixa as imagens quando mudaram
      const bv = state.brandVer || 0;
      let brand = null;
      if (bv !== brandVer) {
        if (!bv) brand = { name: "", logo: null, sponsor: null, sponsorText: "", ver: 0 };
        else { const br = await fetch(`${url}/brand.json`, { cache: "no-store" }); const b = br.ok ? await br.json() : null; if (b) brand = Object.assign({ name: "", logo: null, sponsor: null, sponsorText: "" }, b); }
        if (brand) brandVer = bv;
      }
      status("✔ Conectado");
      tvApply(state, photos, brand);
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
  $("s-tvdb").value = c.tvDb || (defaultDb() ? "" : "");
  $("s-tvdb").placeholder = defaultDb() ? `(usando o banco do config.js)` : "https://seu-projeto-default-rtdb.firebaseio.com";
  $("s-tvcode").value = c.tvCode || "";
  $("s-tvkey").value = c.tvApiKey || "";
  $("tv-box").hidden = !c.tvOn;
  $("tv-status-host").textContent = tvStatus;
  if (c.tvOn) { tvEnsureCode(); $("s-tvcode").value = BTStore.getSettings().tvCode; }
  showTvLink();
}
$("s-tvon").addEventListener("change", (e) => { BTStore.setSettings({ tvOn: e.target.checked }); refreshTvSettings(); if (e.target.checked) syncPush(); });
$("s-tvdb").addEventListener("change", (e) => {
  const raw = e.target.value.trim(), fixed = normDb(raw);
  if (raw && !fixed) { setTvStatus("❌ Endereço inválido. Ele deve ser parecido com https://seu-projeto-default-rtdb.firebaseio.com"); return; }
  e.target.value = fixed;                      // mostra o endereço já corrigido
  BTStore.setSettings({ tvDb: fixed }); tvPhotoKey = null; syncPush(); showTvLink();
  if (fixed) tvTest();
});
$("s-tvcode").addEventListener("change", (e) => {
  const c = normCode(e.target.value);
  if (c.length < 4) { toast("O código precisa de 4 a 12 letras ou números."); e.target.value = BTStore.getSettings().tvCode; return; }
  e.target.value = c;
  BTStore.setSettings({ tvCode: c });
  tvPhotoKey = null; tvBrandVer = null;
  syncPush(); showTvLink();
});
$("s-tvkey").addEventListener("change", (e) => {
  BTStore.setSettings({ tvApiKey: e.target.value.trim() });
  tvPhotoKey = null; tvBrandVer = null;
  if (tvConfig().db) tvTest();
});
$("tv-test").addEventListener("click", tvTest);
$("tv-new").addEventListener("click", () => confirmDialog("Gerar novo link?", "O link atual deixa de funcionar para quem o recebeu. Você precisará enviar o novo link.", "Gerar novo link", tvNewLink));
$("tv-rules").addEventListener("click", async () => {
  const txt = JSON.stringify(SECURE_RULES, null, 2);
  try { await navigator.clipboard.writeText(txt); toast("Regras copiadas! Cole em Firebase → Realtime Database → Regras e publique."); }
  catch (_) { prompt("Copie estas regras:", txt); }
});
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
  if (q.has("tv")) startViewer(q.get("tv"), expandDb(q.get("db")) || defaultDb());
})();
