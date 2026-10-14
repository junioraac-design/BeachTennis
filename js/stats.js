/* Estatísticas e ranking a partir do histórico de partidas (funções puras). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BTStats = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const pct = (w, n) => (n ? Math.round((w / n) * 100) : 0);
  const byRank = (a, b) =>
    b.wins - a.wins || b.pct - a.pct || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name);

  /* filter: "all" | "casual" (avulsas) | "tournament" */
  function select(history, filter) {
    if (filter === "casual") return history.filter((m) => !m.tournament);
    if (filter === "tournament") return history.filter((m) => m.tournament);
    return history;
  }

  /* Ranking individual: cada atleta da dupla vencedora soma uma vitória. */
  function athletes(history, filter) {
    const map = new Map();
    const get = (name) => {
      if (!map.has(name)) map.set(name, { name, matches: 0, wins: 0, losses: 0, gf: 0, ga: 0, pct: 0 });
      return map.get(name);
    };
    for (const m of select(history, filter)) {
      if (m.winner !== 0 && m.winner !== 1) continue;
      for (const t of [0, 1]) {
        for (const name of m.names[t]) {
          const a = get(name);
          a.matches++;
          if (m.winner === t) a.wins++; else a.losses++;
          a.gf += m.games[t]; a.ga += m.games[1 - t];
        }
      }
    }
    const list = [...map.values()];
    list.forEach((a) => (a.pct = pct(a.wins, a.matches)));
    return list.sort(byRank);
  }

  /* Ranking de duplas (par de atletas, independente da ordem). */
  function pairs(history, filter) {
    const map = new Map();
    for (const m of select(history, filter)) {
      if (m.winner !== 0 && m.winner !== 1) continue;
      for (const t of [0, 1]) {
        const names = [...m.names[t]].sort();
        const key = names.join(" e ");
        if (!map.has(key)) map.set(key, { name: key, matches: 0, wins: 0, losses: 0, gf: 0, ga: 0, pct: 0 });
        const p = map.get(key);
        p.matches++;
        if (m.winner === t) p.wins++; else p.losses++;
        p.gf += m.games[t]; p.ga += m.games[1 - t];
      }
    }
    const list = [...map.values()];
    list.forEach((p) => (p.pct = pct(p.wins, p.matches)));
    return list.sort(byRank);
  }

  return { athletes, pairs, pct };
});
