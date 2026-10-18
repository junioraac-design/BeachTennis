# Beach Tennis Score

Placar de duplas feito só com HTML, CSS e JavaScript, sem dependências e sem servidor. Funciona em celular, tablet e TV (abra no navegador ou instale como app). Implementa a especificação funcional v1.0 e as melhorias da v2.0.

**Abrir:** `index.html` direto no navegador, ou publique a pasta (por exemplo no GitHub Pages) e use "Adicionar à tela inicial".

## Na partida
- **Cadastro:** foto (câmera ou galeria) e nome dos 4 atletas; fotos reaproveitadas pelo nome; escolha de quem saca o Game 1
- **Lado inicial:** escolhido na hora, como você vê a quadra (Dupla 1 à esquerda ou à direita); **⚙ Corrigir → Inverter lados na tela** espelha a qualquer momento (não afeta placar nem desfazer)
- **Saque:** pergunta quem saca o Game 2 e depois segue a sequência sozinho (A1 → B1 → A2 → B2…). Sacador com borda verde e 🎾
- **Pontuação:** 0, 15, 30, 40; em 40x40 o próximo ponto decide (ponto de ouro)
- **Games:** 6x0 a 6x4, 7x5, tie-break em 6x6 (sem limite, diferença mínima de 2). Set curto de 4 games opcional
- **Troca de lado:** aviso 🔄 após cada game ímpar e, no tie-break, após 1, 5, 9, 13… pontos. Nomes, fotos e placar trocam de lado na tela, com animação, como nas transmissões de TV
- **⚙ Corrigir:** desfazer ponto, desfazer game, editar games/pontos
- **⟳ Girar tela:** automático, horizontal, horizontal invertido ou vertical
- **Configurações:** som, narração do placar em português, segurar para marcar ponto, aviso de troca de lado em tela cheia ou faixa, tamanho do set, salvar ao terminar
- Partida salva automaticamente no navegador (retoma após fechar a página). Atalhos: `1`/`←`, `2`/`→`, `U` desfazer, `Espaço` pausar

## Depois da partida
- **Tela final** com vencedores, placar, tempo, tie-break e resumo game a game
- **Salvar** no histórico (automático por padrão) e **compartilhar o resultado como imagem**
- **📊 Histórico e ranking:** partidas, ranking individual e de duplas (vitórias, aproveitamento, saldo de games), filtro avulsas/torneios
- **Backup:** exportar/importar JSON (os dados ficam só no navegador do aparelho)

## 🏆 Torneios
- **Super 8:** 8 atletas, 7 rodadas, cada um joga uma vez ao lado de cada outro; classificação individual
- **Rei da Quadra / Rainha da Quadra:** rodadas sorteadas uma a uma, com rodízio justo e parceiros diferentes; 1 ou 2 quadras
- **Chaveamento:** mata-mata de 3 a 16 duplas, com folgas
- Cada jogo pode ser disputado no placar (o resultado volta sozinho; o app pergunta o lado inicial e quem saca primeiro) ou lançado à mão
- **Ranking geral dos torneios** no histórico

## 📺 TV ao vivo
Você marca os pontos no celular e a TV só exibe o placar.

1. **Mesma tela/aparelho** (ex.: notebook com segundo monitor): *Configurações → Transmitir para a TV → Abrir TV*. Não precisa configurar nada.
2. **Outro aparelho (TV, tablet…):** é preciso um banco gratuito do Firebase:
   1. Em https://console.firebase.google.com crie um projeto e, em *Build → Realtime Database*, crie um banco.
   2. Na aba **Rules**, cole e publique:
      ```json
      { "rules": { "rooms": { "$code": { ".read": true, ".write": true } } } }
      ```
   3. Copie o endereço do banco (algo como `https://seu-projeto-default-rtdb.firebaseio.com`).
   4. No app: *Configurações → Transmitir para a TV*, cole o endereço e toque em **Copiar link**. Abra esse link no navegador da TV.
   - O placar fica acessível a quem tiver o link (o código da sala é aleatório). Não há dados pessoais além de nomes e fotos dos atletas.
   - Alternativa sem configurar nada: transmitir a tela do celular para a TV (Chromecast, AirPlay, Miracast).

## Instalar no celular (GitHub Pages)
1. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha a branch e a pasta `/ (root)` e salve.
2. Abra `https://SEU-USUARIO.github.io/BeachTennis/` no Chrome (Android) ou Safari (iPhone).
3. Menu do navegador → **Adicionar à tela inicial** (Android: *Instalar app*). Abre em tela cheia e funciona offline.

Ao publicar mudanças, aumente `CACHE` em `sw.js` para os aparelhos receberem a versão nova.

## Desenvolvimento
```
js/engine.js         regras da partida (puro, sem tela)
js/tourney-logic.js  sorteios e tabelas dos torneios (puro)
js/stats.js          ranking e estatísticas (puro)
js/store.js          armazenamento local
js/app.js            tela da partida
js/history.js        salvar, histórico, ranking, backup
js/tourneys.js       telas dos torneios
js/settings.js       configurações, som, voz, segurar para marcar
js/share.js          imagem de compartilhamento
js/sync.js           TV ao vivo
tests/               testes automáticos
```
Rodar os testes (Node 18+): `npm test`
