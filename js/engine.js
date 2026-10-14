/* =====================================================================
 * Beach Tennis Score — motor de regras (sem acesso à tela)
 *
 * Uma partida é um objeto M = { S, undo, G }:
 *   S     estado (placar, saque, histórico de games…)
 *   undo  pilha de snapshots de S, um por ponto
 *   G     G[k] = { s, u } estado no início da k-ésima unidade (game ou tie-break)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BTEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const PT = ["0", "15", "30", "40"];
  const MAX_UNDO = 500;
  const other = (t) => 1 - t;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* cfg: { names:[[a,b],[c,d]], first:[dupla, atleta], target?: 6 | 4 } */
  function create(cfg) {
    const S = {
      names: cfg.names,
      first: cfg.first,            // [dupla, atleta] que saca o Game 1
      second: null,                // atleta da dupla adversária que saca o Game 2
      target: cfg.target || 6,     // games para vencer o set (6 = regra oficial)
      games: [0, 0], points: [0, 0],
      tb: false, tbPts: [0, 0], tbResult: null,
      swapped: false,              // true = duplas trocaram de lado (Dupla 2 aparece à esquerda)
      log: [],                     // { game, winner, loserScore }
      totalPoints: [0, 0],
      finished: false, winner: -1
    };
    return { S, undo: [], G: [{ s: clone(S), u: 0 }] };
  }

  const gamesPlayed = (S) => S.games[0] + S.games[1];
  const units = (S) => S.log.length + (S.tbResult ? 1 : 0);
  const needSecond = (S) => !!S && S.second === null && (gamesPlayed(S) >= 1 || S.tb);

  /* Sequência de saque: dupla A atleta 1 → dupla B atleta 1 → dupla A atleta 2 → dupla B atleta 2 … */
  function serverOrder(S) {
    const f = S.first[0], fp = S.first[1], o = other(f), op = S.second;
    return [[f, fp], [o, op], [f, 1 - fp], [o, op === null ? null : 1 - op]];
  }
  function currentServer(S) {
    const ord = serverOrder(S);
    if (!S.tb) return ord[gamesPlayed(S) % 4];
    // Tie-break: 1 ponto, depois 2 por vez, alternando as duplas e os atletas de cada dupla
    const total = S.tbPts[0] + S.tbPts[1];
    const turn = total === 0 ? 0 : (total + 1) >> 1;
    const [f, fp] = ord[0], [o, op] = ord[1];
    const team = turn % 2 === 0 ? f : o;
    const n = turn >> 1;
    const start = team === f ? fp : op;
    return [team, start === null ? null : (n % 2 === 0 ? start : 1 - start)];
  }

  const setOver = (g, t, T) => (g[t] >= T && g[t] - g[other(t)] >= 2) || g[t] === T + 1;

  /* Marca um ponto. Retorna null se recusado; senão { side?, tb?, finished? } */
  function addPoint(M, t) {
    const S = M.S;
    if (S.finished || needSecond(S)) return null;
    M.undo.push(clone(S));
    if (M.undo.length > MAX_UNDO) { M.undo.shift(); M.G.forEach((g) => { if (g) g.u = Math.max(0, g.u - 1); }); }
    S.totalPoints[t]++;
    const info = S.tb ? tiebreakPoint(M, t) : gamePoint(M, t);
    return info || {};
  }

  function gamePoint(M, t) {
    const S = M.S, o = other(t);
    S.points[t]++;
    if (S.points[t] < 4) return null;           // 40x40: o próximo ponto decide (sem vantagem)
    return gameWon(M, t, PT[S.points[o]]);
  }

  function gameWon(M, t, loserScore) {
    const S = M.S, T = S.target;
    const n = gamesPlayed(S) + 1;
    S.log.push({ game: n, winner: t, loserScore });
    S.games[t]++;
    S.points = [0, 0];
    const g = S.games;
    if (setOver(g, t, T)) return finishSet(S, t);
    if (g[0] === T && g[1] === T) {
      S.tb = true; S.tbPts = [0, 0];
      M.G.push({ s: clone(S), u: M.undo.length });
      return { tb: true, game: n };
    }
    M.G.push({ s: clone(S), u: M.undo.length });
    if (n % 2 === 1) { S.swapped = !S.swapped; return { side: `Final do Game ${n}`, game: n }; }
    return { game: n };
  }

  function tiebreakPoint(M, t) {
    const S = M.S, o = other(t);
    S.tbPts[t]++;
    const total = S.tbPts[0] + S.tbPts[1];
    if (S.tbPts[t] >= 7 && S.tbPts[t] - S.tbPts[o] >= 2) {
      S.tbResult = { winner: t, score: [...S.tbPts] };
      S.games[t] = S.target + 1;
      return finishSet(S, t);
    }
    if (total % 4 === 1) { S.swapped = !S.swapped; return { side: `Tie-Break: ${total} ${total === 1 ? "ponto" : "pontos"}` }; }
    return null;
  }

  function finishSet(S, t) {
    S.finished = true; S.winner = t;
    if (!S.tb) S.points = [0, 0];
    return { finished: true };
  }

  /* Verifica fim de partida após edição manual */
  function recheckEnd(S) {
    const g = S.games, T = S.target;
    S.finished = false; S.winner = -1; S.tbResult = null;
    if (g[0] === T && g[1] === T) {
      S.tb = true;
      for (const t of [0, 1]) {
        if (S.tbPts[t] >= 7 && S.tbPts[t] - S.tbPts[other(t)] >= 2) {
          S.tbResult = { winner: t, score: [...S.tbPts] }; g[t] = T + 1; S.finished = true; S.winner = t;
        }
      }
    } else {
      S.tb = false; S.tbPts = [0, 0];
      for (const t of [0, 1]) if (setOver(g, t, T)) { S.finished = true; S.winner = t; }
    }
    if (S.finished) S.points = [0, 0];
  }

  /* ---------------- Correção ---------------- */
  function undoPoint(M) {
    if (!M.undo.length) return { ok: false, reason: "Nada para desfazer" };
    const wasFinished = M.S.finished;
    M.S = M.undo.pop();
    while (M.G.length > 1 && M.G[M.G.length - 1] && M.G[M.G.length - 1].u > M.undo.length) M.G.pop();
    return { ok: true, wasFinished };
  }
  function undoGame(M) {
    const n = units(M.S), entry = M.G[n - 1];
    if (n === 0 || !entry) return { ok: false, reason: "Não há game para desfazer" };
    const wasFinished = M.S.finished;
    M.S = clone(entry.s);
    M.undo.length = Math.min(M.undo.length, entry.u);
    M.G.length = n;
    return { ok: true, wasFinished };
  }

  /* g = [games1, games2]; pts = pontos do game atual ("0","15","30","40") ou do tie-break (números) */
  function applyEdit(M, g, rawPts) {
    const S = M.S, T = S.target;
    const inTb = g[0] === T && g[1] === T;
    const validGames = g.every((x) => Number.isInteger(x) && x >= 0 && x <= T + 1) &&
      !(Math.max(...g) === T + 1 && ![T - 1, T].includes(Math.min(...g)));
    if (!validGames) return { ok: false, reason: "Valores inválidos" };
    const nums = rawPts.map((v) => parseInt(v, 10));
    if (nums.some((n) => isNaN(n) || n < 0)) return { ok: false, reason: "Valores inválidos" };
    if (!inTb && nums.some((n) => !PT.includes(String(n)))) return { ok: false, reason: "Pontos devem ser 0, 15, 30 ou 40" };
    const pts = inTb ? nums : nums.map((n) => PT.indexOf(String(n)));
    M.undo.push(clone(S));
    S.games = g.slice();
    if (inTb) S.tbPts = pts; else S.points = pts;
    recheckEnd(S);
    S.swapped = (gamesPlayed(S) + (S.tb ? Math.ceil((S.tbPts[0] + S.tbPts[1]) / 4) : 0)) % 2 === 1;
    // após edição, o histórico por game deixa de ser reversível além deste ponto
    M.G = Array(units(S)).fill(null);
    M.G.push({ s: clone(S), u: M.undo.length });
    return { ok: true };
  }

  return { PT, create, clone, other, gamesPlayed, units, needSecond, serverOrder, currentServer, addPoint, undoPoint, undoGame, applyEdit, setOver };
});
