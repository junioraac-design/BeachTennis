const test = require("node:test");
const assert = require("node:assert");
const P = require("../js/palette.js");

const px = (list) => { const a = []; for (const [rgb, n] of list) for (let i = 0; i < n; i++) a.push(...rgb, 255); return Uint8ClampedArray.from(a); };

test("paleta padrão já é legível e não gera avisos", () => {
  const t = P.theme(P.DEFAULT);
  assert.deepStrictEqual(t.warnings, []);
  assert.deepStrictEqual(t.fixed, P.DEFAULT);
  assert.ok(t.vars["--t1-dark"] && t.vars["--c1"]);
});

test("as paletas prontas são todas legíveis", () => {
  for (const p of P.PRESETS) {
    const t = P.theme(p);
    assert.deepStrictEqual(t.warnings, [], p.name);
    assert.ok(P.contrast("#ffffff", t.fixed.t1) >= 2.8 && P.contrast("#ffffff", t.fixed.t2) >= 2.8, p.name);
    assert.ok(P.contrast(t.fixed.accent, t.fixed.bg) >= 4.5, p.name);
  }
});

test("fundo claro é escurecido e a dupla muito clara é escurecida", () => {
  const t = P.theme({ bg: "#ffffff", accent: "#222222", t1: "#ffee88", t2: "#ef6a4c" });
  assert.ok(P.lum(t.fixed.bg) <= 0.1);
  assert.ok(P.contrast("#ffffff", t.fixed.t1) >= 2.8);
  assert.ok(P.contrast(t.fixed.accent, t.fixed.bg) >= 4.5);
  assert.ok(t.warnings.length >= 2);
});

test("avisa quando as duas duplas têm cores parecidas", () => {
  const t = P.theme({ t1: "#1d9bd1", t2: "#2090d0" });
  assert.ok(t.warnings.some((w) => /parecidas/.test(w)));
});

test("cor inválida cai no padrão", () => {
  assert.strictEqual(P.theme({ t1: "azul" }).fixed.t1, P.DEFAULT.t1);
  assert.ok(P.isDefault(null) && P.isDefault({ t1: "#1D9BD1" }) && !P.isDefault({ t1: "#ff0000" }));
});

test("logo azul e laranja → duplas azul e laranja", () => {
  const p = P.extract(px([[[30, 120, 200], 600], [[230, 120, 40], 300], [[255, 255, 255], 800], [[0, 0, 0], 200]]));
  const [h1] = P.rgbToHsl(...[1, 3, 5].map((i) => parseInt(p.t1.slice(i, i + 2), 16)));
  const [h2] = P.rgbToHsl(...[1, 3, 5].map((i) => parseInt(p.t2.slice(i, i + 2), 16)));
  assert.ok(h1 > 190 && h1 < 235, `t1 hue ${h1}`);
  assert.ok(h2 > 10 && h2 < 45, `t2 hue ${h2}`);
  assert.ok(P.theme(p).warnings.length === 0, JSON.stringify(P.theme(p).warnings));
});

test("logo de uma cor só ganha a complementar; logo cinza devolve nulo", () => {
  const p = P.extract(px([[[30, 160, 80], 500], [[255, 255, 255], 500]]));
  const [h1] = P.rgbToHsl(...[1, 3, 5].map((i) => parseInt(p.t1.slice(i, i + 2), 16)));
  const [h2] = P.rgbToHsl(...[1, 3, 5].map((i) => parseInt(p.t2.slice(i, i + 2), 16)));
  const d = Math.abs(h1 - h2); assert.ok(Math.min(d, 360 - d) > 120, `${h1} / ${h2}`);
  assert.strictEqual(P.extract(px([[[128, 128, 128], 400], [[255, 255, 255], 400]])), null);
  assert.strictEqual(P.extract(Uint8ClampedArray.from([10, 10, 10, 0])), null);   // transparente
});
