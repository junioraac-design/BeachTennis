/* Arenas: seletor na tela inicial, lista (até 10) e editor com logo e paleta de cores. */
let editing = null;          // arena em edição { id, name, logo, palette }
const PAL_KEYS = ["bg", "accent", "t1", "t2"];
const palOf = (a) => Object.assign({}, BTPalette.DEFAULT, a && a.palette);

/* ---------- Seletor na tela inicial ---------- */
function refreshArenaSelect() {
  const sel = $("arena-select"), arenas = BTStore.getArenas();
  sel.textContent = "";
  const add = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); };
  add("", "Sem arena (padrão)");
  arenas.forEach((a) => add(a.id, a.name));
  add("__new", "＋ Nova arena…");
  const cur = BTStore.getSettings().arenaId;
  sel.value = arenas.some((a) => a.id === cur) ? cur : "";
}
function useArena(id) {
  BTStore.setActiveArena(id);
  applyBrand(); refreshArenaSelect();
  if (typeof syncPush === "function") syncPush();
}
$("arena-select").addEventListener("change", (e) => {
  if (e.target.value === "__new") { refreshArenaSelect(); openArenaEditor(null); return; }
  useArena(e.target.value);
});
$("arena-manage").addEventListener("click", openArenaList);
$("set-arenas").addEventListener("click", () => { $("dlg-settings").close(); openArenaList(); });

/* ---------- Lista ---------- */
function openArenaList() {
  const box = $("arena-list"), arenas = BTStore.getArenas(), cur = BTStore.getSettings().arenaId;
  box.textContent = "";
  if (!arenas.length) { const d = document.createElement("div"); d.className = "empty"; d.textContent = "Nenhuma arena cadastrada. Crie a primeira."; box.appendChild(d); }
  arenas.forEach((a) => {
    const row = document.createElement("div"); row.className = "arena-item";
    const use = document.createElement("button"); use.type = "button"; use.className = "use" + (a.id === cur ? " on" : "");
    const th = document.createElement("div"); th.className = "thumb"; if (a.logo) th.style.backgroundImage = `url("${a.logo}")`; else th.textContent = "🏟";
    const mid = document.createElement("div"); mid.style.minWidth = 0;
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = a.name + (a.id === cur ? "  ✔ em uso" : "");
    const sw = document.createElement("div"); sw.className = "sw4";
    const p = palOf(a); PAL_KEYS.forEach((k) => { const i = document.createElement("i"); i.style.background = p[k]; sw.appendChild(i); });
    mid.append(nm, sw); use.append(th, mid);
    use.addEventListener("click", () => { useArena(a.id); $("dlg-arenas").close(); toast(`Arena: ${a.name}`); });
    const ed = document.createElement("button"); ed.type = "button"; ed.className = "ed"; ed.textContent = "✏"; ed.setAttribute("aria-label", `Editar ${a.name}`);
    ed.addEventListener("click", () => { $("dlg-arenas").close(); openArenaEditor(a.id); });
    row.append(use, ed); box.appendChild(row);
  });
  $("arena-new").textContent = `＋ Nova arena (${arenas.length}/${BTStore.MAX_ARENAS})`;
  $("arena-new").disabled = arenas.length >= BTStore.MAX_ARENAS;
  $("dlg-arenas").showModal();
}
$("arena-new").addEventListener("click", () => { $("dlg-arenas").close(); openArenaEditor(null); });
$("arenas-close").addEventListener("click", () => $("dlg-arenas").close());

