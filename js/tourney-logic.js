/* =====================================================================
 * Torneios — lógica pura (sorteios, tabelas, classificação)
 *
 *  super8   8 atletas, 7 rodadas, parceiro diferente a cada rodada; ranking individual
 *  rei      Rei da Quadra: rodadas geradas uma a uma, rodízio justo; ranking individual
 *  rainha   Rainha da Quadra: mesmo formato do Rei da Quadra
 *  chave    Chaveamento (mata-mata) com duplas fixas e folgas (byes)
 *
 *  Torneio: { id?, kind, name, createdAt, target, players | teams, matches, courts?, finished }
 *  Jogo:    { id, round, a:[x,y]|null, b:[x,y]|null, result: null | { games:[ga,gb], winner, matchId?, duration? } }
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BTTourney = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KINDS = {
    super8: { label: "Super 8", icon: "8️⃣" },
    rei: { label: "Rei da Quadra", icon: "👑" },
    rainha: { label: "Rainha da Quadra", icon: "👸" },
    chave: { label: "Chaveamento", icon: "🏆" }
  };
  const isIndividual = (t) => t.kind !== "chave";

  /* contadores de parceria/oposição entre atletas */
  function counters(matches) {
    const partner = {}, opp = {};
    const inc = (m, x, y) => { m[x] = m[x] || {}; m[x][y] = (m[x][y] || 0) + 1; };
    for (const m of matches) {
      if (!m.a || !m.b) continue;
      inc(partner, m.a[0], m.a[1]); inc(partner, m.a[1], m.a[0]);
      inc(partner, m.b[0], m.b[1]); inc(partner, m.b[1], m.b[0]);
      for (const x of m.a) for (const y of m.b) { inc(opp, x, y); inc(opp, y, x); }
    }
    return { partner, opp };
  }
  const get = (m, x, y) => (m[x] && m[x][y]) || 0;

  /* melhor divisão de 4 atletas em duas duplas (3 opções) */
  function bestPairing(four, c) {
    const [a, b, x, y] = four;
    const options = [[[a, b], [x, y]], [[a, x], [b, y]], [[a, y], [b, x]]];
    let best = null;
    for (const [p, q] of options) {
      let cost = (get(c.partner, p[0], p[1]) + get(c.partner, q[0], q[1])) * 10;
      for (const u of p) for (const v of q) cost += get(c.opp, u, v);
      if (!best || cost < best.cost) best = { cost, a: p, b: q };
    }
    return best;
  }

  /* ---------------- Super 8 ---------------- */
  function createSuper8(name, players, opts) {
    if (players.length !== 8) throw new Error("O Super 8 precisa de 8 atletas");
    // método do círculo: cada rodada tem 4 duplas; ao longo de 7 rodadas todos jogam com todos
    const roundPairs = [];
    for (let r = 0; r < 7; r++) {
      const idx = [[7, r]];
      for (let k = 1; k <= 3; k++) idx.push([(r + k) % 7, (r - k + 7) % 7]);
      roundPairs.push(idx.map(([i, j]) => [players[i], players[j]]));
    }
    // cada rodada tem 3 formas de juntar as 4 duplas em 2 jogos; testa as 3^7 combinações
    // e fica com a que distribui melhor os adversários (menor soma dos quadrados)
    const ways = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    const pos = Object.fromEntries(players.map((p, i) => [p, i]));
    const opp = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const choice = new Array(7).fill(0);
    let best = { cost: Infinity, choice: null };
    const cost = () => { let c = 0; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) c += opp[i][j] * opp[i][j]; return c; };
    const apply = (r, w, d) => {
      for (const [i, j] of ways[w]) for (const u of roundPairs[r][i]) for (const v of roundPairs[r][j]) { opp[pos[u]][pos[v]] += d; opp[pos[v]][pos[u]] += d; }
    };
    (function search(r) {
      if (r === 7) { const c = cost(); if (c < best.cost) best = { cost: c, choice: choice.slice() }; return; }
      for (let w = 0; w < 3; w++) { choice[r] = w; apply(r, w, 1); search(r + 1); apply(r, w, -1); }
    })(0);
    const matches = [];
    let mid = 0;
    for (let r = 0; r < 7; r++) {
      for (const [i, j] of ways[best.choice[r]]) matches.push({ id: "m" + ++mid, round: r + 1, a: roundPairs[r][i], b: roundPairs[r][j], result: null });
    }
    return base("super8", name, opts, { players: players.slice(), matches });
  }

  /* ---------------- Rei / Rainha da Quadra ---------------- */
  function createKing(kind, name, players, opts) {
    if (players.length < 4) throw new Error("São necessários pelo menos 4 atletas");
    const courts = Math.max(1, Math.min((opts && opts.courts) || 1, Math.floor(players.length / 4), 2));
    const t = base(kind, name, opts, { players: players.slice(), matches: [], courts });
    nextRound(t);
    return t;
  }

  const roundsOf = (t) => t.matches.reduce((n, m) => Math.max(n, m.round), 0);
  const roundDone = (t, r) => t.matches.filter((m) => m.round === r).every((m) => m.result);

  /* Gera a próxima rodada (só quando a anterior terminou). Retorna os jogos criados ou null. */
  function nextRound(t) {
    if (t.kind !== "rei" && t.kind !== "rainha") return null;
    const last = roundsOf(t);
    if (last > 0 && !roundDone(t, last)) return null;
    const need = t.courts * 4;
    const played = {}, lastRound = {};
    t.players.forEach((p) => { played[p] = 0; lastRound[p] = 0; });
    for (const m of t.matches) for (const p of [...m.a, ...m.b]) { played[p]++; lastRound[p] = Math.max(lastRound[p], m.round); }
    // quem jogou menos, e há mais tempo sem jogar, entra primeiro
    const order = t.players.map((p, i) => ({ p, i })).sort((x, y) =>
      played[x.p] - played[y.p] || lastRound[x.p] - lastRound[y.p] || x.i - y.i).map((o) => o.p);
    const chosen = order.slice(0, need);
    const c = counters(t.matches);
    const groups = need === 4 ? [chosen] : splitInTwo(chosen, c);
    const added = [];
    let n = t.matches.length;
    for (const g of groups) {
      const bp = bestPairing(g, c);
      const m = { id: "m" + ++n, round: last + 1, a: bp.a, b: bp.b, result: null };
      t.matches.push(m); added.push(m);
    }
    return added;
  }

  function splitInTwo(eight, c) {
    let best = null;
    for (let mask = 0; mask < 256; mask++) {
      if (mask & 1 || bits(mask) !== 4) continue;           // fixa o 1º atleta no grupo A (evita repetição)
      const A = eight.filter((_, i) => mask & (1 << i)), B = eight.filter((_, i) => !(mask & (1 << i)));
      const cost = bestPairing(A, c).cost + bestPairing(B, c).cost;
      if (!best || cost < best.cost) best = { cost, A, B };
    }
    return [best.A, best.B];
  }
  const bits = (n) => { let k = 0; while (n) { k += n & 1; n >>= 1; } return k; };

  /* ---------------- Chaveamento ---------------- */
  const seedOrder = (n) => (n === 1 ? [1] : seedOrder(n / 2).flatMap((s) => [s, n + 1 - s]));

  function createBracket(name, teams, opts) {
    const n = teams.length;
    if (n < 3 || n > 16) throw new Error("O chaveamento precisa de 3 a 16 duplas");
    let size = 2; while (size < n) size *= 2;
    const order = seedOrder(size);
    const matches = [];
    let mid = 0;
    const firstIds = [];
    for (let i = 0; i < size; i += 2) {
      const sa = order[i], sb = order[i + 1];
      const m = { id: "m" + ++mid, round: 1, a: sa <= n ? teams[sa - 1] : null, b: sb <= n ? teams[sb - 1] : null, result: null };
      if (!m.a || !m.b) m.bye = true;
      matches.push(m); firstIds.push(m.id);
    }
    let prev = firstIds, round = 2;
    while (prev.length > 1) {
      const ids = [];
      for (let i = 0; i < prev.length; i += 2) {
        const m = { id: "m" + ++mid, round, a: null, b: null, srcA: prev[i], srcB: prev[i + 1], result: null };
        matches.push(m); ids.push(m.id);
      }
      prev = ids; round++;
    }
    const t = base("chave", name, opts, { teams: teams.map((x) => x.slice()), matches });
    resolveBracket(t);
    return t;
  }

  const winnerSide = (m) => (m.bye ? (m.a ? 0 : 1) : m.result ? m.result.winner : null);
  const winnerOf = (m) => { const w = winnerSide(m); return w === null ? null : (w === 0 ? m.a : m.b); };

  /* preenche os confrontos seguintes a partir dos vencedores */
  function resolveBracket(t) {
    const byId = Object.fromEntries(t.matches.map((m) => [m.id, m]));
    for (const m of t.matches) {
      if (!m.srcA) continue;
      m.a = winnerOf(byId[m.srcA]);
      m.b = winnerOf(byId[m.srcB]);
    }
  }

  /* ---------------- Resultados ---------------- */
  /* result: { games:[ga, gb], matchId?, duration? } — o vencedor sai dos games */
  function recordResult(t, matchId, result) {
    const m = t.matches.find((x) => x.id === matchId);
    if (!m || m.bye) return { ok: false, reason: "Jogo inexistente" };
    if (!m.a || !m.b) return { ok: false, reason: "Confronto ainda não definido" };
    const [ga, gb] = result.games;
    if (!Number.isInteger(ga) || !Number.isInteger(gb) || ga < 0 || gb < 0 || ga === gb) return { ok: false, reason: "Informe um placar com vencedor" };
    m.result = Object.assign({}, result, { winner: ga > gb ? 0 : 1 });
    if (t.kind === "chave") resolveBracket(t);
    return { ok: true };
  }

  function clearResult(t, matchId) {
    const m = t.matches.find((x) => x.id === matchId);
    if (!m || !m.result) return { ok: false, reason: "Jogo sem resultado" };
    if (t.kind === "chave") {
      const next = t.matches.find((x) => x.srcA === matchId || x.srcB === matchId);
      if (next && next.result) return { ok: false, reason: "O próximo jogo já foi disputado. Refaça-o antes." };
    } else {
      const later = t.matches.some((x) => x.round > m.round);
      if (later && (t.kind === "rei" || t.kind === "rainha")) {
        const last = roundsOf(t);
        if (m.round < last) return { ok: false, reason: "Só é possível refazer jogos da última rodada." };
      }
    }
    m.result = null;
    if (t.kind === "chave") resolveBracket(t);
    return { ok: true };
  }

  /* ---------------- Classificação ---------------- */
  /* Individual: vitória, saldo e games pró (Super 8, Rei e Rainha). Cada atleta recebe os games da sua dupla. */
  function standings(t) {
    if (!isIndividual(t)) return [];
    const row = Object.fromEntries(t.players.map((p) => [p, { name: p, matches: 0, wins: 0, losses: 0, gf: 0, ga: 0 }]));
    for (const m of t.matches) {
      if (!m.result) continue;
      const [ga, gb] = m.result.games;
      for (const p of m.a) { const r = row[p]; r.matches++; r.gf += ga; r.ga += gb; if (m.result.winner === 0) r.wins++; else r.losses++; }
      for (const p of m.b) { const r = row[p]; r.matches++; r.gf += gb; r.ga += ga; if (m.result.winner === 1) r.wins++; else r.losses++; }
    }
    return Object.values(row).sort((x, y) =>
      y.wins - x.wins || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name));
  }

  const finalMatch = (t) => (t.kind === "chave" ? t.matches[t.matches.length - 1] : null);
  const isComplete = (t) => (t.kind === "chave"
    ? !!(finalMatch(t).result)
    : t.kind === "super8" ? t.matches.every((m) => m.result) : !!t.finished);

  /* Pódio: { champion, second, third? } com nomes (atleta ou dupla) */
  function podium(t) {
    if (t.kind === "chave") {
      const f = finalMatch(t);
      if (!f.result) return null;
      const champ = winnerOf(f), second = f.result.winner === 0 ? f.b : f.a;
      return { champion: champ.join(" e "), second: second.join(" e ") };
    }
    const s = standings(t);
    if (!s.some((x) => x.matches)) return null;
    return { champion: s[0].name, second: s[1] && s[1].name, third: s[2] && s[2].name };
  }

  /* Rótulo da rodada do chaveamento */
  function roundLabel(t, round) {
    if (t.kind !== "chave") return `Rodada ${round}`;
    const total = t.matches.reduce((n, m) => Math.max(n, m.round), 0);
    const left = total - round;
    return left === 0 ? "Final" : left === 1 ? "Semifinais" : left === 2 ? "Quartas de final" : left === 3 ? "Oitavas de final" : `Rodada ${round}`;
  }

  function base(kind, name, opts, extra) {
    return Object.assign({ kind, name: name || KINDS[kind].label, createdAt: new Date().toISOString(),
      target: (opts && opts.target) || 6, finished: false }, extra);
  }

  return { KINDS, isIndividual, createSuper8, createKing, createBracket, nextRound, recordResult, clearResult,
    standings, podium, isComplete, roundLabel, roundsOf, winnerOf, resolveBracket, counters };
});
