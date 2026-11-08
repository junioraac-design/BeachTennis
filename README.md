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
- **🏟 Arena e patrocinador (em Configurações):** aparecem **só na transmissão (TV)**, no quadro central do placar (logo/nome da arena no alto e patrocinador embaixo, com cantos arredondados), e na tela final da TV. A imagem de compartilhamento do resultado também leva a arena e o patrocinador. O placar do celular fica limpo
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

### Digitar o link na TV (link curto)
- **Código da sala:** em *Configurações → Transmitir para a TV* você escolhe o código (4 a 12 letras ou números, ex.: `ARENASOL`).
- **A TV lembra o último código.** Na primeira vez, digite o link completo e deixe nos favoritos do navegador da TV. Nas próximas, basta abrir o favorito, ou o endereço terminado em `?tv`, sem digitar o código de novo. Se abrir o endereço terminado em `?tv` e a TV não souber o código, ela mostra um campo para digitar só o código.
- **Link menor:** o endereço do banco vai no link em forma curta (`db=p:seu-projeto`). Para o link levar **só o código** (ex.: `usuario.github.io/BeachTennis/?tv=ARENASOL`), preencha `window.BT_DEFAULT_DB` no arquivo `config.js` com o endereço do seu banco e publique. Faça isso **só com o modo seguro ligado**, porque o arquivo fica público.
- **Colar em vez de digitar:** em Android TV e Google TV, o app *Google TV* (controle remoto no celular) permite digitar e colar texto pelo teclado do celular. Smart TVs Samsung e LG têm recurso parecido nos apps SmartThings e ThinQ.

### Se a TV mostrar "Servidor não encontrado"
Não é erro do app: a TV não conseguiu chegar ao site. Teste abrir `google.com` na TV. Se também não abrir, confira o Wi-Fi da TV. Se abrir o Google mas não o app, troque o **DNS** da TV (Samsung: *Configurações → Geral → Rede → Status da rede → Configurações de IP → Configuração de DNS → Inserir manualmente* e use `8.8.8.8`). Navegadores de TV muito antigos podem não abrir sites https modernos: nesse caso use **Smart View / Chromecast / AirPlay** (espelhar o celular) ou um tablet/notebook ligado por HDMI.

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
config.js            endereço do seu banco (opcional, para link curto)
js/brand.js          arena e patrocinador
tests/               testes automáticos
```
Rodar os testes (Node 18+): `npm test`
