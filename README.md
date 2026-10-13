# Beach Tennis Score

Placar de duplas em um único arquivo (`index.html`), sem dependências. Funciona em celular, tablet e TV (abra no navegador; botão ⛶ para tela cheia). Implementa a especificação funcional v1.0.

- **Cadastro:** foto (câmera ou galeria) e nome dos 4 atletas; escolha de quem saca o Game 1
- **Saque:** o sistema pergunta quem saca o Game 2 e depois segue a sequência sozinho (A1 → B1 → A2 → B2…). Sacador com borda verde e 🎾
- **Pontuação:** 0, 15, 30, 40; em 40x40 o próximo ponto decide (sem vantagem)
- **Games:** 6x0 a 6x4, 7x5, tie-break em 6x6 (sem limite, diferença mínima de 2)
- **Troca de lado:** aviso 🔄 após cada game ímpar e, no tie-break, após 1, 5, 9, 13… pontos
- **⚙ Corrigir:** desfazer último ponto, desfazer último game, editar games/pontos
- **🔄 Reiniciar partida:** volta à tela inicial
- **Tela final:** fotos e nome dos vencedores, placar, tempo, tie-break e resumo game a game (`15 x GAME`)
- Partida salva automaticamente no navegador (retoma após fechar a página); atalhos: `1`/`←`, `2`/`→`, `U` desfazer, `Espaço` pausar
