# Tarefa 3: três carros

Leia antes `tarefas/regras.md`. Só comece depois que as tarefas 1, 2 e 5 terminarem: elas mexem em `car.js`, `ai.js`
e nas mesmas telas.

## O pedido do usuário

> Vamos adicionar 2 carros, um com maior velocidade mas menor tração e aceleração. Esse atual vamos manter, mas com
> mais tração. Ambos só têm direito a 1 arma e 1 mina. O terceiro tem direito a mais armas (2), tem a velocidade
> normal do carro atual mas menos tração. Lembrando que quando perde a tração, também perde velocidade.

## Como está hoje

- `CAR_MODELS` em `src/config.js` tem só o Micro, com 5 pontos em cada medidor: velocidade, aceleração, tração e
  blindagem.
- `src/sim/stats.js` transforma os pontos em física.
- Todo carro tem 2 armas de frente, 1 traseira e 1 extra (`DEFAULT_LOADOUT`, `src/sim/loadout.js`).

## Os três carros

Pontos em `CAR_MODELS`. Os nomes Flecha e Arsenal são provisórios; o usuário pode trocar.

| Carro           | Velocidade | Aceleração | Tração    | Blindagem | Frente | Traseira | Extra |
|-----------------|-----------:|-----------:|----------:|----------:|-------:|---------:|------:|
| Micro (o atual) | 5          | 5          | 7 (era 5) | 5         | 1      | 1        | 1     |
| Flecha          | 8          | 3          | 3         | 5         | 1      | 1        | 1     |
| Arsenal         | 5          | 5          | 4         | 5         | 2      | 1        | 1     |

- "1 mina" quer dizer 1 item traseiro: mina, PEM, óleo ou cola. O extra (nitro) continua em todos os carros.
- O número de encaixes fica nos dados do modelo (por exemplo `slots: { front: 1, rear: 1, extra: 1 }`), nada fixo
  no código.
- Menos tração quer dizer derrapar mais e perder mais velocidade derrapando. A física já faz isso: a tração cai com a
  velocidade e a derrapagem freia o carro. Não crie regra nova. Só confirme com um teste que o Flecha perde mais
  velocidade que o Micro numa curva fechada.

## Escolha do carro

- Na tela Equipar, no topo, adicione uma linha "Carro" com os três, mostrando os pontos em barrinhas, como na loja do
  jogo original.
- O carro escolhido define quantos encaixes de arma aparecem. Num carro com 1 arma de frente, a linha "Arma 2" some.
- Ao trocar para um carro com 1 arma, fica a primeira arma. Ao voltar para o Arsenal, a segunda arma volta
  preenchida com uma arma válida.
- Guarde o carro no `localStorage` com a chave `minicar.car`, no mesmo padrão de `game.js`.
- `sanitizeLoadout` passa a validar o equipamento contra o modelo do carro.
- HUD (`src/render/hud.js`): a barra de baixo mostra só os encaixes que o carro tem. A tecla da Arma 2 não faz nada
  num carro de 1 arma.
- Ajuste os textos de teclas no `index.html` se precisar, por exemplo deixando claro que a "Arma 2" só existe no
  Arsenal.

## CPU

- Cada carro da CPU sorteia um modelo e um equipamento válido para ele, usando o `rng` da corrida para os testes
  continuarem repetíveis.
- A IA usa os stats do próprio carro para frear antes das curvas (`cornerSpeed`), então deve se adaptar sozinha.
  Confira pelo código.

## Visual

Dê a cada modelo um desenho próprio em `src/render/draw-car.js`, mantendo a cor do piloto. Por exemplo: o Flecha
comprido e fino, com aerofólio; o Arsenal mais largo, com as duas armas à mostra.

## Testes

- Pontos e stats de cada modelo: o Flecha é mais rápido que o Micro e tem menos tração e aceleração; o Arsenal tem a
  velocidade do Micro e menos tração.
- Equipamento: um carro de 1 arma não aceita 2; o Arsenal exige 2 armas diferentes; a CPU sempre recebe um
  equipamento válido para o seu modelo.
- Os testes de dirigibilidade (`tests/handling.test.js`) usam o Micro e devem continuar passando com mais tração.
  Não afrouxe nenhum limite para um teste passar sem explicar por quê.
- `npm test` e `npm run build` passando.

## Escopo

- `src/config.js` (`CAR_MODELS`, `DEFAULT_LOADOUT`).
- Em `src/sim/`: `stats.js`, `car.js` (a criação do carro, não a física do `drive`), `loadout.js`, `race.js`, e
  `ai.js` só na escolha de equipamento e no que depende do número de armas.
- Em `src/render/`: `draw-car.js` e `hud.js`.
- A tela Equipar em `src/ui/screens.js`, `src/game.js` e `index.html`, além de `src/styles.css` e os testes.
