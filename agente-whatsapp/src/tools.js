import { nextId } from "./store.js";

const up = (s) => String(s ?? "").toUpperCase().trim();
const semAcento = (s) => up(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");

// Definições que o Claude enxerga. O Claude só pede; quem executa é o código abaixo.
export const toolDefs = [
  {
    name: "consultar_produtos",
    description:
      "Lista os produtos e preços que podem ser vendidos a este cliente (preços do próprio cliente, mais os gerais do CONSUMIDOR FINAL). Use sempre antes de informar qualquer preço.",
    input_schema: {
      type: "object",
      properties: { busca: { type: "string", description: "Texto para filtrar, ex.: 'foto 10x15'. Vazio lista tudo." } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_pedido",
    description:
      "Grava o pedido na planilha. Só chame DEPOIS que o cliente confirmou claramente o resumo (itens, quantidades, total e prazo). Os preços vêm da planilha, não de você.",
    input_schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: { id_produto: { type: "integer" }, quantidade: { type: "number" } },
            required: ["id_produto", "quantidade"],
            additionalProperties: false,
          },
        },
        nome_cliente: { type: "string", description: "Nome informado pelo cliente, se cliente novo." },
        observacoes: { type: "string", description: "Detalhes: arquivo/arte, acabamento, retirada ou entrega, prazo pedido." },
        cliente_confirmou: { type: "boolean", description: "true só se o cliente confirmou o resumo final." },
      },
      required: ["itens", "cliente_confirmou"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_lembrete_orcamento",
    description:
      "Para serviços sem preço fixo (orçamento, serviço personalizado): anota na aba Lembretes para o Junior responder com o valor. Nunca informe preço ao cliente nesse caso.",
    input_schema: {
      type: "object",
      properties: {
        nome_cliente: { type: "string" },
        descricao: { type: "string", description: "O que o cliente quer, com medidas e quantidades." },
      },
      required: ["descricao"],
      additionalProperties: false,
    },
  },
  {
    name: "chamar_humano",
    description:
      "Passa a conversa para o Junior. Use para reclamação, dúvida que você não sabe responder, cliente pedindo para falar com uma pessoa, ou qualquer situação fora do padrão.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Resumo curto do que o cliente precisa." } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
];

function acharCliente(store, telefone) {
  const tel = soDigitos(telefone);
  return store.getRows("Clientes").find((c) => tel && soDigitos(c["Telefone"]) === tel);
}

// ctx = { store, telefone, avisarJunior(texto) }
export function criarExecutor(ctx) {
  const { store, telefone } = ctx;
  const cliente = () => acharCliente(store, telefone);
  const geral = () => store.getRows("Clientes").find((c) => up(c["Nome"]) === "CONSUMIDOR FINAL");

  const handlers = {
    consultar_produtos({ busca = "" }) {
      const ids = new Set([cliente()?.["ID Cliente"], geral()?.["ID Cliente"]].filter((x) => x != null));
      const termos = semAcento(busca).split(/\s+/).filter(Boolean);
      const lista = store
        .getRows("Produtos")
        .filter((p) => ids.has(p["ID Cliente"]) && up(p["Ativo"]) === "SIM")
        // produto do próprio cliente vence o geral de mesmo nome
        .sort((a, b) => (b["ID Cliente"] === cliente()?.["ID Cliente"]) - (a["ID Cliente"] === cliente()?.["ID Cliente"]))
        .filter((p) => termos.every((t) => semAcento(p["Produto"]).includes(t)))
        .map((p) => ({ id_produto: p["ID Produto"], produto: p["Produto"], preco_unitario: p["Preço Unitário"] }));
      return { cliente_conhecido: Boolean(cliente()), produtos: lista };
    },

    registrar_pedido({ itens, nome_cliente, observacoes = "", cliente_confirmou }) {
      if (cliente_confirmou !== true) return { erro: "O cliente ainda não confirmou o resumo. Mostre o resumo e peça confirmação." };
      if (!Array.isArray(itens) || !itens.length) return { erro: "Pedido sem itens." };

      const permitidos = new Set([cliente()?.["ID Cliente"], geral()?.["ID Cliente"]].filter((x) => x != null));
      const linhas = [];
      for (const it of itens) {
        const prod = store.getRows("Produtos").find((p) => p["ID Produto"] === it.id_produto);
        if (!prod || !permitidos.has(prod["ID Cliente"]) || up(prod["Ativo"]) !== "SIM") return { erro: `Produto ${it.id_produto} não está disponível para este cliente.` };
        if (!(it.quantidade > 0)) return { erro: "Quantidade inválida." };
        linhas.push({ prod, quantidade: it.quantidade, subtotal: Math.round(it.quantidade * prod["Preço Unitário"] * 100) / 100 });
      }

      // cliente novo: cadastra (telefone vem da conversa, nunca do modelo)
      let cli = cliente();
      let clienteNovo = false;
      if (!cli) {
        cli = store.appendRow("Clientes", {
          "ID Cliente": nextId(store, "Clientes", "ID Cliente"),
          Nome: up(nome_cliente) || soDigitos(telefone),
          Telefone: soDigitos(telefone), "E-mail": "", Cidade: "", Observações: "CADASTRADO PELO AGENTE",
        });
        clienteNovo = true;
      }

      const total = Math.round(linhas.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;
      const idPedido = nextId(store, "Pedidos", "ID Pedido");
      store.appendRow("Pedidos", {
        "ID Pedido": idPedido, Data: hoje(), "ID Cliente": cli["ID Cliente"], Cliente: cli["Nome"],
        Status: "RECEBIDO", "Entrega Prevista": "", "Valor Total": total, "ID Venda": "",
        Observações: up(`PEDIDO PELO WHATSAPP. ${observacoes}`), "Data Conclusão": "", Contato: soDigitos(telefone),
      });
      for (const l of linhas) {
        store.appendRow("ItensPedido", {
          "ID Item": nextId(store, "ItensPedido", "ID Item"), "ID Pedido": idPedido, "ID Produto": l.prod["ID Produto"],
          Produto: l.prod["Produto"], Quantidade: l.quantidade, "Preço Unitário": l.prod["Preço Unitário"], Subtotal: l.subtotal,
        });
      }
      ctx.avisarJunior?.(`NOVO PEDIDO ${idPedido} — ${cli["Nome"]} — R$ ${total.toFixed(2)}`);
      return { ok: true, id_pedido: idPedido, total, cliente_novo: clienteNovo };
    },

    registrar_lembrete_orcamento({ nome_cliente, descricao }) {
      const cli = cliente();
      const id = nextId(store, "Lembretes", "ID Lembrete");
      store.appendRow("Lembretes", {
        "ID Lembrete": id, Data: hoje(), Cliente: up(cli?.["Nome"] ?? nome_cliente) || soDigitos(telefone),
        Lembrete: up(descricao), Status: "PENDENTE", Observações: `TEL ${soDigitos(telefone)} — ORÇAMENTO PENDENTE`,
      });
      ctx.avisarJunior?.(`ORÇAMENTO PENDENTE (lembrete ${id}) — ${up(descricao)}`);
      return { ok: true, id_lembrete: id };
    },

    chamar_humano({ motivo }) {
      store.appendRow("Atendimentos", { Data: hoje(), Telefone: soDigitos(telefone), Motivo: up(motivo), Status: "AGUARDANDO JUNIOR" });
      ctx.avisarJunior?.(`CHAMADO — ${soDigitos(telefone)} — ${up(motivo)}`);
      return { ok: true };
    },
  };

  return (nome, entrada) => {
    const h = handlers[nome];
    if (!h) return { erro: `Ferramenta desconhecida: ${nome}` };
    try { return h(entrada ?? {}); } catch (e) { return { erro: `Falha interna: ${e.message}` }; }
  };
}
