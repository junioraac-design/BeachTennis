/* =====================================================================
 * Paleta de cores por arena (funções puras)
 *
 *  Uma paleta tem 4 cores: bg (fundo), accent (destaque), t1 (Dupla 1) e t2 (Dupla 2).
 *  theme() garante legibilidade (fundo escuro, texto branco legível sobre as duplas,
 *  destaque com contraste) e devolve as variáveis CSS do app.
 *  extract() sugere uma paleta a partir dos pixels do logo.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BTPalette = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DEFAULT = { bg: "#0b1f33", accent: "#f2c879", t1: "#1d9bd1", t2: "#ef6a4c" };
  const PRESETS = [
    { id: "praia", name: "Praia", bg: "#0b1f33", accent: "#f2c879", t1: "#1d9bd1", t2: "#ef6a4c" },
    { id: "noturno", name: "Noturno", bg: "#0d0a1f", accent: "#ffd23f", t1: "#7c4dff", t2: "#00a896" },
    { id: "quadra", name: "Quadra verde", bg: "#0a2418", accent: "#f2e55c", t1: "#1fa35a", t2: "#e8602c" },
    { id: "porsol", name: "Pôr do sol", bg: "#2a0f1f", accent: "#ffb86b", t1: "#d63a7a", t2: "#cc6a1e" },
    { id: "classico", name: "Clássico", bg: "#10151c", accent: "#ffffff", t1: "#2d6cdf", t2: "#d64545" }
  ];

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const isHex = (h) => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) {                       // t = 0 → a, t = 1 → b
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function lum(h) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = hexToRgb(h);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const dist = (a, b) => { const x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [((h * 60) + 360) % 360, s, l];
  }
  function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  /* ---- ajustes de legibilidade ---- */
  function darkBg(h) { let i = 0; while (lum(h) > 0.1 && i++ < 20) h = mix(h, "#000000", 0.12); return h; }
  function teamColor(h) { let i = 0; while (contrast(h, "#ffffff") < 2.8 && i++ < 20) h = mix(h, "#000000", 0.08); return h; }
  function accentColor(h, bg) { let i = 0; while (contrast(h, bg) < 4.5 && i++ < 20) h = mix(h, "#ffffff", 0.1); return h; }

  /* Devolve { vars, warnings, fixed }. `fixed` é a paleta já corrigida. */
  function theme(p) {
    p = p || {};
    const src = {}; for (const k of Object.keys(DEFAULT)) src[k] = isHex(p[k]) ? p[k].toLowerCase() : DEFAULT[k];
    const fixed = { bg: darkBg(src.bg), t1: teamColor(src.t1), t2: teamColor(src.t2) };
    fixed.accent = accentColor(src.accent, fixed.bg);
    const warnings = [];
    if (fixed.bg !== src.bg) warnings.push("O fundo foi escurecido para o texto ficar legível.");
    if (fixed.t1 !== src.t1 || fixed.t2 !== src.t2) warnings.push("Uma cor de dupla foi escurecida para o texto branco ficar legível.");
    if (fixed.accent !== src.accent) warnings.push("A cor de destaque foi clareada para contrastar com o fundo.");
    if (dist(fixed.t1, fixed.t2) < 100) warnings.push("As cores das duas duplas estão muito parecidas. Escolha cores mais diferentes.");
    const vars = {
      "--bg": fixed.bg, "--bg-2": mix(fixed.bg, fixed.t1, 0.14), "--card": mix(fixed.bg, "#ffffff", 0.1),
      "--sand": fixed.accent, "--t1": fixed.t1, "--t1-dark": mix(fixed.t1, "#000000", 0.28),
      "--t2": fixed.t2, "--t2-dark": mix(fixed.t2, "#000000", 0.28),
      "--c1": mix(fixed.t1, "#ffffff", 0.55), "--c2": mix(fixed.t2, "#ffffff", 0.55),
      "--muted": mix(fixed.bg, "#ffffff", 0.62)
    };
    return { vars, warnings, fixed };
  }
  const isDefault = (p) => !p || Object.keys(DEFAULT).every((k) => !p[k] || p[k].toLowerCase() === DEFAULT[k]);

  /* ---- cores a partir do logo ---- */
  /* data: Uint8ClampedArray RGBA (ImageData.data). Devolve uma paleta ou null (logo sem cores marcantes). */
  function extract(data) {
    const B = 12, buckets = Array.from({ length: B }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (s < 0.3 || l < 0.15 || l > 0.88) continue;         // ignora branco, preto e cinza
      const w = s * (1 - Math.abs(2 * l - 1));
      const k = buckets[Math.floor(h / (360 / B)) % B];
      k.w += w; k.r += data[i] * w; k.g += data[i + 1] * w; k.b += data[i + 2] * w;
    }
    const ranked = buckets.map((k, i) => ({ i, w: k.w, hsl: k.w ? rgbToHsl(k.r / k.w, k.g / k.w, k.b / k.w) : null })).filter((k) => k.w > 0).sort((x, y) => y.w - x.w);
    if (!ranked.length) return null;
    const main = ranked[0];
    const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
    const second = ranked.slice(1).find((k) => hueDist(k.hsl[0], main.hsl[0]) >= 45 && k.w >= main.w * 0.12);
    const h1 = main.hsl[0], h2 = second ? second.hsl[0] : (h1 + 180) % 360;   // sem segunda cor: usa a complementar
    const team = (h, hsl) => hslToHex(h, clamp(hsl ? hsl[1] : 0.7, 0.55, 0.9), clamp(hsl ? hsl[2] : 0.46, 0.38, 0.52));
    return {
      bg: hslToHex(h1, 0.55, 0.11),
      accent: hslToHex(h2, 0.85, 0.74),
      t1: team(h1, main.hsl),
      t2: team(h2, second ? second.hsl : null)
    };
  }

  return { DEFAULT, PRESETS, isHex, mix, lum, contrast, dist, theme, isDefault, extract, hslToHex, rgbToHsl };
});
