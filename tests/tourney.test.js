const test = require("node:test");
const assert = require("node:assert");
const T = require("../js/tourney-logic.js");

const P8 = ["A", "B", "C", "D", "E", "F", "G", "H"];
const win = (t, m, g = [6, 3]) => T.recordResult(t, m.id, { games: g });

test("Super 8: 7 rodadas, 2 jogos por rodada, cada atleta joga 1 vez por rodada", () => {
  const t = T.createSuper8("S8", P8);
  assert.strictEqual(t.matches.length, 14);
  for (let r = 1; r <= 7; r++) {
    const ms = t.matches.filter((m) => m.round === r);
    assert.strictEqual(ms.length, 2);
    assert.deepStrictEqual(ms.flatMap((m) => [...m.a, ...m.b]).sort(), P8);
  }
});

test("Super 8: cada atleta forma dupla com todos os outros exatamente uma vez", () => {
  const t = T.createSuper8("S8", P8);
  const { partner } = T.counters(t.matches);
  for (const x of P8) for (const y of P8) if (x !== y) assert.strictEqual(partner[x][y], 1, `${x}+${y}`);
});

test("Super 8: adversários bem distribuídos (melhor possível com parceiros todos diferentes)", () => {
  const t = T.createSuper8("S8", P8);
  const { opp } = T.counters(t.matches);
  for (const x of P8) {
    const counts = P8.filter((y) => y !== x).map((y) => opp[x][y] || 0);
    assert.strictEqual(counts.reduce((a, b) => a + b, 0), 14);
    assert.ok(Math.max(...counts) <= 4, `${x}: ${counts}`);
  }
});

test("Super 8: classificação por vitórias, saldo e games", () => {
  const t = T.createSuper8("S8", P8);
  const m = t.matches[0];
  win(t, m, [6, 2]);
  const s = T.standings(t);
  const winners = [...m.a].sort();
  assert.deepStrictEqual(s.slice(0, 2).map((x) => x.name).sort(), winners);
  assert.deepStrictEqual([s[0].wins, s[0].gf, s[0].ga], [1, 6, 2]);
  assert.ok(!T.isComplete(t));
  t.matches.forEach((x) => { if (!x.result) win(t, x); });
  assert.ok(T.isComplete(t));
  assert.ok(T.podium(t).champion);
});

test("Super 8 exige 8 atletas", () => {
  assert.throws(() => T.createSuper8("x", ["A", "B", "C"]));
});

test("resultado precisa ter vencedor e não aceita empate", () => {
  const t = T.createSuper8("S8", P8);
  assert.strictEqual(T.recordResult(t, "m1", { games: [4, 4] }).ok, false);
  assert.strictEqual(T.recordResult(t, "nope", { games: [6, 1] }).ok, false);
});

test("Rei da Quadra: gera rodadas só após terminar a anterior e faz rodízio justo", () => {
  const players = ["A", "B", "C", "D", "E", "F"];
  const t = T.createKing("rei", "Rei", players);
  assert.strictEqual(t.matches.length, 1);
  assert.strictEqual(T.nextRound(t), null);                // rodada 1 ainda aberta
  for (let i = 0; i < 12; i++) { t.matches.filter((m) => !m.result).forEach((m) => win(t, m)); T.nextRound(t); }
  const played = Object.fromEntries(players.map((p) => [p, 0]));
  t.matches.forEach((m) => [...m.a, ...m.b].forEach((p) => played[p]++));
  const v = Object.values(played);
  assert.ok(Math.max(...v) - Math.min(...v) <= 1, JSON.stringify(played));
});

test("Rei da Quadra evita repetir parceiros enquanto possível", () => {
  const t = T.createKing("rainha", "Rainha", P8, { courts: 2 });
  assert.strictEqual(t.matches.length, 2);                 // 2 quadras = 2 jogos por rodada
  for (let i = 0; i < 3; i++) { t.matches.filter((m) => !m.result).forEach((m) => win(t, m)); T.nextRound(t); }
  const { partner } = T.counters(t.matches);
  let repeats = 0;
  for (const x of P8) for (const y of P8) if (x < y && partner[x] && partner[x][y] > 1) repeats++;
  assert.strictEqual(repeats, 0);
});

test("Chaveamento com 8 duplas: 7 jogos, campeão sai da final", () => {
  const teams = Array.from({ length: 8 }, (_, i) => [`J${i}a`, `J${i}b`]);
  const t = T.createBracket("C", teams);
  assert.strictEqual(t.matches.length, 7);
  assert.strictEqual(T.roundLabel(t, 1), "Quartas de final");
  assert.strictEqual(T.roundLabel(t, 3), "Final");
  for (let r = 1; r <= 3; r++) t.matches.filter((m) => m.round === r).forEach((m) => assert.ok(win(t, m).ok, `r${r}`));
  assert.ok(T.isComplete(t));
  assert.strictEqual(T.podium(t).champion, "J0a e J0b");   // cabeça 1 sempre vence (a)
});

test("Chaveamento com 5 duplas: 3 folgas e avanço automático", () => {
  const teams = Array.from({ length: 5 }, (_, i) => [`T${i}`, `U${i}`]);
  const t = T.createBracket("C", teams);
  assert.strictEqual(t.matches.filter((m) => m.bye).length, 3);
  const semi = t.matches.filter((m) => m.round === 2);
  assert.ok(semi.some((m) => m.a && !m.b) || semi.some((m) => m.a && m.b));
  const playable = () => t.matches.filter((m) => m.a && m.b && !m.bye && !m.result);
  let guard = 0;
  while (playable().length && guard++ < 10) playable().forEach((m) => win(t, m));
  assert.ok(T.isComplete(t));
});

test("Chaveamento com 3 duplas funciona e valida limites", () => {
  const t = T.createBracket("C", [["a", "b"], ["c", "d"], ["e", "f"]]);
  let guard = 0;
  while (!T.isComplete(t) && guard++ < 10) t.matches.filter((m) => m.a && m.b && !m.bye && !m.result).forEach((m) => win(t, m));
  assert.ok(T.isComplete(t));
  assert.throws(() => T.createBracket("C", [["a", "b"], ["c", "d"]]));
});

test("refazer resultado no chaveamento só se o jogo seguinte não foi disputado", () => {
  const teams = Array.from({ length: 4 }, (_, i) => [`P${i}`, `Q${i}`]);
  const t = T.createBracket("C", teams);
  const [s1, s2, fin] = t.matches;
  win(t, s1); win(t, s2); win(t, fin);
  assert.strictEqual(T.clearResult(t, s1.id).ok, false);   // final já disputada
  assert.ok(T.clearResult(t, fin.id).ok);
  assert.ok(T.clearResult(t, s1.id).ok);
  assert.strictEqual(fin.a, null);                          // vaga da final volta a ficar em aberto
});
