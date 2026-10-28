import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LocalStore } from "../src/store.js";
import { criarExecutor } from "../src/tools.js";
import { responder } from "../src/agent.js";

const seed = JSON.parse(fs.readFileSync(new URL("../dados/planilha-teste.json", import.meta.url)));
const novo = () => Object.assign(new LocalStore(null), { data: structuredClone(seed) });

test("preço vem da planilha e só mostra produtos do cliente + gerais", () => {
  const s = novo();
  const ex = criarExecutor({ store: s, telefone: "5511999990001" });
  const nomes = ex("consultar_produtos", { busca: "rotulo" }).produtos.map((p) => p.produto);
  assert.deepEqual(nomes, ["RÓTULO DOCES DA CAROL"]);
  const anon = criarExecutor({ store: s, telefone: "5511000000000" });
  assert.equal(anon("consultar_produtos", { busca: "rotulo" }).produtos.length, 0);
});

test("pedido sem confirmação não grava", () => {
  const s = novo();
  const ex = criarExecutor({ store: s, telefone: "5511000000000" });
  const r = ex("registrar_pedido", { itens: [{ id_produto: 1, quantidade: 10 }], cliente_confirmou: false });
  assert.ok(r.erro);
  assert.equal(s.getRows("Pedidos").length, 0);
});

test("pedido confirmado grava em maiúsculo, total da planilha, cria cliente novo", () => {
  const s = novo();
  const avisos = [];
  const ex = criarExecutor({ store: s, telefone: "+55 11 90000-0000", avisarJunior: (m) => avisos.push(m) });
  const r = ex("registrar_pedido", { itens: [{ id_produto: 1, quantidade: 10 }, { id_produto: 4, quantidade: 3 }], nome_cliente: "maria", observacoes: "retira hoje", cliente_confirmou: true });
  assert.equal(r.total, 34);
  assert.equal(s.getRows("Pedidos")[0].Cliente, "MARIA");
  assert.equal(s.getRows("Pedidos")[0].Observações, "PEDIDO PELO WHATSAPP. RETIRA HOJE");
  assert.equal(s.getRows("ItensPedido").length, 2);
  assert.equal(avisos.length, 1);
});

test("produto de outro cliente é recusado", () => {
  const s = novo();
  const ex = criarExecutor({ store: s, telefone: "5511000000000" });
  assert.ok(ex("registrar_pedido", { itens: [{ id_produto: 5, quantidade: 1 }], cliente_confirmou: true }).erro);
});

test("se a API falhar, o cliente recebe resposta e o Junior é avisado", async () => {
  const avisos = [];
  const client = { beta: { messages: { create: async () => { throw new Error("rede caiu"); } } } };
  const r = await responder({ historico: [], textoCliente: "oi", store: novo(), telefone: "1", avisarJunior: (m) => avisos.push(m), client });
  assert.match(r, /Junior/);
  assert.match(avisos[0], /FALHA/);
});

test("loop de ferramentas: pede ferramenta, recebe resultado, responde", async () => {
  const respostas = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "consultar_produtos", input: { busca: "foto" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Foto 10x15 sai R$ 2,50." }] },
  ];
  const client = { beta: { messages: { create: async () => respostas.shift() } } };
  const historico = [];
  const r = await responder({ historico, textoCliente: "quanto a foto?", store: novo(), telefone: "5511000000000", client });
  assert.equal(r, "Foto 10x15 sai R$ 2,50.");
  assert.equal(historico.at(-2).content[0].type, "tool_result");
});
