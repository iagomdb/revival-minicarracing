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
  config.js        números do jogo (pontos dos carros, física, armas, preços, prêmios, dificuldades, campeonatos)
  main.js          monta as peças e liga o laço do jogo
  game.js          telas (menu, corrida, resultado), pausa e repasse de eventos
  career-mode.js   o campeonato do lado das telas: garagem, concessionária, loja, fim de corrida, save
  core/            utilitários: matemática, formato de tempo e dinheiro, laço com passo fixo
  sim/             a corrida em si: pista, física, IA, armas, colisões, itens, regras
    tracks/        uma pista por arquivo, e o registro com a ordem do menu (index.js)
  career/          regras do campeonato (pontos, dinheiro, carros) e da loja, e o save
  render/          desenho no canvas: pista, carros, efeitos, câmera, HUD
  audio/           sintetizador e sons de cada evento
  input/           teclado e mapeamento de teclas
  ui/              telas em HTML: menu, equipar/loja, pausa, resultado, garagem, concessionária
tests/             testes da simulação e do campeonato
```

## Campeonato

No menu, **Campeonato** (tecla **C**) começa um campeonato na dificuldade escolhida, ou continua o que está salvo.

- Você começa com **$ 12.000** e compra o carro na concessionária: Micro $ 10.500, Flecha $ 11.000, Arsenal
  $ 14.000. Carro novo vem com 1 laser.
- Na **garagem**, entre as corridas, aparecem o dinheiro, a próxima pista e a classificação. Dali você vai para a
  tela Equipar, que no campeonato é a **loja**, ou troca de carro. Trocar vende o atual pela metade do preço, com
  tudo o que está nele.
- Na loja, cada encaixe de arma leva um tipo de arma, com até 5 unidades. Cada unidade custa o preço da arma
  (`price` em `WEAPONS`) e soma a munição dela por volta: Laser ×3 dá 12 tiros. Motor, pneus e blindagem têm 5
  níveis cada (`UPGRADES`), e cada nível soma 1 ponto ao carro. O nível N custa `base × N`. Vender devolve metade.
- O Campeonato 1 são as 5 pistas, uma vez cada. Os pontos por posição são 10, 8, 6, 5, 4, 3, 2 e 1. O dinheiro de
  cada corrida é o prêmio da posição mais os sacos de dinheiro e os abates.
- Na classificação, o desempate é por vitórias e depois pela última corrida. Passam para o próximo campeonato os 3
  primeiros, ou os 4 primeiros no fácil.
- A CPU não compra nada: cada arma dela tem 1, 2 ou 3 unidades, conforme a dificuldade. Os 7 adversários e os
  carros deles são os mesmos do começo ao fim.
- O carro começa toda corrida consertado. Sair da corrida pela pausa não conta: você corre a mesma pista de novo.
- O jogo salva sozinho no navegador (`localStorage`) depois de cada compra e de cada corrida.

Os números ficam em `CAREER`, `CHAMPIONSHIPS`, `UPGRADES` e nos `price` de `CAR_MODELS` e `WEAPONS`, em `config.js`.
As regras ficam em `src/career/` e não conhecem tela nem `localStorage`: o save recebe o armazenamento como
parâmetro, e por isso os testes rodam o campeonato inteiro no Node. A corrida (`src/sim/`) não sabe que existe
campeonato. Ela recebe o carro, as unidades de cada arma (`units`) e os níveis de melhoria do jogador, e os
adversários fixos (`rivals`).

Na corrida rápida tudo continua de graça: você escolhe carro, armas e de 1 a 5 unidades de cada uma.

Cada carro tem pontos de velocidade, aceleração, tração e blindagem (`CAR_MODELS`), e os upgrades somam pontos:
motor dá velocidade e aceleração, pneu dá tração. `src/sim/stats.js` transforma pontos em física. A tração vale
em relação à velocidade: aderência = 800 + 100 × (tração − velocidade). Com tração igual à velocidade o carro fica
equilibrado; com mais velocidade que tração ele derrapa nas curvas até ganhar pneu. A aderência também cai conforme
o carro anda mais rápido, então devagar ele segue o volante e rápido derrapa se você virar demais.

São três carros, escolhidos na tela Equipar: **Micro** (equilibrado, o que tem mais tração), **Flecha** (o mais
rápido, mas com pouca aceleração e pouca tração) e **Arsenal** (velocidade do Micro, menos tração e 2 armas de
frente). Cada modelo diz em `slots` quantas armas leva; `sanitizeLoadout` (`src/sim/loadout.js`) ajusta o equipamento
ao carro, e a CPU sorteia carro e armas com o `rng` da corrida.

A CPU (`src/sim/ai.js`) só aperta "teclas" em `car.input`, como o jogador. Ela segue um traçado de corrida
calculado uma vez por pista (`src/sim/racing-line.js`): abre antes da curva, tangencia o lado de dentro e abre na
saída, usando só a parte da largura definida em `RACING_LINE`. Ela freia só o necessário para a curva desse traçado, que é mais aberta que a da linha central. A CPU joga
para ganhar. Cada carro anda um pouco para o lado desse traçado, ultrapassa pelo lado com mais espaço e alinha atrás do
alvo mais bem colocado na corrida. Ela só atira quando prevê que o tiro acerta, só solta mina ou mancha quando quem
vem atrás vai passar por cima. O nitro ela usa numa reta comprida o bastante ou para recuperar velocidade quando
trava (cola, batida, explosão).

Cada carro da CPU tem um perfil de comportamento (`AI_STYLES` em `src/config.js`):

- **agressivo:** caça e atira mais.
- **piloto:** fica colado no traçado, faz as curvas mais no limite e não muda de faixa para caçar.
- **defensivo:** fecha a faixa de quem vem atrás e usa mais a arma traseira.

Os perfis se revezam entre os carros, numa ordem sorteada a cada corrida, e a dificuldade vale por cima. Um perfil
novo é só mais uma linha em `AI_STYLES`.

A regra principal: **`src/sim/` não conhece tela, som nem teclado.** A simulação lê `car.input`, avança em
passos fixos de 1/120 s e anota o que aconteceu em `race.events` (laser disparado, carro explodiu, volta
completada...). `game.js` entrega esses eventos para `render/effects.js`, `render/hud.js` e `audio/sfx.js`.
Por isso a corrida inteira roda nos testes sem navegador, e com a mesma semente (`seededRandom`) ela se repete
igualzinha.

## Pistas

A pista é escolhida no menu (botões ou tecla **T**) e fica guardada no navegador. A primeira da lista em
`src/sim/tracks/index.js` é a inicial. Hoje são cinco:

- **Oito**: dois quadrados ligados por um X no mesmo nível (grama);
- **Deserto**: a pista original (areia);
- **Serpente**: uma reta comprida e um zigue-zague de curvas em S (grama);
- **Escada**: uma reta comprida e a volta descendo em degraus, com curvas para os dois lados e um grampo (neve);
- **Triângulo**: a base é uma reta comprida, os cantos são quase grampos e os lados têm uma dobra (terra).

Pista nova = um arquivo novo em `src/sim/tracks/` e uma linha na lista `TRACKS` de `index.js`. O arquivo diz:

- `id` e `name`: o nome aparece no botão do menu;
- `ground`: o tema do chão e do cenário (`'sand'` com cactos, `'grass'` com árvores, `'snow'` com pinheiros,
  `'dirt'` com pedras e arbustos secos);
- `width` (opcional): a largura do asfalto em px. Sem ela, vale a largura normal (140 px, `TRACK_HALF` em
  `config.js`). Só o Deserto usa a normal; as outras usam 280, o dobro;
- `points`: os pontos de controle da linha central, na ordem da volta. Eles são suavizados (Catmull-Rom), então
  poucos pontos entortam os lados. Para pista com base geométrica, `roundCorners` (em `src/sim/track.js`) recebe só
  os cantos do polígono com o raio de cada curva, como no `oito.js`, e avisa se dois cantos estão perto demais
  para os raios pedidos;
- `startAt`: o ponto de controle da linha de chegada. Ele precisa ficar numa reta com uns 300 px de reta atrás,
  onde cabe o grid.

Cruzamentos no mesmo nível, como o X do Oito, funcionam sozinhos: a pista marca os pontos perto de outro trecho
(`track.crossing`). Ali o carro continua preso ao próprio braço (o índice dele nunca pula para o outro), mas desliza
na borda sem bater, os itens e o renascimento ficam fora do X e as faixas pintadas param na borda do outro braço.
Ponte, com um trecho passando por cima do outro, ainda não existe.

`npm test` confere todas as pistas da lista: a volta fecha sem emenda e tem comprimento parecido com a do Deserto,
as curvas têm raio de pelo menos 140 px, a pista não encosta nela mesma fora de um cruzamento, o grid fica numa
reta e uma corrida inteira termina.
