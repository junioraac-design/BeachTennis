/* Torneios: lista, criação, jogos, classificação e ligação com o placar. */
let curTid = null;

const tKinds = BTTourney.KINDS;
const loadT = (id) => BTStore.getTourneys().find((t) => t.id === id);
const nameKey = (n) => n.trim().replace(/\s+/g, " ").toUpperCase();
const teamTxt = (team) => (team ? `${team[0]} e ${team[1]}` : null);

/* ---------- Lista ---------- */
function openTourneys() {
  const box = $("tl-list");
  box.textContent = "";
  const all = BTStore.getTourneys();
  if (!all.length) { const d = document.createElement("div"); d.className = "empty"; d.textContent = "Nenhum torneio ainda. Crie um Super 8, Rei/Rainha da Quadra ou Chaveamento."; box.appendChild(d); }
  all.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "t-card";
    const done = t.matches.filter((m) => m.result || m.bye).length;
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = `${tKinds[t.kind].icon} ${t.name}`;
    const sub = document.createElement("div"); sub.className = "sub";
    const status = BTTourney.isComplete(t) ? "🏁 encerrado" : `${done}/${t.matches.length} jogos`;
    sub.textContent = `${tKinds[t.kind].label} · ${new Date(t.createdAt).toLocaleDateString("pt-BR")} · ${status}`;
    b.append(nm, sub);
    b.addEventListener("click", () => openTourneyDetail(t.id));
    box.appendChild(b);
  });
  showScreen("tourneys");
}

/* ---------- Criação ---------- */
const HELP = {
  super8: "Digite 8 atletas, um por linha. São 7 rodadas: cada atleta joga uma vez ao lado de cada um dos outros, e a classificação é individual (vitórias, saldo de games).",
  rei: "Digite de 4 a 16 atletas, um por linha. As rodadas são sorteadas uma a uma, com rodízio justo (quem ficou de fora entra primeiro) e parceiros diferentes. Encerre quando quiser.",
  rainha: "Mesmo formato do Rei da Quadra, para o torneio feminino: de 4 a 16 atletas, um por linha, rodízio justo e parceiros diferentes. Encerre quando quiser.",
  chave: "Digite de 3 a 16 duplas, uma por linha, com os nomes separados por “/”. Ex.: JOÃO / PEDRO. As duplas sem adversário na 1ª fase avançam direto (folga)."
};
function curKind() { return document.querySelector('input[name="tkind"]:checked').value; }
function refreshNewForm() {
  const k = curKind();
  $("tn-help").textContent = HELP[k];
  $("tn-list-label").textContent = k === "chave" ? "Duplas (uma por linha)" : k === "super8" ? "8 atletas (um por linha)" : "Atletas (um por linha)";
  $("tn-list").placeholder = k === "chave" ? "JOÃO / PEDRO\nCARLOS / LUCAS\nANA / BIA" : "JOÃO\nPEDRO\nCARLOS\nLUCAS";
  $("tn-courts-row").hidden = !(k === "rei" || k === "rainha");
}
function openNew() {
  $("tn-name").value = ""; $("tn-list").value = "";
  document.querySelector(`input[name="tset"][value="${BTStore.getSettings().setSize}"]`).checked = true;
  refreshNewForm(); showScreen("tnew");
}
function parseLines() {
  return $("tn-list").value.split("\n").map((l) => l.trim()).filter(Boolean);
}
function createTourney() {
  const kind = curKind(), lines = parseLines();
  const target = +document.querySelector('input[name="tset"]:checked').value;
  const name = $("tn-name").value.trim();
  let t;
  try {
    if (kind === "chave") {
      const teams = lines.map((l) => l.split(/\s*[\/+&]\s*|\s+e\s+/i).map(nameKey).filter(Boolean));
      if (teams.some((x) => x.length !== 2)) return toast("Cada linha precisa de 2 nomes separados por “/”");
      const all = teams.flat();
      if (new Set(all).size !== all.length) return toast("Há nomes repetidos nas duplas");
      t = BTTourney.createBracket(name, teams, { target });
    } else {
      const players = lines.map(nameKey);
      if (new Set(players).size !== players.length) return toast("Há nomes repetidos");
      if (kind === "super8") t = BTTourney.createSuper8(name, players, { target });
      else {
        const courts = +document.querySelector('input[name="tcourts"]:checked').value;
        if (courts === 2 && players.length < 8) return toast("Com 2 quadras são necessários pelo menos 8 atletas");
        t = BTTourney.createKing(kind, name, players, { target, courts });
      }
    }
  } catch (e) { return toast(e.message); }
  const id = BTStore.saveTourney(t);
  if (!id) return toast("Sem espaço para salvar o torneio");
  openTourneyDetail(id);
}

