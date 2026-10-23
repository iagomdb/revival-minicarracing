# Tarefa 5: IA mais esperta e corrida mais disputada

Leia antes `tarefas/regras.md`. Só comece depois que a tarefa 1 terminar, porque as duas mexem na física do carro.
Pode rodar junto com a tarefa 2.

## O pedido do usuário

> Preciso melhorar a IA. Ela está sendo bem direta. No começo do jogo todos se matam, e tudo bem. Mas se algum
> sobrevive logo no começo, ele fica em primeiro e ganha.

## O problema

- A briga na largada fica como está: o usuário gosta.
- O problema é o que vem depois. Quem escapa da confusão inicial abre vantagem e ninguém mais alcança: a corrida se
  decide nos primeiros segundos.
- Hoje cada carro da CPU dirige e atira do mesmo jeito, só variando pela dificuldade (`skill`, `aggro`, `dodge` em
  `car.ai`). Ele atira no que estiver na frente, sem pensar em quem está ganhando.
- A IA fica em `src/sim/ai.js`, e as dificuldades em `DIFFICULTIES`, em `src/config.js`.

## O que fazer

### 1. Elástico: manter o pelotão junto

- O carro de referência é o jogador. Na corrida de fundo do menu, sem jogador, é o líder.
- A distância até a referência é medida em pista, contando as voltas.
- Carros da CPU muito atrás da referência ganham um pouco de velocidade máxima e aceleração. Quanto mais longe,
  mais ganham, até um teto.
- Carros da CPU muito à frente aliviam um pouco o pé, até um teto.
- Na última volta, quem está na frente não alivia mais. Assim o fim da corrida é de verdade e a CPU não fica
  "esperando" o jogador na chegada. O ganho de quem está atrás continua.
- O carro do jogador nunca é afetado.
- Tetos e distâncias em `src/config.js`, por dificuldade. No difícil, a CPU da frente alivia menos.
- O efeito precisa ser sutil: o jogador não pode perceber um carro "voando" do nada. Um teto de cerca de +12% para
  quem está atrás e −8% para quem está na frente é um bom ponto de partida.
- Para quem está atrás ganhar velocidade, a física precisa aceitar um multiplicador na velocidade máxima e na
  aceleração. Ponha isso no carro (por exemplo `car.boost`), lido em `drive()` em `src/sim/car.js`, numa edição
  pontual. A tarefa 1 também mexeu nesse arquivo.

### 2. Combate com estratégia

- A CPU passa a mirar em quem está na frente dela na classificação, com preferência pelo líder. Hoje ela mira no
  que aparecer primeiro.
- Um carro da CPU que está liderando e tem alguém colado atrás usa a arma traseira para se defender.
- Quem está atrás e longe usa o nitro nas retas para encostar (o nitro na reta já existe; ajuste o critério).

### 3. Personalidade

Para a CPU não dirigir toda igual, cada carro sorteia um estilo no começo da corrida, usando o `rng` da corrida para
os testes continuarem repetíveis:

- **Agressivo:** atira mais e cola no carro da frente.
- **Piloto:** traçado mais limpo e mais rápido, atira menos.
- **Defensivo:** usa mais a arma traseira e protege a posição.

Os valores ficam em `src/config.js`. A dificuldade continua valendo por cima do estilo.

## Testes

- Elástico, testado com um carro parado em posições escolhidas: um carro da CPU longe atrás da referência recebe
  mais velocidade máxima que um carro ao lado dela; um carro da CPU muito à frente recebe menos; os tetos são
  respeitados; o jogador nunca muda; na última volta, quem está na frente não alivia.
- Mira: com dois alvos ao alcance, a CPU prefere o que está mais bem colocado na corrida.
- Estilos: cada carro da CPU recebe um estilo, e a mesma semente sorteia os mesmos estilos.
- Se rodar rápido (poucos segundos), adicione um teste que roda algumas corridas com sementes diferentes, todos no
  piloto automático, e confere que a diferença entre o 1º e o 4º na chegada fica abaixo de um limite. Esse é o teste
  que mede a reclamação do usuário. Diga ao usuário qual limite você escolheu e por quê.
- Os testes que já existem continuam passando, incluindo os de desvio de tiro. `npm test` e `npm run build`
  passando.

## Escopo

- `src/sim/ai.js`.
- `src/config.js`: `DIFFICULTIES` e novos blocos para o elástico e os estilos.
- `src/sim/car.js`: só o multiplicador do elástico em `drive()`.
- `src/sim/race.js`: só se precisar da distância até a referência ou de sortear os estilos.
- Testes novos (por exemplo `tests/ai.test.js`).

Não mexa em pistas, telas, armas nem modelos de carro: são outras tarefas.
