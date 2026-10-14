const test = require("node:test");
const assert = require("node:assert");
const E = require("../js/engine.js");

const cfg = (extra) => Object.assign({ names: [["JOÃO", "PEDRO"], ["CARLOS", "LUCAS"]], first: [0, 1] }, extra);
const pts = (M, t, n = 1) => { for (let i = 0; i < n; i++) E.addPoint(M, t); };
// vence um game (4 pontos seguidos); pede o sacador do Game 2 se necessário
const game = (M, t) => { if (E.needSecond(M.S)) M.S.second = 1; pts(M, t, 4); };

test("pontos 0-15-30-40 e game no 4º ponto (sem vantagem)", () => {
  const M = E.create(cfg());
  pts(M, 0, 3);
  assert.deepStrictEqual(M.S.points, [3, 0]);
  pts(M, 1, 3);                                  // 40x40
  assert.deepStrictEqual(M.S.points, [3, 3]);
  pts(M, 1);                                     // ponto de ouro decide
  assert.deepStrictEqual(M.S.games, [0, 1]);
  assert.deepStrictEqual(M.S.points, [0, 0]);
});

test("registra a pontuação da dupla perdedora no resumo", () => {
  const M = E.create(cfg());
  pts(M, 0, 2); pts(M, 1, 1); pts(M, 0, 2);      // 40x15 -> game
  assert.deepStrictEqual(M.S.log[0], { game: 1, winner: 0, loserScore: "15" });
});

test("sequência de saque: A1, B1, A2, B2", () => {
  const M = E.create(cfg());                     // Pedro (dupla 0, atleta 1) começa
  assert.deepStrictEqual(E.currentServer(M.S), [0, 1]);
  game(M, 1);
  assert.ok(E.needSecond(M.S));                  // precisa escolher o sacador do Game 2
  assert.strictEqual(E.addPoint(M, 0), null);    // e não aceita ponto antes disso
  M.S.second = 1;                                // Lucas
  assert.deepStrictEqual(E.currentServer(M.S), [1, 1]);
  game(M, 0); assert.deepStrictEqual(E.currentServer(M.S), [0, 0]);   // João
  game(M, 0); assert.deepStrictEqual(E.currentServer(M.S), [1, 0]);   // Carlos
  game(M, 0); assert.deepStrictEqual(E.currentServer(M.S), [0, 1]);   // Pedro de novo
});

test("troca de lado após game ímpar", () => {
  const M = E.create(cfg());
  game(M, 0); assert.strictEqual(M.S.swapped, true);
  game(M, 0); assert.strictEqual(M.S.swapped, true);    // game 2 (par): não troca
  game(M, 0); assert.strictEqual(M.S.swapped, false);   // game 3
});

test("fim do set: 6x0..6x4 e 7x5", () => {
  for (const loser of [0, 1, 2, 3, 4]) {
    const M = E.create(cfg()); M.S.second = 0;
    M.S.games = [0, loser]; M.S.log = []; 
    M.S.games = [5, loser];
    game(M, 0);
    assert.ok(M.S.finished, `6x${loser}`);
    assert.strictEqual(M.S.winner, 0);
  }
  const M = E.create(cfg()); M.S.second = 0; M.S.games = [5, 5];
  game(M, 0); assert.ok(!M.S.finished);                 // 6x5 continua
  game(M, 0); assert.ok(M.S.finished);                  // 7x5
  assert.deepStrictEqual(M.S.games, [7, 5]);
});

test("6x6 inicia tie-break; vence com 2 de diferença, sem limite", () => {
  const M = E.create(cfg()); M.S.second = 0; M.S.games = [5, 6];
  game(M, 0);
  assert.ok(M.S.tb);
  pts(M, 0, 6); pts(M, 1, 6);                           // 6x6
  assert.ok(!M.S.finished);
  pts(M, 0); assert.ok(!M.S.finished);                  // 7x6
  pts(M, 1); pts(M, 0); pts(M, 1); pts(M, 0); pts(M, 1); // 9x9...
  assert.ok(!M.S.finished);
  pts(M, 0, 2);
  assert.ok(M.S.finished);
  assert.deepStrictEqual(M.S.tbResult.score.map((x) => x - 0), M.S.tbResult.score);
  assert.strictEqual(M.S.tbResult.winner, 0);
  assert.deepStrictEqual(M.S.games, [7, 6]);
});

test("tie-break: troca de lado em 1, 5, 9, 13 pontos", () => {
  const M = E.create(cfg()); M.S.second = 0; M.S.games = [6, 6]; M.S.tb = true;
  const trocas = [];
  for (let i = 1; i <= 14; i++) { const r = E.addPoint(M, i % 2); if (r.side) trocas.push(i); }
  assert.deepStrictEqual(trocas, [1, 5, 9, 13]);
});