/* ---------- Detalhe ---------- */
function openTourneyDetail(id) { curTid = id; $("dt0").checked = true; renderDetail(); showScreen("tdetail"); }

function renderDetail() {
  const t = loadT(curTid);
  if (!t) return openTourneys();
  $("td-title").textContent = `${tKinds[t.kind].icon} ${t.name}`;
  $("dt1l").textContent = BTTourney.isIndividual(t) ? "Classificação" : "Duplas";

  // pódio
  const pod = $("td-podium");
  pod.textContent = "";
  const p = BTTourney.isComplete(t) ? BTTourney.podium(t) : null;
  if (p) {
    const d = document.createElement("div"); d.className = "podium";
    const lines = [`<span class="big">🥇 ${esc(p.champion)}</span>`];
    if (p.second) lines.push(`🥈 ${esc(p.second)}`);
    if (p.third) lines.push(`🥉 ${esc(p.third)}`);
    d.innerHTML = "🏁 Torneio encerrado<br>" + lines.join("<br>");
    pod.appendChild(d);
  }

  const body = $("td-body");
  body.textContent = "";
  if (document.querySelector('input[name="dtab"]:checked').value === "games") renderGames(t, body); else renderTable(t, body);

  // ações
  const king = t.kind === "rei" || t.kind === "rainha";
  const last = BTTourney.roundsOf(t);
  const canNext = king && !t.finished && t.matches.filter((m) => m.round === last).every((m) => m.result);
  $("td-next").hidden = !canNext;
  $("td-end").hidden = !(king && !t.finished);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderGames(t, body) {
  const saved = loadSaved();
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  rounds.forEach((r) => {
    const h = document.createElement("div"); h.className = "t-round"; h.textContent = BTTourney.roundLabel(t, r);
    body.appendChild(h);
    t.matches.filter((m) => m.round === r).forEach((m) => {
      const card = document.createElement("div"); card.className = "t-match";
      const row = document.createElement("div"); row.className = "row";
      const a = document.createElement("div"), sc = document.createElement("div"), b = document.createElement("div");
      sc.className = "sc num"; b.className = "r";
      const tbd = (el) => { el.textContent = "a definir"; el.classList.add("tbd"); };
      if (m.a) a.textContent = teamTxt(m.a); else tbd(a);
      if (m.b) b.textContent = teamTxt(m.b); else tbd(b);
      if (m.result) {
        sc.innerHTML = xScore(m.result.games[0], m.result.games[1]);
        (m.result.winner === 0 ? a : b).classList.add("w");
      } else sc.textContent = "x";
      row.append(a, sc, b); card.appendChild(row);
      if (m.bye) {
        const n = document.createElement("div"); n.className = "note"; n.textContent = `Folga: ${teamTxt(m.a || m.b)} avança direto.`; card.appendChild(n);
      } else if (m.a && m.b) {
        const acts = document.createElement("div"); acts.className = "acts";
        if (m.result) {
          const redo = document.createElement("button"); redo.type = "button"; redo.textContent = "↩ Refazer jogo";
          redo.addEventListener("click", () => confirmDialog("Refazer jogo?", "O resultado será apagado e o jogo volta a ficar pendente.", "Refazer", () => {
            const tt = loadT(t.id), r2 = BTTourney.clearResult(tt, m.id);
            if (!r2.ok) return toast(r2.reason);
            BTStore.saveTourney(tt); renderDetail();
          }));
          acts.appendChild(redo);
        } else {
          const cont = saved && !saved.S.finished && saved.tref && saved.tref.id === t.id && saved.tref.matchId === m.id;
          const go = document.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = cont ? "▶ Continuar" : "▶ Jogar";
          go.addEventListener("click", () => (cont ? resumeSaved() : playTourneyMatch(t.id, m.id)));
          const man = document.createElement("button"); man.type = "button"; man.textContent = "✏ Lançar placar";
          man.addEventListener("click", () => openResultDialog(t.id, m));
          acts.append(go, man);
        }
        card.appendChild(acts);
      }
      body.appendChild(card);
    });
  });
}

function renderTable(t, body) {
  const reg = BTStore.getAthletes();
  if (BTTourney.isIndividual(t)) {
    BTTourney.standings(t).forEach((r, i) => {
      const row = document.createElement("div"); row.className = "rank-row" + (i === 0 && r.matches ? " top1" : "");
      const pos = document.createElement("div"); pos.className = "pos"; pos.textContent = r.matches && i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1;
      const ph = makePhoto(reg[r.name] ? reg[r.name].photo : null, r.name);
      const mid = document.createElement("div");
      const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = r.name;
      const sub = document.createElement("div"); sub.className = "sub";
      const saldo = r.gf - r.ga;
      sub.textContent = `${r.matches} jogo${r.matches === 1 ? "" : "s"} · ${r.wins}V ${r.losses}D · games ${r.gf}-${r.ga} (${saldo > 0 ? "+" : ""}${saldo})`;
      mid.append(nm, sub);
      const big = document.createElement("div"); big.className = "big num"; big.innerHTML = `${r.wins}<small>vitórias</small>`;
      row.append(pos, ph, mid, big); body.appendChild(row);
    });
  } else {
    // chaveamento: duplas inscritas e até onde cada uma chegou
    const reach = {};
    t.teams.forEach((tm) => (reach[tm.join(" e ")] = 0));
    t.matches.forEach((m) => { [m.a, m.b].forEach((x) => { if (x) reach[x.join(" e ")] = Math.max(reach[x.join(" e ")] || 0, m.round); }); });
    t.teams.map((tm) => tm.join(" e ")).sort((x, y) => reach[y] - reach[x]).forEach((nm0, i) => {
      const row = document.createElement("div"); row.className = "rank-row";
      const pos = document.createElement("div"); pos.className = "pos"; pos.textContent = i + 1;
      const ph = makePhoto(null, "?"); ph.textContent = "👥";
      const mid = document.createElement("div");
      const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = nm0;
      const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = `Chegou até: ${BTTourney.roundLabel(t, reach[nm0])}`;
      mid.append(nm, sub);
      row.append(pos, ph, mid, document.createElement("div")); body.appendChild(row);
    });
  }
}

/* ---------- Jogar / lançar resultado ---------- */
function playTourneyMatch(tid, mid) {
  const t = loadT(tid), m = t && t.matches.find((x) => x.id === mid);
  if (!m || !m.a || !m.b) return;
  const reg = BTStore.getAthletes();
  const photos = [m.a, m.b].map((team) => team.map((n) => (reg[n] && reg[n].photo) || null));
  // quem começa à esquerda é definido na hora, olhando a quadra
  $("sd-note").textContent = "Olhando a quadra de onde você vai marcar, qual dupla começa à esquerda?";
  $("sd-a").textContent = `◀ ${teamTxt(m.a)}`; $("sd-b").textContent = `${teamTxt(m.b)} ▶`;
  const go = (flip) => { $("dlg-side").close(); chooseFirstServer(m, photos, (first) =>
    startMatch({ names: [m.a.slice(), m.b.slice()], first, target: t.target || 6 }, photos, { id: tid, matchId: mid }, flip)); };
  $("sd-a").onclick = () => go(0); $("sd-b").onclick = () => go(1);
  $("dlg-side").showModal();
}

/* Escolha de quem saca primeiro (4 atletas) */
function chooseFirstServer(m, photos, done) {
  const row = $("first-row");
  row.textContent = "";
  [m.a, m.b].forEach((team, t) => team.forEach((name, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pick-btn";
    b.append(makePhoto(photos[t][i], name), document.createTextNode(name));
    b.addEventListener("click", () => { $("dlg-first").close(); done([t, i]); });
    row.appendChild(b);
  }));
  $("dlg-first").showModal();
}

let resTarget = null;
function openResultDialog(tid, m) {
  resTarget = { tid, mid: m.id };
  $("tr-la").textContent = teamTxt(m.a); $("tr-lb").textContent = teamTxt(m.b);
  $("tr-a").value = ""; $("tr-b").value = "";
  $("tr-note").textContent = "Informe os games de cada dupla (precisa haver um vencedor).";
  $("dlg-tres").showModal();
}
$("tr-ok").addEventListener("click", () => {
  const t = loadT(resTarget.tid);
  const r = BTTourney.recordResult(t, resTarget.mid, { games: [parseInt($("tr-a").value, 10), parseInt($("tr-b").value, 10)] });
  if (!r.ok) return toast(r.reason);
  BTStore.saveTourney(t); $("dlg-tres").close(); renderDetail();
});
$("tr-cancel").addEventListener("click", () => $("dlg-tres").close());

/* Ganchos chamados pelo histórico quando a partida do torneio termina ou é reaberta */
function onMatchSaved(rec) {
  if (!tref) return;
  const t = loadT(tref.id);
  if (!t) return;
  const m = t.matches.find((x) => x.id === tref.matchId);
  if (m && m.result) BTTourney.clearResult(t, m.id);
  BTTourney.recordResult(t, tref.matchId, { games: rec.games.slice(), matchId: rec.id, duration: rec.duration });
  BTStore.saveTourney(t);
}
function onMatchDiscarded() {
  if (!tref) return;
  const t = loadT(tref.id);
  if (!t) return;
  BTTourney.clearResult(t, tref.matchId);
  BTStore.saveTourney(t);
}

/* ---------- Eventos ---------- */
$("btn-tourneys").addEventListener("click", openTourneys);
$("tl-back").addEventListener("click", () => showScreen("setup"));
$("tl-new").addEventListener("click", openNew);
$("tl-rank").addEventListener("click", () => { $("ht1").checked = true; $("hist-filter").value = "tournament"; openHistory(); });
$("tn-back").addEventListener("click", openTourneys);
document.querySelectorAll('input[name="tkind"]').forEach((r) => r.addEventListener("change", refreshNewForm));
$("tn-create").addEventListener("click", createTourney);
$("td-back").addEventListener("click", openTourneys);
document.querySelectorAll('input[name="dtab"]').forEach((r) => r.addEventListener("change", renderDetail));
$("td-next").addEventListener("click", () => {
  const t = loadT(curTid);
  if (!BTTourney.nextRound(t)) return toast("Termine os jogos da rodada atual primeiro");
  BTStore.saveTourney(t); renderDetail();
});
$("td-end").addEventListener("click", () => confirmDialog("Encerrar torneio?", "A classificação atual vira o resultado final.", "Encerrar", () => {
  const t = loadT(curTid); t.finished = true; BTStore.saveTourney(t); renderDetail();
}));
$("td-del").addEventListener("click", () => confirmDialog("Excluir torneio?", "O torneio será removido. As partidas já salvas continuam no histórico.", "Excluir", () => {
  BTStore.deleteTourney(curTid); curTid = null; openTourneys();
}));
