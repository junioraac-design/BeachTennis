/* Salvar partida, histórico, ranking, estatísticas e backup. */

/* ---------- Salvar ---------- */
function makeThumb(dataUrl, size = 128) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, 0, 0, size, size);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function saveCurrentMatch(silent) {
  if (!S || !S.finished) return;
  const rec = buildRecord();
  rec.photos = await Promise.all(rec.photos.map((pair) => Promise.all(pair.map((u) => makeThumb(u)))));
  const id = BTStore.saveMatch(rec);
  if (!id) { if (!silent) toast("Sem espaço para salvar. Exporte um backup e apague partidas antigas."); updateSaveButton(); return; }
  savedId = id;
  S.names.forEach((pair, t) => pair.forEach((n, i) => BTStore.rememberAthlete(n, P[t][i])));
  save();
  if (typeof onMatchSaved === "function") onMatchSaved(rec);
  updateSaveButton();
  if (!silent) toast("Partida salva!");
}
function updateSaveButton() {
  const b = $("btn-save");
  if (!b) return;
  b.textContent = savedId ? "✔ Partida salva" : "💾 Salvar partida";
  b.disabled = !!savedId;
  b.style.opacity = savedId ? ".7" : "";
}
function discardSaved() {
  if (savedId) BTStore.deleteMatch(savedId);
  savedId = null;
  if (typeof onMatchDiscarded === "function") onMatchDiscarded();
}

/* ---------- Sugestão de nomes no cadastro ---------- */
function refreshAthleteList() {
  const dl = $("athlete-names");
  dl.textContent = "";
  Object.keys(BTStore.getAthletes()).sort().forEach((n) => { const o = document.createElement("option"); o.value = n; dl.appendChild(o); });
}

/* ---------- Tela de histórico ---------- */
let viewing = null;       // registro aberto a partir do histórico
const fmtDate = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function openHistory() { refreshHistory(); showScreen("history"); }
function currentTab() { return document.querySelector('input[name="htab"]:checked').value; }

function refreshHistory() {
  const tab = currentTab();
  $("hist-filter-row").hidden = tab === "matches";
  const body = $("hist-body");
  body.textContent = "";
  const hist = BTStore.getHistory();
  const empty = (msg) => { const d = document.createElement("div"); d.className = "empty"; d.textContent = msg; body.appendChild(d); };

  if (tab === "matches") {
    if (!hist.length) return empty("Nenhuma partida salva ainda. Ao terminar um jogo, ele aparece aqui.");
    hist.forEach((m) => body.appendChild(matchCard(m)));
    return;
  }
  const filter = $("hist-filter").value;
  const list = tab === "ranking" ? BTStats.athletes(hist, filter) : BTStats.pairs(hist, filter);
  if (!list.length) return empty("Sem partidas para calcular o ranking.");
  const reg = BTStore.getAthletes();
  list.forEach((r, idx) => {
    const row = document.createElement("div");
    row.className = "rank-row" + (idx === 0 ? " top1" : "");
    const pos = document.createElement("div"); pos.className = "pos"; pos.textContent = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1;
    const ph = makePhoto(tab === "ranking" && reg[r.name] ? reg[r.name].photo : null, r.name);
    if (tab === "pairs") { ph.textContent = "👥"; }
    const mid = document.createElement("div");
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = r.name;
    const sub = document.createElement("div"); sub.className = "sub";
    const saldo = r.gf - r.ga;
    sub.textContent = `${r.matches} jogo${r.matches === 1 ? "" : "s"} · ${r.wins}V ${r.losses}D · games ${r.gf}-${r.ga} (${saldo > 0 ? "+" : ""}${saldo})`;
    mid.append(nm, sub);
    const big = document.createElement("div"); big.className = "big num";
    big.innerHTML = `${r.pct}%<small>aproveit.</small>`;
    row.append(pos, ph, mid, big);
    body.appendChild(row);
  });
}

function matchCard(m) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "m-card";
  const top = document.createElement("div"); top.className = "top";
  const d = document.createElement("span"); d.textContent = fmtDate(m.date) + " · " + fmt(m.duration);
  top.appendChild(d);
  const tags = document.createElement("span");
  if (m.tbResult) { const t = document.createElement("span"); t.className = "badge"; t.textContent = "tie-break"; tags.appendChild(t); }
  if (m.tournament) { const t = document.createElement("span"); t.className = "badge"; t.style.marginLeft = "4px"; t.textContent = "torneio"; tags.appendChild(t); }
  top.appendChild(tags);
  const teams = document.createElement("div"); teams.className = "teams";
  const l = document.createElement("div"); l.textContent = joinRec(m, 0); if (m.winner === 0) l.className = "w";
  const sc = document.createElement("div"); sc.className = "sc num"; sc.innerHTML = xScore(m.games[0], m.games[1]);
  const r = document.createElement("div"); r.textContent = joinRec(m, 1); r.className = "r" + (m.winner === 1 ? " w" : "");
  teams.append(l, sc, r);
  b.append(top, teams);
  b.addEventListener("click", () => viewRecord(m));
  return b;
}

function viewRecord(rec) {
  viewing = rec;
  $("fin-actions").hidden = true; $("view-actions").hidden = false;
  renderRecord(rec);
  showScreen("final");
}
function closeView() { viewing = null; openHistory(); }

/* ---------- Eventos ---------- */
$("btn-history").addEventListener("click", openHistory);
$("hist-back").addEventListener("click", () => { refreshAthleteList(); showScreen("setup"); });
document.querySelectorAll('input[name="htab"]').forEach((r) => r.addEventListener("change", refreshHistory));
$("hist-filter").addEventListener("change", refreshHistory);

$("btn-save").addEventListener("click", () => saveCurrentMatch(false));
$("btn-share").addEventListener("click", () => { if (S && S.finished) shareRecord(buildRecord()); });
$("btn-share2").addEventListener("click", () => viewing && shareRecord(viewing));
$("btn-view-back").addEventListener("click", closeView);
$("btn-del").addEventListener("click", () => {
  if (!viewing) return;
  confirmDialog("Excluir partida?", "Ela será removida do histórico e do ranking.", "Excluir", () => {
    BTStore.deleteMatch(viewing.id); viewing = null; toast("Partida excluída"); openHistory();
  });
});

$("hist-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(BTStore.exportAll())], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `beachtennis-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$("hist-import").addEventListener("click", () => $("hist-file").click());
$("hist-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const r = BTStore.importAll(JSON.parse(await f.text()));
    toast(r.ok ? `Backup importado: ${r.added} partida(s) nova(s)` : r.reason);
  } catch (_) { toast("Arquivo inválido"); }
  refreshHistory();
});

refreshAthleteList();
