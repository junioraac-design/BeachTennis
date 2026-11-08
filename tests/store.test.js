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

test("arenas: cadastra, edita, ativa, exclui e respeita o limite de 10", () => {
  const S = makeStore(fakeLS());
  assert.deepStrictEqual(S.getArenas(), []);
  const r = S.saveArena({ name: "Arena Sol", logo: "data:x", palette: { t1: "#ff0000" } });
  assert.ok(r.ok);
  assert.strictEqual(S.getBrand().name, "");                      // salvar não ativa sozinho
  S.setActiveArena(r.id);
  assert.deepStrictEqual([S.getBrand().name, S.getBrand().logo, S.getBrand().palette.t1], ["Arena Sol", "data:x", "#ff0000"]);
  S.saveArena({ id: r.id, name: "Arena Sol 2", logo: null, palette: null });   // edição mantém o id
  assert.strictEqual(S.getArenas().length, 1);
  assert.strictEqual(S.getBrand().name, "Arena Sol 2");
  for (let i = 0; i < 9; i++) assert.ok(S.saveArena({ name: "A" + i }).ok);
  assert.strictEqual(S.getArenas().length, 10);
  const full = S.saveArena({ name: "11ª" });
  assert.strictEqual(full.ok, false); assert.match(full.reason, /10/);
  S.deleteArena(r.id);                                            // excluir a ativa volta ao padrão
  assert.strictEqual(S.getBrand().name, ""); assert.strictEqual(S.getArenas().length, 9);
  assert.ok(S.saveArena({ name: "agora cabe" }).ok);
});

test("patrocinador não é cadastro: fica lembrado e a versão muda a cada troca", async () => {
  const S = makeStore(fakeLS());
  const a = S.setBrand({ sponsorText: "Loja Praia", sponsor: "data:y" });
  await new Promise((r) => setTimeout(r, 3));
  const id = S.saveArena({ name: "Arena" }).id; S.setActiveArena(id);
  assert.strictEqual(S.getBrand().sponsorText, "Loja Praia");   // trocar de arena não apaga o patrocinador
  assert.ok(S.getBrand().ver > a.ver);
  S.setBrand({ sponsor: null, sponsorText: "" });
  assert.deepStrictEqual([S.getBrand().sponsor, S.getBrand().sponsorText], [null, ""]);
});

test("migração: nome e logo da versão anterior viram a primeira arena", () => {
  const ls = fakeLS();
  ls.setItem("beachtennis:brand", JSON.stringify({ name: "ARENA SOL", logo: "data:l", sponsor: "data:s", sponsorText: "Loja", ver: 5 }));
  const S = makeStore(ls);
  assert.strictEqual(S.getArenas().length, 1);
  assert.deepStrictEqual([S.getBrand().name, S.getBrand().logo, S.getBrand().sponsorText], ["ARENA SOL", "data:l", "Loja"]);
  assert.strictEqual(S.getArenas().length, 1);                  // não migra duas vezes
});

test("backup leva as arenas e importa sem duplicar", () => {
  const A = makeStore(fakeLS()), B = makeStore(fakeLS());
  A.saveArena({ name: "Arena A", palette: { t1: "#00ff00" } });
  B.saveArena({ name: "Arena B" });
  const r = B.importAll(JSON.parse(JSON.stringify(A.exportAll())));
  assert.ok(r.ok);
  assert.deepStrictEqual(B.getArenas().map((x) => x.name).sort(), ["Arena A", "Arena B"]);
  B.importAll(JSON.parse(JSON.stringify(A.exportAll())));
  assert.strictEqual(B.getArenas().length, 2);
});
