/* Configurações: som, voz, segurar para marcar ponto, aviso de troca de lado, tamanho do set. */
const HOLD_MS = 500;
const cfgNow = () => BTStore.getSettings();

/* ---------- Diálogo ---------- */
function openSettings() {
  const c = cfgNow();
  $("s-autosave").checked = c.autoSave; $("s-sound").checked = c.sound;
  $("s-voice").checked = c.voice; $("s-hold").checked = c.hold;
  document.querySelector(`input[name="sidealert"][value="${c.sideAlert}"]`).checked = true;
  document.querySelector(`input[name="setsize"][value="${c.setSize}"]`).checked = true;
  $("dlg-settings").showModal();
}
const bindSetting = (id, key) => $(id).addEventListener("change", (e) => {
  BTStore.setSettings({ [key]: e.target.checked });
  if (key === "sound" && e.target.checked) beep(880, 90);
  if (key === "voice" && e.target.checked) speak("Narração ativada");
  if (key === "hold") applyHoldLabel();
});
bindSetting("s-autosave", "autoSave"); bindSetting("s-sound", "sound"); bindSetting("s-voice", "voice"); bindSetting("s-hold", "hold");
document.querySelectorAll('input[name="sidealert"]').forEach((r) => r.addEventListener("change", (e) => BTStore.setSettings({ sideAlert: e.target.value })));
document.querySelectorAll('input[name="setsize"]').forEach((r) => r.addEventListener("change", (e) => BTStore.setSettings({ setSize: +e.target.value })));
$("btn-settings").addEventListener("click", openSettings);
$("btn-set").addEventListener("click", openSettings);
$("set-close").addEventListener("click", () => $("dlg-settings").close());

/* ---------- Som ---------- */
let audioCtx = null;
function beep(freq, ms, when = 0, type = "sine", vol = 0.18) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + when / 1000;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + ms / 1000);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
  } catch (_) {}
}
function playSound(info) {
  if (info && info.finished) { [523, 659, 784, 1047].forEach((f, i) => beep(f, 220, i * 160)); return; }
  if (info && (info.side || info.tb)) { beep(440, 160); beep(330, 260, 190); return; }
  if (info && info.game) { beep(660, 120); beep(880, 200, 140); return; }
  beep(700, 70);
}

/* ---------- Voz ---------- */
const WORDS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze"];
const num = (n) => (n < WORDS.length ? WORDS[n] : String(n));
const ptWord = (p) => ["zero", "quinze", "trinta", "quarenta"][Math.min(p, 3)];
const nice = (n) => n.charAt(0) + n.slice(1).toLowerCase();

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR"; u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (_) {}
}
const teamLabel = (t) => `${nice(S.names[t][0])} e ${nice(S.names[t][1])}`;

function narrate(info) {
  if (S.finished) {
    const w = S.winner;
    return `Fim de jogo. Vencedores: ${teamLabel(w)}, ${num(S.games[w])} a ${num(S.games[other(w)])}.`;
  }
  const parts = [];
  if (info && info.game) {
    const last = S.log[S.log.length - 1];
    parts.push(`Game para ${teamLabel(last.winner)}.`, `${num(S.games[last.winner])} a ${num(S.games[other(last.winner)])}.`);
  }
  if (info && info.tb) parts.push("Tie-break.");
  else if (!info || !info.game) {
    // placar do game em andamento, com o saque na frente
    const [st] = currentServer(), rc = other(st);
    if (S.tb) parts.push(`${num(S.tbPts[st])} a ${num(S.tbPts[rc])}.`);
    else if (S.points[0] === 3 && S.points[1] === 3) parts.push("Ponto de ouro.");
    else parts.push(`${ptWord(S.points[st])} a ${ptWord(S.points[rc])}.`);
  }
  if (info && info.side) parts.push("Troca de lado.");
  return parts.join(" ");
}

/* Chamado pelo app após cada ponto marcado */
function announce(info) {
  const c = cfgNow();
  if (c.sound) playSound(info);
  if (c.voice) speak(narrate(info));
}

/* ---------- Aviso de troca de lado ---------- */
function sideNotice(text) {
  if (cfgNow().sideAlert === "banner") toast("🔄 TROCA DE LADO · " + text, 5000);
  else showAlert(text + " — nomes e placar trocam de lado");
}

/* ---------- Segurar para marcar ponto ---------- */
function applyHoldLabel() {
  const hold = cfgNow().hold;
  [0, 1].forEach((t) => { $("pt-btn-" + t).textContent = hold ? "SEGURE P/ PONTO" : "+ PONTO"; });
}
(function holdToScore() {
  [0, 1].forEach((t) => {
    const b = $("pt-btn-" + t);
    let timer = null, fired = false;
    const cancel = () => { clearTimeout(timer); timer = null; b.classList.remove("holding"); };
    b.style.setProperty("--hold", HOLD_MS + "ms");
    b.addEventListener("pointerdown", () => {
      if (!cfgNow().hold) return;
      fired = false; b.classList.remove("holding"); void b.offsetWidth; b.classList.add("holding");
      timer = setTimeout(() => { fired = true; cancel(); if (navigator.vibrate) navigator.vibrate(30); addPoint(t); }, HOLD_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, cancel));
    b.addEventListener("contextmenu", (e) => { if (cfgNow().hold) e.preventDefault(); });
    b.addEventListener("click", (e) => { if (cfgNow().hold) { e.stopImmediatePropagation(); if (!fired) toast("Segure o botão para marcar o ponto"); fired = false; } }, true);
  });
  applyHoldLabel();
})();
