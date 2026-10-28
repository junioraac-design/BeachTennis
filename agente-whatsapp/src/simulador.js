// Conversa de teste no terminal: você digita como se fosse o cliente.
// Uso: node src/simulador.js [telefone]      (digite "sair" para encerrar)
import readline from "node:readline/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalStore } from "./store.js";
import { responder } from "./agent.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
// Trabalha numa cópia (sessao.json) para nunca sujar o modelo planilha-teste.json. Apague sessao.json para recomeçar.
const modelo = path.join(aqui, "../dados/planilha-teste.json");
const copia = path.join(aqui, "../dados/sessao.json");
if (!fs.existsSync(copia)) fs.copyFileSync(modelo, copia);
const store = new LocalStore(copia);
const telefone = process.argv[2] ?? "5511988887777";
const historico = [];
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log(`Simulador — você é o cliente ${telefone}. Digite "sair" para encerrar.\n`);
while (true) {
  const texto = (await rl.question("Cliente: ")).trim();
  if (!texto) continue;
  if (texto.toLowerCase() === "sair") break;
  const r = await responder({ historico, textoCliente: texto, store, telefone, avisarJunior: (m) => console.log(`   [AVISO PARA O JUNIOR] ${m}`) });
  console.log(`\nAgente: ${r}\n`);
}
rl.close();
