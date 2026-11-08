# Beach Tennis Score

Placar de duplas feito só com HTML, CSS e JavaScript, sem dependências e sem servidor. Funciona em celular, tablet e TV (abra no navegador ou instale como app). Implementa a especificação funcional v1.0 e, da v2.0, salvar partida, histórico, estatísticas e torneios.

**Abrir:** `index.html` direto no navegador, ou publique a pasta (por exemplo no GitHub Pages) e use "Adicionar à tela inicial".

## Na partida
- **Cadastro:** foto (câmera, galeria ou **Arquivos / Drive**) e nome dos 4 atletas; fotos reaproveitadas pelo nome; escolha de quem saca o Game 1
- **Lado inicial:** escolhido na hora, como você vê a quadra (Dupla 1 à esquerda ou à direita); **⚙ Corrigir → Inverter lados na tela** espelha a qualquer momento (não afeta placar nem desfazer)
- **Saque:** pergunta quem saca o Game 2 e depois segue a sequência sozinho (A1 → B1 → A2 → B2…). Sacador com borda verde e 🎾
- **Pontuação:** 0, 15, 30, 40; em 40x40 o próximo ponto decide (ponto de ouro)
- **Games:** 6x0 a 6x4, 7x5, tie-break em 6x6 (sem limite, diferença mínima de 2). Set curto de 4 games opcional
- **Troca de lado:** aviso 🔄 após cada game ímpar e, no tie-break, após 1, 5, 9, 13… pontos. Nomes, fotos e placar trocam de lado na tela, com animação, como nas transmissões de TV
- **⚙ Corrigir:** desfazer ponto, desfazer game, editar games/pontos
- **⟳ Girar tela:** automático, horizontal, horizontal invertido ou vertical
- **🏟 Arena e patrocinador (em Configurações):** nome e logo da arena no topo do placar, e imagem/texto do patrocinador no centro. Também aparecem na tela final, na imagem de compartilhamento e na TV
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
   - Quem tiver o link vê o placar, os nomes e as fotos dos atletas (o código da sala é aleatório). Não compartilhe fora do jogo.
   - **Gerar novo link** (em Configurações): apaga a sala atual e cria outra. Quem tinha o link antigo deixa de ver o placar.
   - **Modo seguro (recomendado se o link for compartilhado):** com ele, só o seu aparelho consegue alterar o placar; quem abre o link só lê.
     1. No Firebase, em *Build → Authentication → Método de login*, ative o provedor **Anônimo**.
     2. Em *Configurações do projeto (engrenagem) → Geral*, copie a **Chave de API da Web**.
     3. No app, cole essa chave em *Configurações → Transmitir para a TV → Chave de API*.
     4. Toque em **📋 Copiar regras seguras**, cole em *Realtime Database → Regras* e publique. Depois toque em **Testar conexão**.
     - A sala passa a pertencer ao aparelho que a criou. Se outro aparelho (ou o mesmo, após limpar os dados do navegador) precisar transmitir, use **Gerar novo link**.
   - Alternativa sem configurar nada: transmitir a tela do celular para a TV (Chromecast, AirPlay, Miracast).

### Se a TV não funcionar
1. Em **⚙ Configurações → Transmitir para a TV**, toque em **🔍 Testar conexão**. O app diz o que está errado:
   - **Permissão negada (401/403):** as *Regras* do Firebase não foram publicadas (veja o passo 2 acima). No modo seguro, publique as regras seguras e, se a sala for de outro aparelho, use **Gerar novo link**.
   - **Ative o login Anônimo / Chave de API inválida:** só no modo seguro; veja os passos acima.
   - **Sem conexão / endereço não encontrado:** o endereço do banco está errado (deve começar com `https://` e terminar em `firebaseio.com` ou `firebasedatabase.app`) ou não há internet.
2. A tela da TV mostra o estado da conexão abaixo de "Aguardando partida…" (✔ Conectado ou o motivo do erro).
3. Confira em **⚙ Configurações** o número da **Versão** no rodapé. Se estiver antigo, force a atualização (veja abaixo).

## Atualização do app instalado
O app confere se há versão nova a cada abertura (com internet), mas só mostra a nova **na abertura seguinte**: abra, feche por completo e abra de novo. Para forçar no computador: **Ctrl + Shift + R**. Se continuar preso, no Chrome: *F12 → Application → Service Workers → Unregister* e *Storage → Clear site data* (isso apaga o histórico do aparelho, então exporte o backup antes). Histórico, torneios e fotos ficam só no aparelho e **não** são apagados nas atualizações.

## Instalar no celular (GitHub Pages)
1. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha a branch e a pasta `/ (root)` e salve.
2. Abra `https://SEU-USUARIO.github.io/BeachTennis/` no Chrome (Android) ou Safari (iPhone).
3. Menu do navegador → **Adicionar à tela inicial** (Android: *Instalar app*). Abre em tela cheia e funciona offline.

Ao publicar mudanças, aumente `CACHE` em `sw.js` e `APP_VERSION` em `js/settings.js` para os aparelhos receberem a versão nova.

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
js/sync.js           TV ao vivo (com modo seguro)
js/brand.js          arena e patrocinador
tests/               testes automáticos
```
Rodar os testes (Node 18+): `npm test`