test("tie-break: saque 1 ponto e depois 2 por vez", () => {
  const M = E.create(cfg()); M.S.second = 1; M.S.games = [6, 6]; M.S.tb = true;
  const teams = [];
  for (let i = 0; i < 8; i++) { teams.push(E.currentServer(M.S)[0]); E.addPoint(M, i % 2); }
  assert.deepStrictEqual(teams, [0, 1, 1, 0, 0, 1, 1, 0]);
});

test("desfazer ponto e desfazer game", () => {
  const M = E.create(cfg());
  pts(M, 0, 2);
  E.undoPoint(M); assert.deepStrictEqual(M.S.points, [1, 0]);
  game(M, 0);
  assert.strictEqual(M.S.games[0], 1);
  E.undoPoint(M); assert.deepStrictEqual(M.S.games, [0, 0]); assert.deepStrictEqual(M.S.points, [3, 0]);
  pts(M, 0);
  const r = E.undoGame(M);
  assert.ok(r.ok); assert.deepStrictEqual(M.S.games, [0, 0]); assert.deepStrictEqual(M.S.points, [0, 0]);
  assert.strictEqual(M.S.swapped, false);
  assert.strictEqual(E.undoGame(M).ok, false);          // nada mais para desfazer
});

test("desfazer o último ponto da partida reabre o jogo", () => {
  const M = E.create(cfg()); M.S.second = 0; M.S.games = [5, 0];
  game(M, 0);
  assert.ok(M.S.finished);
  const r = E.undoPoint(M);
  assert.ok(r.wasFinished); assert.ok(!M.S.finished);
  assert.deepStrictEqual(M.S.games, [5, 0]);
});

test("desfazer game depois do tie-break volta ao início do tie-break", () => {
  const M = E.create(cfg());
  for (let i = 0; i < 5; i++) { game(M, 0); game(M, 1); }      // 5x5
  game(M, 0); game(M, 1);                                       // 6x6
  assert.ok(M.S.tb);
  pts(M, 0, 7);
  assert.ok(M.S.finished && M.S.tbResult);
  E.undoGame(M);
  assert.ok(M.S.tb && !M.S.finished); assert.deepStrictEqual(M.S.tbPts, [0, 0]);
  E.undoGame(M);                                                // volta ao início do game 12
  assert.deepStrictEqual(M.S.games, [6, 5]); assert.ok(!M.S.tb);
});

test("editar placar manualmente", () => {
  const M = E.create(cfg()); M.S.second = 0;
  assert.ok(E.applyEdit(M, [4, 3], ["40", "30"]).ok);
  assert.deepStrictEqual(M.S.games, [4, 3]); assert.deepStrictEqual(M.S.points, [3, 2]);
  assert.strictEqual(M.S.swapped, true);                // 7 games jogados -> lados invertidos
  assert.strictEqual(E.applyEdit(M, [8, 0], ["0", "0"]).ok, false);
  assert.strictEqual(E.applyEdit(M, [4, 3], ["25", "0"]).ok, false);
  assert.ok(E.applyEdit(M, [6, 6], ["5", "4"]).ok);     // tie-break com pontos livres
  assert.ok(M.S.tb); assert.deepStrictEqual(M.S.tbPts, [5, 4]);
  assert.ok(E.applyEdit(M, [6, 3], ["0", "0"]).ok);     // editar para um set já ganho encerra
  assert.ok(M.S.finished); assert.strictEqual(M.S.winner, 0);
});

test("set curto (target 4): 4x0..4x2, 5x3, tie-break em 4x4", () => {
  const M = E.create(cfg({ target: 4 })); M.S.second = 0; M.S.games = [3, 2];
  game(M, 0); assert.ok(M.S.finished);                  // 4x2
  const N = E.create(cfg({ target: 4 })); N.S.second = 0; N.S.games = [3, 3];
  game(N, 0); assert.ok(!N.S.finished);                 // 4x3 continua
  game(N, 1); assert.ok(N.S.tb);                        // 4x4 -> tie-break
  pts(N, 1, 7); assert.ok(N.S.finished); assert.deepStrictEqual(N.S.games, [4, 5]);
});

test("não aceita ponto com a partida encerrada", () => {
  const M = E.create(cfg()); M.S.second = 0; M.S.games = [5, 0];
  game(M, 0);
  assert.strictEqual(E.addPoint(M, 1), null);
});
