# Regras para todas as tarefas

O projeto é um jogo de corrida com combate para navegador (Vite + JavaScript puro + Canvas), inspirado em
*Mini Car Racing* / *Asphalt Duell* (AEON Design, 1999). Leia o `README.md` antes de mexer. Ele explica as pastas
e a regra principal: `src/sim/` não conhece tela, som nem teclado. A simulação avisa o que aconteceu por eventos,
e os testes rodam corridas inteiras no Node com semente fixa.

## Sobre o usuário

- Responda em português, de forma simples e direta. O usuário está aprendendo a fazer jogos.
- O código precisa ser modular: nada de arquivo gigante. Siga o estilo dos arquivos vizinhos: nomes, comentários em
  português e a mesma quantidade de comentário.
- **Não rode o jogo no navegador** e não faça simulações para "medir" ou conferir. Valide com `npm test` e
  `npm run build` e apague a pasta `dist/` depois do build. Quem testa jogando é o usuário.
- Números do jogo ficam em `src/config.js`. Use pontos de dano/vida, segundos e px, nunca porcentagem de vida.

## Trabalho em paralelo

Outros chats estão mexendo nesta mesma pasta ao mesmo tempo, cada um na sua tarefa:

1. Óleo e cola: `tarefas/1-oleo-e-cola.md`
2. Pista em oito e escolha de pista: `tarefas/2-pista-oito.md`
3. Três carros: `tarefas/3-carros.md`
4. Segundo mapa novo: `tarefas/4-segundo-mapa.md`
5. IA mais esperta e corrida mais disputada: `tarefas/5-ia.md`
6. O primeiro campeonato: `tarefas/6-campeonato.md`
7. Loja de armas e melhorias: `tarefas/7-loja.md` (depois das tarefas 5 e 6)

- Fique no escopo da sua tarefa.
- Se um arquivo mudar enquanto você trabalha, releia antes de editar de novo. Nunca desfaça mudança que não é sua.
- Arquivos que mais de uma tarefa edita (`config.js`, `game.js`, `screens.js`, `index.html`, `styles.css`,
  `race.js`, `README.md`): só edições pontuais, nunca reescreva o arquivo inteiro.
- Se um teste fora da sua área quebrar, não conserte. No final, diga qual teste quebrou e o que você suspeita.
- O traçado do Deserto (`src/sim/tracks/desert.js`) fica como está. O usuário pediu.

## Ao terminar

- Se a organização das pastas ou o jeito de jogar mudou, atualize o `README.md`.
- Responda ao usuário com: o que mudou no jogo, o que ele deve testar jogando e as decisões que você tomou e que
  ele talvez queira mudar.

## Referência (opcional)

O jogo original está instalado em `D:\Program Files (x86)\eGames\Mini Car Racing`. O manual em inglês fica em
`assets\help.htm`, e há prints das telas em `assets\help images\` (por exemplo `ChooseCar.jpg`, a tela de escolher
carro). Consulte só se ajudar.
