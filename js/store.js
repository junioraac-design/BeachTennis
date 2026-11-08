/* Armazenamento local (localStorage): histórico, atletas, configurações e torneios. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BTStore = factory(root.localStorage);
})(typeof self !== "undefined" ? self : this, function (ls) {
  "use strict";
  const K = { history: "beachtennis:history", athletes: "beachtennis:athletes", settings: "beachtennis:settings", tourneys: "beachtennis:tournaments", brand: "beachtennis:brand", arenas: "beachtennis:arenas" };
  const MAX_ARENAS = 10;
  const DEFAULT_SETTINGS = {
    autoSave: true,        // salvar a partida no histórico ao terminar
    setSize: 6,            // games do set em partidas avulsas (6 = regra oficial)
    sound: false,          // bipes ao marcar ponto
    voice: false,          // placar falado
    hold: false,           // segurar para marcar ponto
    sideAlert: "full",     // "full" = tela cheia, "banner" = faixa discreta
    tvOn: false,           // transmitir o placar para a TV
    tvDb: "",              // endereço do Firebase Realtime Database (opcional)
    tvCode: "",            // código da sala (gerado automaticamente)
    tvApiKey: "",          // chave de API do Firebase (opcional): liga o modo seguro (só este aparelho escreve)
    arenaId: ""            // arena em uso (vazio = padrão)
  };

  function read(key, fallback) {
    try { const v = JSON.parse(ls.getItem(key)); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { ls.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---- histórico de partidas ---- */
  const getHistory = () => read(K.history, []);
  function saveMatch(rec) {                       // grava ou substitui (mesmo id)
    const h = getHistory();
    if (!rec.id) rec.id = newId();
    const i = h.findIndex((m) => m.id === rec.id);
    if (i >= 0) h[i] = rec; else h.unshift(rec);
    return write(K.history, h) ? rec.id : null;
  }
  function deleteMatch(id) { return write(K.history, getHistory().filter((m) => m.id !== id)); }

  /* ---- atletas (nome -> foto), para reaproveitar fotos ---- */
  const getAthletes = () => read(K.athletes, {});
  function rememberAthlete(name, photo) {
    const a = getAthletes();
    a[name] = { photo: photo || (a[name] && a[name].photo) || null };
    return write(K.athletes, a);
  }

  /* ---- configurações ---- */
  const getSettings = () => Object.assign({}, DEFAULT_SETTINGS, read(K.settings, {}));
  function setSettings(patch) { return write(K.settings, Object.assign(getSettings(), patch)); }

  /* ---- arenas cadastradas (nome, logo, paleta) e patrocinador da partida ---- */
  /* O patrocinador não é cadastrado: é escolhido na hora e fica lembrado até ser trocado ou limpo. */
  function touchBrand() {                     // ver muda a cada alteração (a TV só baixa as imagens quando muda)
    const sp = read(K.brand, {});
    return write(K.brand, { sponsor: sp.sponsor || null, sponsorText: sp.sponsorText || "", ver: Date.now() });
  }
  function migrateBrand() {                   // versão antiga guardava nome/logo no "brand": vira a 1ª arena
    const old = read(K.brand, null);
    if (old && (old.name || old.logo) && read(K.arenas, null) === null) {
      const a = { id: newId(), name: old.name || "Minha arena", logo: old.logo || null, palette: null };
      write(K.arenas, [a]);
      write(K.settings, Object.assign(getSettings(), { arenaId: a.id }));
      write(K.brand, { sponsor: old.sponsor || null, sponsorText: old.sponsorText || "", ver: Date.now() });
    }
  }
  const getArenas = () => { migrateBrand(); return read(K.arenas, []); };
  function saveArena(a) {
    const list = getArenas();
    const i = a.id ? list.findIndex((x) => x.id === a.id) : -1;
    if (i < 0 && list.length >= MAX_ARENAS) return { ok: false, reason: `Limite de ${MAX_ARENAS} arenas. Exclua uma para criar outra.` };
    const rec = { id: i >= 0 ? a.id : newId(), name: (a.name || "").trim(), logo: a.logo || null, palette: a.palette || null };
    if (i >= 0) list[i] = rec; else list.push(rec);
    if (!write(K.arenas, list)) return { ok: false, reason: "Sem espaço para salvar (logo muito grande?)." };
    touchBrand();
    return { ok: true, id: rec.id };
  }
  function deleteArena(id) {
    const ok = write(K.arenas, getArenas().filter((a) => a.id !== id));
    if (getSettings().arenaId === id) setSettings({ arenaId: "" });
    touchBrand();
    return ok;
  }
  const getActiveArena = () => { const id = getSettings().arenaId; return getArenas().find((a) => a.id === id) || null; };
  function setActiveArena(id) { setSettings({ arenaId: id || "" }); touchBrand(); }

  /* Identidade em uso agora: arena ativa (nome, logo, paleta) + patrocinador da partida */
  function getBrand() {
    const a = getActiveArena(), sp = read(K.brand, {});
    return { arenaId: a ? a.id : "", name: a ? a.name : "", logo: a ? a.logo : null, palette: a ? a.palette : null,
      sponsor: sp.sponsor || null, sponsorText: sp.sponsorText || "", ver: sp.ver || 0 };
  }
  function setBrand(patch) {                  // só o patrocinador
    const sp = Object.assign({ sponsor: null, sponsorText: "" }, read(K.brand, {}));
    if ("sponsor" in patch) sp.sponsor = patch.sponsor;
    if ("sponsorText" in patch) sp.sponsorText = patch.sponsorText;
    sp.ver = Date.now();
    return write(K.brand, sp) ? getBrand() : null;
  }

  /* ---- torneios ---- */
  const getTourneys = () => read(K.tourneys, []);
  function saveTourney(t) {
    const all = getTourneys();
    if (!t.id) t.id = newId();
    const i = all.findIndex((x) => x.id === t.id);
    if (i >= 0) all[i] = t; else all.unshift(t);
    return write(K.tourneys, all) ? t.id : null;
  }
  function deleteTourney(id) { return write(K.tourneys, getTourneys().filter((t) => t.id !== id)); }

  /* ---- backup ---- */
  function exportAll() {
    return { app: "beachtennis", version: 1, exportedAt: new Date().toISOString(),
      history: getHistory(), athletes: getAthletes(), tournaments: getTourneys(), arenas: getArenas(), settings: read(K.settings, {}) };
  }
  function importAll(data) {                      // mescla por id; nunca apaga o que já existe
    if (!data || data.app !== "beachtennis") return { ok: false, reason: "Arquivo inválido" };
    let added = 0;
    const h = getHistory(), ids = new Set(h.map((m) => m.id));
    (data.history || []).forEach((m) => { if (m && m.id && !ids.has(m.id)) { h.push(m); added++; } });
    h.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const t = getTourneys(), tids = new Set(t.map((x) => x.id));
    (data.tournaments || []).forEach((x) => { if (x && x.id && !tids.has(x.id)) t.push(x); });
    const ar = getArenas(), arIds = new Set(ar.map((x) => x.id));
    (data.arenas || []).forEach((x) => { if (x && x.id && !arIds.has(x.id) && ar.length < MAX_ARENAS) ar.push(x); });
    const a = Object.assign({}, data.athletes || {}, getAthletes());
    const ok = write(K.history, h) && write(K.tourneys, t) && write(K.athletes, a) && write(K.arenas, ar);
    return ok ? { ok: true, added } : { ok: false, reason: "Sem espaço para gravar" };
  }

  return { newId, getHistory, saveMatch, deleteMatch, getAthletes, rememberAthlete, getSettings, setSettings, getBrand, setBrand, getArenas, saveArena, deleteArena, getActiveArena, setActiveArena, MAX_ARENAS,
    getTourneys, saveTourney, deleteTourney, exportAll, importAll, DEFAULT_SETTINGS };
});
