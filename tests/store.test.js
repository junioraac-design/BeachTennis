const test = require("node:test");
const assert = require("node:assert");
const makeStore = require("../js/store.js");

const fakeLS = () => { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => delete d[k] }; };
const rec = (id, date) => ({ id, date, names: [["A", "B"], ["C", "D"]], winner: 0, games: [6, 2], log: [] });

test("salva, substitui pelo id e exclui partidas", () => {
  const S = makeStore(fakeLS());
  const id = S.saveMatch(rec("m1", "2026-01-01"));
  assert.strictEqual(id, "m1");
  S.saveMatch(Object.assign(rec("m1", "2026-01-01"), { games: [7, 5] }));
  assert.strictEqual(S.getHistory().length, 1);
  assert.deepStrictEqual(S.getHistory()[0].games, [7, 5]);
  S.saveMatch(rec("m2", "2026-01-02"));
  assert.strictEqual(S.getHistory()[0].id, "m2");        // mais recente primeiro
  S.deleteMatch("m1");
  assert.deepStrictEqual(S.getHistory().map((m) => m.id), ["m2"]);
});

test("atletas guardam a foto e não perdem a anterior", () => {
  const S = makeStore(fakeLS());
  S.rememberAthlete("ANA", "data:x");
  S.rememberAthlete("ANA", null);
  assert.strictEqual(S.getAthletes().ANA.photo, "data:x");
});

test("configurações têm padrões e aceitam alterações parciais", () => {
  const S = makeStore(fakeLS());
  assert.strictEqual(S.getSettings().setSize, 6);
  S.setSettings({ sound: true });
  assert.strictEqual(S.getSettings().sound, true);
  assert.strictEqual(S.getSettings().setSize, 6);
});

test("backup: exporta e importa sem duplicar nem apagar", () => {
  const A = makeStore(fakeLS()), B = makeStore(fakeLS());
  A.saveMatch(rec("m1", "2026-01-01")); A.saveMatch(rec("m2", "2026-01-02"));
  B.saveMatch(rec("m2", "2026-01-02")); B.saveMatch(rec("m3", "2026-01-03"));
  const r = B.importAll(JSON.parse(JSON.stringify(A.exportAll())));
  assert.ok(r.ok); assert.strictEqual(r.added, 1);
  assert.deepStrictEqual(B.getHistory().map((m) => m.id).sort(), ["m1", "m2", "m3"]);
  assert.strictEqual(B.importAll({ foo: 1 }).ok, false);
});

test("falha de gravação é reportada (armazenamento cheio)", () => {
  const ls = fakeLS(); ls.setItem = () => { throw new Error("quota"); };
  const S = makeStore(ls);
  assert.strictEqual(S.saveMatch(rec("m1", "2026-01-01")), null);
});
