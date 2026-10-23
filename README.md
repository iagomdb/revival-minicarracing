# Minicar Racing

Corrida com combate de carrinhos, vista de cima, inspirada em *Asphalt Duell* / *Mini Car Racing* (AEON Design, 1999).

## Rodando

No Windows, dê dois cliques em **`jogar.bat`**: ele instala as dependências na primeira vez e abre o jogo
no navegador. Deixe a janela preta aberta enquanto joga.

Abrir o `index.html` direto não funciona: o navegador bloqueia módulos JavaScript carregados do disco.

```bash
npm install
npm run dev      # abre o jogo em http://localhost:5173
npm test         # testes da simulação (node --test)
npm run build    # gera dist/, que funciona em qualquer hospedagem estática
```

Em desenvolvimento, `http://localhost:5173/?autopilot` começa uma corrida com o seu carro dirigindo sozinho.

## Organização

```
src/
  config.js        números do jogo (pontos dos carros, física, catálogo de armas, prêmios, dificuldades)
  main.js          monta as peças e liga o laço do jogo
  game.js          telas (menu, corrida, resultado), pausa e repasse de eventos
  core/            utilitários: matemática, formato de tempo, laço com passo fixo
  sim/             a corrida em si: pista, física, IA, armas, colisões, itens, regras
    tracks/        uma pista por arquivo, e o registro com a ordem do menu (index.js)
  render/          desenho no canvas: pista, carros, efeitos, câmera, HUD
  audio/           sintetizador e sons de cada evento
  input/           teclado e mapeamento de teclas
  ui/              menu, pausa e resultado em HTML
tests/             testes da simulação
```

Cada carro tem pontos de velocidade, aceleração, tração e blindagem (`CAR_MODELS`), e os upgrades somam pontos:
motor dá velocidade e aceleração, pneu dá tração. `src/sim/stats.js` transforma pontos em física. A tração cai
conforme a velocidade sobe, então devagar o carro segue o volante e rápido ele derrapa se você virar demais.

São três carros, escolhidos na tela Equipar: **Micro** (equilibrado, o que tem mais tração), **Flecha** (o mais
rápido, mas com pouca aceleração e pouca tração) e **Arsenal** (velocidade do Micro, menos tração e 2 armas de
frente). Cada modelo diz em `slots` quantas armas leva; `sanitizeLoadout` (`src/sim/loadout.js`) ajusta o equipamento
ao carro, e a CPU sorteia carro e armas com o `rng` da corrida.

A regra principal: **`src/sim/` não conhece tela, som nem teclado.** A simulação lê `car.input`, avança em
passos fixos de 1/120 s e anota o que aconteceu em `race.events` (laser disparado, carro explodiu, volta
completada...). `game.js` entrega esses eventos para `render/effects.js`, `render/hud.js` e `audio/sfx.js`.
Por isso a corrida inteira roda nos testes sem navegador, e com a mesma semente (`seededRandom`) ela se repete
igualzinha.

## Pistas

A pista é escolhida no menu (botões ou tecla **T**) e fica guardada no navegador. A primeira da lista em
`src/sim/tracks/index.js` é a inicial: hoje o **Oito**, depois o **Deserto**.

Pista nova = um arquivo novo em `src/sim/tracks/` e uma linha na lista `TRACKS` de `index.js`. O arquivo diz:

- `id` e `name`: o nome aparece no botão do menu;
- `ground`: o tema do chão e do cenário (`'sand'` com cactos, `'grass'` com árvores);
- `points`: os pontos de controle da linha central, na ordem da volta. Eles são suavizados (Catmull-Rom), então
  poucos pontos entortam os lados. Para pista de cantos retos, `roundCorners` (em `src/sim/track.js`) recebe só os
  cantos com o raio de cada curva, como no `oito.js`;
- `startAt`: o ponto de controle da linha de chegada. Ele precisa ficar numa reta com uns 300 px de reta atrás,
  onde cabe o grid.

Cruzamentos no mesmo nível, como o X do Oito, funcionam sozinhos: a pista marca os pontos perto de outro trecho
(`track.crossing`). Ali o carro continua preso ao próprio braço (o índice dele nunca pula para o outro), mas desliza
na borda sem bater, os itens e o renascimento ficam fora do X e as faixas pintadas param na borda do outro braço.
Ponte, com um trecho passando por cima do outro, ainda não existe.

`npm test` confere todas as pistas da lista: a volta fecha sem emenda, o grid fica numa reta e uma corrida inteira
termina.
