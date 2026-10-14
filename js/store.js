/* Armazenamento local (localStorage): histórico, atletas, configurações e torneios. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BTStore = factory(root.localStorage);
})(typeof self !== "undefined" ? self : this, function (ls) {
  "use strict";
  const K = { history: "beachtennis:history", athletes: "beachtennis:athletes", settings: "beachtennis:settings", tourneys: "beachtennis:tournaments" };
  const DEFAULT_SETTINGS = {
    autoSave: true,        // salvar a partida no histórico ao terminar
    setSize: 6,            // games do set em partidas avulsas (6 = regra oficial)
    sound: false,          // bipes ao marcar ponto
    voice: false,          // placar falado
    hold: false,           // segurar para marcar ponto
    sideAlert: "full",     // "full" = tela cheia, "banner" = faixa discreta
    tvOn: false,           // transmitir o placar para a TV
    tvDb: "",              // endereço do Firebase Realtime Database (opcional)
    tvCode: ""             // código da sala (gerado automaticamente)
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
      history: getHistory(), athletes: getAthletes(), tournaments: getTourneys(), settings: read(K.settings, {}) };
  }
  function importAll(data) {                      // mescla por id; nunca apaga o que já existe
    if (!data || data.app !== "beachtennis") return { ok: false, reason: "Arquivo inválido" };
    let added = 0;
    const h = getHistory(), ids = new Set(h.map((m) => m.id));
    (data.history || []).forEach((m) => { if (m && m.id && !ids.has(m.id)) { h.push(m); added++; } });
    h.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const t = getTourneys(), tids = new Set(t.map((x) => x.id));
    (data.tournaments || []).forEach((x) => { if (x && x.id && !tids.has(x.id)) t.push(x); });
    const a = Object.assign({}, data.athletes || {}, getAthletes());
    const ok = write(K.history, h) && write(K.tourneys, t) && write(K.athletes, a);
    return ok ? { ok: true, added } : { ok: false, reason: "Sem espaço para gravar" };
  }

  return { newId, getHistory, saveMatch, deleteMatch, getAthletes, rememberAthlete, getSettings, setSettings,
    getTourneys, saveTourney, deleteTourney, exportAll, importAll, DEFAULT_SETTINGS };
});
