# Agente de WhatsApp — ART VÍDEO (Fase 1: simulador)

Agente que atende o cliente, monta o pedido e grava na planilha. Nesta fase não há WhatsApp: você conversa pelo terminal e o pedido cai numa planilha de teste local (`dados/`).

## Rodar
1. `npm install`
2. Pegue uma chave em https://console.anthropic.com e rode: `export ANTHROPIC_API_KEY=sua-chave`
3. `npm run simulador` (opcional: `npm run simulador -- 5511999990001` para testar como a cliente CAROL)
4. `npm test` roda os testes automáticos (não usam a API nem gastam nada).

## Mapa dos arquivos
- `src/prompt.js` — o "jeito de atender". Edite aqui.
- `src/tools.js` — o que o agente PODE fazer (consultar preço, gravar pedido, anotar orçamento, chamar o Junior) e as travas de segurança.
- `src/agent.js` — conversa com o Claude e executa as ferramentas. Se algo falha, o cliente recebe uma resposta e o Junior é avisado.
- `src/store.js` — a "planilha". Será trocada pelo Google Sheets na próxima fase.
- `dados/planilha-teste.json` — produtos e clientes de exemplo.

## Travas
- Preço sempre vem da planilha, nunca do modelo.
- Pedido só é gravado com confirmação do cliente; produto só de quem tem direito (cliente + gerais).
- Telefone vem da conversa, nunca do modelo. Tudo gravado em MAIÚSCULO.

Modelo padrão `claude-opus-5-5`; troque com `MODELO=claude-haiku-5-5 npm run simulador` para comparar custo e qualidade.