/* ---------- Editor ---------- */
function openArenaEditor(id) {
  const a = id ? BTStore.getArenas().find((x) => x.id === id) : null;
  editing = { id: a ? a.id : null, name: a ? a.name : "", logo: a ? a.logo : null, palette: palOf(a) };
  $("ae-title").textContent = a ? "Editar arena" : "Nova arena";
  $("ae-name").value = editing.name;
  $("ae-delete").hidden = !a;
  buildPresets(); syncEditor(); $("dlg-arena").showModal();
}
function buildPresets() {
  const box = $("ae-presets"); box.textContent = "";
  BTPalette.PRESETS.forEach((p) => {
    const b = document.createElement("button"); b.type = "button";
    const i = document.createElement("i");
    [p.t1, p.t2].forEach((c) => { const s = document.createElement("b"); s.style.background = c; i.appendChild(s); });
    b.append(i, document.createTextNode(p.name));
    b.addEventListener("click", () => { editing.palette = { bg: p.bg, accent: p.accent, t1: p.t1, t2: p.t2 }; syncEditor(); });
    box.appendChild(b);
  });
}
/* Atualiza campos, prévia (aplicando o tema na hora) e avisos */
function syncEditor(keepInputs) {
  PAL_KEYS.forEach((k) => { if (!keepInputs) $("ae-" + k).value = editing.palette[k]; });
  const logo = $("ae-logo-prev"); logo.hidden = !editing.logo; if (editing.logo) logo.src = editing.logo;
  $("ae-logo-del").hidden = !editing.logo;
  const t = BTPalette.theme(editing.palette);
  applyTheme(editing.palette);                       // a prévia é o próprio app com as cores novas
  $("ae-warn").textContent = t.warnings.join(" ");
}
PAL_KEYS.forEach((k) => $("ae-" + k).addEventListener("input", (e) => { editing.palette[k] = e.target.value; syncEditor(true); }));
$("ae-name").addEventListener("input", (e) => { editing.name = e.target.value; });
$("ae-logo-btn").addEventListener("click", () => $("file-logo").click());
$("ae-logo-file").addEventListener("click", () => $("file-logo-f").click());
$("ae-logo-del").addEventListener("click", () => { editing.logo = null; syncEditor(true); });
["file-logo", "file-logo-f"].forEach((id) => $(id).addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f || !editing) return;
  try { editing.logo = await resizeContain(f, 480, 480); syncEditor(true); toast("Logo carregado. Toque em ✨ para usar as cores dele."); }
  catch (_) { toast("Não foi possível ler a imagem"); }
}));

/* ✨ Cores do logo */
function pixelsOf(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"), n = 64, k = Math.min(n / img.width, n / img.height);
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
      resolve(x.getImageData(0, 0, c.width, c.height).data);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
$("ae-fromlogo").addEventListener("click", async () => {
  if (!editing.logo) return toast("Escolha o logo da arena primeiro.");
  const data = await pixelsOf(editing.logo);
  const pal = data && BTPalette.extract(data);
  if (!pal) return toast("O logo não tem cores marcantes. Use uma paleta pronta ou ajuste à mão.");
  editing.palette = pal; syncEditor(); toast("Cores do logo aplicadas. Ajuste se quiser.");
});

/* Salvar / excluir / cancelar */
function closeEditor() { editing = null; $("dlg-arena").close(); applyBrand(); }   // volta ao tema da arena em uso
$("ae-cancel").addEventListener("click", closeEditor);
$("dlg-arena").addEventListener("cancel", () => { editing = null; setTimeout(applyBrand, 0); });
$("ae-save").addEventListener("click", () => {
  const name = editing.name.trim();
  if (!name) return toast("Dê um nome à arena.");
  const fixed = BTPalette.theme(editing.palette).fixed;
  const palette = BTPalette.isDefault(fixed) ? null : fixed;
  const r = BTStore.saveArena({ id: editing.id, name, logo: editing.logo, palette });
  if (!r.ok) return toast(r.reason);
  const isNew = !editing.id;
  if (isNew || BTStore.getSettings().arenaId === r.id) BTStore.setActiveArena(r.id);
  editing = null; $("dlg-arena").close();
  applyBrand(); refreshArenaSelect();
  if (typeof syncPush === "function") syncPush();
  toast(isNew ? `Arena “${name}” criada e em uso` : "Arena salva");
});
$("ae-delete").addEventListener("click", () => {
  const id = editing.id, nm = editing.name;
  confirmDialog("Excluir arena?", `“${nm}” será removida (o histórico das partidas continua).`, "Excluir", () => {
    BTStore.deleteArena(id); editing = null; $("dlg-arena").close();
    applyBrand(); refreshArenaSelect();
    if (typeof syncPush === "function") syncPush();
  });
});

refreshArenaSelect();
