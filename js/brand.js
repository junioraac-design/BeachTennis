/* Arena e patrocinador: nome, logo e imagem do patrocinador no placar, na tela final, no cadastro,
   na imagem de compartilhamento e na TV. */
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

/* Mostra (ou esconde) a arena e o patrocinador em todos os lugares da tela */
function applyBrand(b) {
  curBrand = b || BTStore.getBrand();
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
}

/* ---------- Configurações ---------- */
function refreshBrandSettings() {
  const b = BTStore.getBrand();
  $("s-arena").value = b.name; $("s-sponsor-txt").value = b.sponsorText;
  for (const [prev, del, src] of [["s-logo-prev", "s-logo-del", b.logo], ["s-sponsor-prev", "s-sponsor-del", b.sponsor]]) {
    $(prev).hidden = !src; $(del).hidden = !src; if (src) $(prev).src = src;
  }
}
function saveBrand(patch) {
  const b = BTStore.setBrand(patch);
  if (!b) { toast("Sem espaço para salvar a imagem. Use uma imagem menor."); return; }
  applyBrand(b); refreshBrandSettings();
  if (typeof syncPush === "function") syncPush();
}
$("s-arena").addEventListener("change", (e) => saveBrand({ name: e.target.value.trim() }));
$("s-sponsor-txt").addEventListener("change", (e) => saveBrand({ sponsorText: e.target.value.trim() }));
$("s-logo-btn").addEventListener("click", () => $("file-logo").click());
$("s-sponsor-btn").addEventListener("click", () => $("file-sponsor").click());
$("s-logo-del").addEventListener("click", () => saveBrand({ logo: null }));
$("s-sponsor-del").addEventListener("click", () => saveBrand({ sponsor: null }));
async function pickImage(input, key, maxW, maxH) {
  const f = input.files[0]; input.value = "";
  if (!f) return;
  try { saveBrand({ [key]: await resizeContain(f, maxW, maxH) }); } catch (_) { toast("Não foi possível ler a imagem"); }
}
$("s-logo-file").addEventListener("click", () => $("file-logo-f").click());
$("s-sponsor-file").addEventListener("click", () => $("file-sponsor-f").click());
["file-logo", "file-logo-f"].forEach((id) => $(id).addEventListener("change", (e) => pickImage(e.target, "logo", 480, 480)));
["file-sponsor", "file-sponsor-f"].forEach((id) => $(id).addEventListener("change", (e) => pickImage(e.target, "sponsor", 960, 320)));
$("btn-settings").addEventListener("click", refreshBrandSettings);
$("btn-set").addEventListener("click", refreshBrandSettings);

applyBrand(curBrand);
