const test = require("node:test");
const assert = require("node:assert");
const Stats = require("../js/stats.js");

const m = (names, winner, games, tournament) => ({ names, winner, games, tournament });
const A = ["ANA", "BIA"], B = ["CAIO", "DAVI"], C = ["EDU", "FABI"];
const history = [
  m([A, B], 0, [7, 5]),
  m([A, B], 1, [3, 6]),
  m([A, C], 0, [6, 2], { id: "t1" }),
  m([B, C], 1, [4, 6]),
];

test("ranking individual: vitórias, derrotas e aproveitamento", () => {
  const r = Stats.athletes(history);
  const ana = r.find((x) => x.name === "ANA");
  assert.deepStrictEqual([ana.matches, ana.wins, ana.losses, ana.pct], [3, 2, 1, 67]);
  assert.strictEqual(ana.gf, 7 + 3 + 6);
  assert.strictEqual(r[0].name, "ANA");                    // mais vitórias, depois aproveitamento
});

test("filtro: só avulsas e só torneios", () => {
  assert.strictEqual(Stats.athletes(history, "tournament").find((x) => x.name === "ANA").matches, 1);
  assert.strictEqual(Stats.athletes(history, "casual").find((x) => x.name === "ANA").matches, 2);
});

test("ranking de duplas ignora a ordem dos nomes", () => {
  const p = Stats.pairs([m([["BIA", "ANA"], B], 0, [6, 0]), m([A, B], 1, [2, 6])]);
  const ab = p.find((x) => x.name === "ANA e BIA");
  assert.deepStrictEqual([ab.matches, ab.wins, ab.losses], [2, 1, 1]);
});

test("partidas sem vencedor são ignoradas", () => {
  assert.strictEqual(Stats.athletes([m([A, B], -1, [3, 3])]).length, 0);
});
