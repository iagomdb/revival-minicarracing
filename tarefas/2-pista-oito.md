# Tarefa 2: pista em oito e escolha de pista

Leia antes `tarefas/regras.md`. Esta tarefa pode começar agora, junto com a tarefa 1.

## O pedido do usuário

> Vamos criar mais 2 mapas. O primeiro, que vai ser o mapa inicial, precisa ser 2 quadrados que se cruzam.
> Então ele vai parecer um oito. Posso desenhar os mapas se for o caso.

Esta tarefa faz o primeiro mapa (o Oito) e a escolha de pista. O segundo mapa é a tarefa 4, que depende de um
desenho do usuário. Deixe tudo pronto para que uma pista nova seja só um arquivo novo em `src/sim/tracks/` e uma
linha no registro de pistas.

## O formato do Oito

São dois quadrados de cantos arredondados, lado a lado, ligados por um X no meio:

```
  ┌───────────┐         ┌───────────┐
  │            ╲       ╱            │
  │              ╲   ╱              │
  │                ╳                │
  │              ╱   ╲              │
  │            ╱       ╲            │
  └───────────┘         └───────────┘
```

- O carro contorna um quadrado, atravessa o X, contorna o outro e volta ao X.
- O cruzamento é no mesmo nível, sem ponte. Carros vindos dos dois lados podem bater ali, e isso faz parte da graça.
- Se o usuário mandar um desenho neste chat, siga o desenho em vez deste esquema.

## Requisitos da pista

- Crie um arquivo novo em `src/sim/tracks/` (por exemplo `oito.js`) no mesmo formato do `desert.js`.
- A volta deve ter comprimento parecido com a do Deserto.
- Os lados precisam ser retos e os cantos precisam ter um raio que dê para fazer de carro. Os pontos de controle passam
  por Catmull-Rom, que arredonda os cantos e entorta os lados se houver poucos pontos. Ponha pontos extras perto
  dos cantos.
- A largada fica numa reta, longe do X. Nenhuma posição do grid (`gridSlot`) pode cair no X ou numa curva.
- Um carro nunca pode "pular" para o outro braço do X: `car.idx` precisa seguir avançando normalmente ao atravessar
  o cruzamento. `nearestOnTrack` com `hint` já ajuda nisso. Confira também os tiros (`updateShots`), o renascimento
  depois de explodir e a IA.
- Sacos de dinheiro e kits de conserto (`src/sim/pickups.js`) ficam fora da área do X.
- Desenho: `src/render/draw-track.js` pinta o traçado em camadas. No X, o guard-rail, a zebra e as faixas amarelas
  de um braço não podem aparecer por cima do asfalto do outro. Confira pelo código.
- O cenário (`src/render/scenery.js`) não pode ficar em cima de nenhum trecho de pista.
- No X, o carro esbarra numa "mureta invisível" na borda do próprio braço. Isso é aceitável. Se der para deixar mais
  natural sem permitir trocar de braço, melhor.

## Escolha de pista

- Crie um registro de pistas (por exemplo `src/sim/tracks/index.js`) com a lista em ordem: Oito primeiro, porque é
  a pista inicial, e Deserto depois.
- No menu, adicione uma linha "Pista" igual à de dificuldade, com botões. Se usar teclas, não conflite com 1/2/3, que
  escolhem a dificuldade.
- Guarde a escolha no `localStorage` com a chave `minicar.track`, no mesmo padrão com try/catch de `game.js`.
- Hoje `src/main.js` cria uma pista fixa, e o renderer monta a arte e o cenário uma vez só (`createTrackArt`,
  `buildScenery`). O jogo precisa conseguir trocar de pista: a corrida de fundo do menu passa a usar a pista
  escolhida, e o renderer refaz a arte e o cenário quando a pista muda.
- Se ficar simples, dê a cada pista um tema de chão definido nos dados da pista. O Deserto continua com areia; o Oito
  usa outro chão, como grama ou asfalto de cidade.

## Testes

- Para cada pista do registro, o traçado fecha sem emenda e uma corrida com todos os carros no piloto automático
  termina as voltas sem ninguém travar. Estenda os testes de `tests/track.test.js` e `tests/race.test.js` para rodar
  em todas as pistas.
- No Oito, um carro que anda a volta inteira atravessa o X sem o `idx` pular para o outro braço.
- `npm test` e `npm run build` passando.

## Escopo

- `src/sim/tracks/`, `src/sim/track.js` e `src/sim/pickups.js`.
- Em `src/render/`: `draw-track.js`, `scenery.js` e `renderer.js`.
- `src/main.js`, e a parte de pista de `src/game.js` e `src/ui/screens.js`.
- O menu do `index.html`, `src/styles.css`, e os testes de pista e de corrida.

Não mexa no traçado do Deserto, nem em carros, armas ou na tela Equipar: são outras tarefas.
