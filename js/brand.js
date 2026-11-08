/* Identidade visual: tema (cores da arena), arena (nome/logo) e patrocinador da partida.
   - O tema vale no celular e na TV.
   - Nome/logo da arena e patrocinador aparecem só na transmissão (TV) e na imagem de compartilhamento. */
let curBrand = BTStore.getBrand();

/* Redimensiona mantendo a proporção; JPEG continua JPEG, o resto vira PNG (preserva transparência) */
function resizeContain(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const iw = img.naturalWidth || img.width || 320, ih = img.naturalHeight || img.height || 320;   // SVG sem tamanho
      const k = Math.min(1, maxW / iw, maxH / ih);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

/* Aplica as cores: paleta nula/padrão remove os ajustes e volta ao visual original */
const THEME_VARS = ["--bg", "--bg-2", "--card", "--sand", "--t1", "--t1-dark", "--t2", "--t2-dark", "--c1", "--c2", "--muted"];
function applyTheme(palette) {
  const root = document.documentElement.style, meta = document.querySelector('meta[name="theme-color"]');
  if (!palette || BTPalette.isDefault(palette)) {
    THEME_VARS.forEach((v) => root.removeProperty(v));
    if (meta) meta.setAttribute("content", BTPalette.DEFAULT.bg);
    return;
  }
  const t = BTPalette.theme(palette);
  Object.keys(t.vars).forEach((k) => root.setProperty(k, t.vars[k]));
  if (meta) meta.setAttribute("content", t.fixed.bg);
}

/* Mostra (ou esconde) arena e patrocinador (o CSS só os exibe na TV) e aplica as cores */
function applyBrand(b) {
  curBrand = b || BTStore.getBrand();
  applyTheme(curBrand.palette);
  const hasArena = !!(curBrand.name || curBrand.logo);
  document.querySelectorAll(".arena").forEach((el) => {
    el.hidden = !hasArena;
    const logo = el.querySelector(".a-logo"), name = el.querySelector(".a-name");
    logo.hidden = !curBrand.logo; if (curBrand.logo) logo.src = curBrand.logo; else logo.removeAttribute("src");
    name.textContent = curBrand.name || "";
  });
  const hasSp = !!(curBrand.sponsor || curBrand.sponsorText);
  document.querySelectorAll(".sponsor").forEach((el) => {
    el.hidden = !hasSp;
    const img = el.querySelector(".s-img"), txt = el.querySelector(".s-txt");
    img.hidden = !curBrand.sponsor; if (curBrand.sponsor) img.src = curBrand.sponsor; else img.removeAttribute("src");
    txt.textContent = curBrand.sponsorText || "";
  });
  const lbl = $("sponsor-label");
  if (lbl) lbl.textContent = curBrand.sponsorText || (curBrand.sponsor ? "imagem escolhida" : "nenhum");
}

/* ---------- Patrocinador da partida (sem cadastro) ---------- */
function refreshSponsorDialog() {
  const b = BTStore.getBrand();
  $("s-sponsor-txt").value = b.sponsorText;
  $("s-sponsor-prev").hidden = !b.sponsor; if (b.sponsor) $("s-sponsor-prev").src = b.sponsor;
  $("s-sponsor-del").hidden = !(b.sponsor || b.sponsorText);
}
function saveSponsor(patch) {
  const b = BTStore.setBrand(patch);
  if (!b) { toast("Sem espaço para salvar a imagem. Use uma imagem menor."); return; }
  applyBrand(b); refreshSponsorDialog();
  if (typeof syncPush === "function") syncPush();
}
$("sponsor-open").addEventListener("click", () => { refreshSponsorDialog(); $("dlg-sponsor").showModal(); });
$("sponsor-close").addEventListener("click", () => $("dlg-sponsor").close());
$("s-sponsor-txt").addEventListener("change", (e) => saveSponsor({ sponsorText: e.target.value.trim() }));
$("s-sponsor-btn").addEventListener("click", () => $("file-sponsor").click());
$("s-sponsor-file").addEventListener("click", () => $("file-sponsor-f").click());
$("s-sponsor-del").addEventListener("click", () => saveSponsor({ sponsor: null, sponsorText: "" }));
["file-sponsor", "file-sponsor-f"].forEach((id) => $(id).addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { saveSponsor({ sponsor: await resizeContain(f, 960, 320) }); } catch (_) { toast("Não foi possível ler a imagem"); }
}));

applyBrand(curBrand);
