import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.js";
import { toolDefs, criarExecutor } from "./tools.js";

// Modelo configurável: troque por "claude-haiku-5-5" para economizar depois de testar a qualidade.
export const MODELO = process.env.MODELO ?? "claude-opus-5-5";
const MAX_VOLTAS = 8; // trava de segurança contra loop de ferramentas

const MSG_ERRO = "Desculpe, tive um problema aqui. Já avisei o Junior e ele te responde em breve.";

// Uma conversa = um telefone. `historico` é a lista de mensagens (guardada por quem chama).
export async function responder({ historico, textoCliente, store, telefone, avisarJunior, client = new Anthropic() }) {
  const executar = criarExecutor({ store, telefone, avisarJunior });
  historico.push({ role: "user", content: textoCliente });

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resposta = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: toolDefs,
        messages: historico,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      // guarda o conteúdo inteiro da resposta (inclui blocos de ferramenta)
      historico.push({ role: "assistant", content: resposta.content });

      if (resposta.stop_reason === "refusal") throw new Error("recusa do modelo");
      if (resposta.stop_reason !== "tool_use") {
        return resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      }

      // executa TODAS as ferramentas pedidas e devolve os resultados numa só mensagem
      const resultados = resposta.content
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const r = executar(b.name, b.input);
          return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r), ...(r.erro ? { is_error: true } : {}) };
        });
      historico.push({ role: "user", content: resultados });
    }
    throw new Error("excedeu o limite de voltas");
  } catch (e) {
    // Regra de ouro: cliente nunca fica sem resposta e o Junior é avisado.
    avisarJunior?.(`FALHA DO AGENTE (${telefone}): ${e.message}`);
    return MSG_ERRO;
  }
}
