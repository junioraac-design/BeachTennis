/* Gera a imagem do resultado (PNG) e compartilha ou baixa. */
function loadImg(url) {
  return new Promise((res) => {
    if (!url) return res(null);
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => res(null);
    i.src = url;
  });
}

async function renderShareImage(rec) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const font = (w, px) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const fit = (text, w, px, weight) => { let p = px; x.font = font(weight, p); while (x.measureText(text).width > w && p > 24) { p -= 2; x.font = font(weight, p); } };

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#123150"); g.addColorStop(1, "#0b1f33");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#f2c879"; x.fillRect(0, H - 14, W, 14);
  x.textAlign = "center"; x.textBaseline = "middle";

  x.fillStyle = "#f4f1ea"; x.font = font(800, 56); x.fillText("🎾 BEACH TENNIS", W / 2, 100);
  x.fillStyle = "#9db4c9"; x.font = font(500, 34);
  const date = rec.date ? new Date(rec.date).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }) : "";
  x.fillText(date, W / 2, 165);
  x.font = font(800, 40); x.fillText("🏆 VENCEDORES", W / 2, 260);

  const w = rec.winner;
  const imgs = await Promise.all([0, 1].map((i) => loadImg(rec.photos && rec.photos[w] && rec.photos[w][i])));
  [0, 1].forEach((i, k) => {
    const cx = W / 2 + (k ? 190 : -190), cy = 470, r = 150;
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.closePath(); x.clip();
    if (imgs[i]) x.drawImage(imgs[i], cx - r, cy - r, r * 2, r * 2);
    else { x.fillStyle = "#2a4d73"; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.fillStyle = "#f4f1ea"; x.font = font(900, 130); x.fillText((rec.names[w][i][0] || "?").toUpperCase(), cx, cy + 6); }
    x.restore();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.lineWidth = 12; x.strokeStyle = "#f2c879"; x.stroke();
  });

  x.fillStyle = "#f2c879";
  const wn = `${rec.names[w][0]} E ${rec.names[w][1]}`.toUpperCase();
  fit(wn, 940, 76, 900); x.fillText(wn, W / 2, 700);

  // placar: Dupla 1 (azul) x Dupla 2 (coral)
  x.font = font(900, 230);
  const a = String(rec.games[0]), b = String(rec.games[1]);
  const wa = x.measureText(a).width, wb = x.measureText(b).width;
  x.font = font(700, 120); const wx = x.measureText(" x ").width;
  const total = wa + wx + wb; let px = W / 2 - total / 2;
  x.textAlign = "left";
  x.font = font(900, 230); x.fillStyle = "#7fd3f5"; x.fillText(a, px, 880); px += wa;
  x.font = font(700, 120); x.fillStyle = "#9db4c9"; x.fillText(" x ", px, 880); px += wx;
  x.font = font(900, 230); x.fillStyle = "#ff9c85"; x.fillText(b, px, 880);
  x.textAlign = "center";

  x.font = font(700, 40);
  x.fillStyle = "#7fd3f5"; fit(`${rec.names[0][0]} e ${rec.names[0][1]}`.toUpperCase(), 940, 42, 700); x.fillText(`${rec.names[0][0]} e ${rec.names[0][1]}`.toUpperCase(), W / 2, 1035);
  x.fillStyle = "#9db4c9"; x.font = font(600, 34); x.fillText("contra", W / 2, 1085);
  x.fillStyle = "#ff9c85"; fit(`${rec.names[1][0]} e ${rec.names[1][1]}`.toUpperCase(), 940, 42, 700); x.fillText(`${rec.names[1][0]} e ${rec.names[1][1]}`.toUpperCase(), W / 2, 1135);

  x.fillStyle = "#f4f1ea"; x.font = font(700, 46);
  x.fillText(`⏱ ${fmt(rec.duration)}`, W / 2, 1230);
  if (rec.tbResult) { x.fillStyle = "#f2c879"; x.font = font(700, 40); x.fillText(`TIE-BREAK ${rec.tbResult.score[0]} x ${rec.tbResult.score[1]}`, W / 2, 1290); }
  return c;
}

async function shareRecord(rec) {
  let canvas;
  try { canvas = await renderShareImage(rec); } catch (_) { return toast("Não foi possível gerar a imagem"); }
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return toast("Não foi possível gerar a imagem");
  const file = new File([blob], "placar-beach-tennis.png", { type: "image/png" });
  const text = `🎾 ${joinRec(rec, 0)} ${rec.games[0]} x ${rec.games[1]} ${joinRec(rec, 1)}`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Imagem baixada");
}
