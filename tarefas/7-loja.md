# Tarefa 7: Loja de armas e melhorias

Leia antes `tarefas/regras.md`. Só comece depois que as tarefas 5 e 6 terminarem. Esta tarefa usa o campeonato da
tarefa 6 (dinheiro, garagem, save) e mexe nos pontos do carro, que a tarefa 5 também tocou.

> **Mudança de física pedida pelo usuário (não desfaça):** a tração agora conta em relação à velocidade.
> Aderência = 800 + 100 × (tração − velocidade), nunca abaixo de 200 (`POINT_VALUES.traction` e `deriveStats`).
> Carro equilibrado (tração = velocidade) tem a mesma aderência em qualquer nível; motor sem pneu tira aderência.
> É de propósito: "quem tem mais velocidade e menos tração precisa comprar pneu primeiro". Testes da loja que
> esperam a aderência subir junto com a velocidade precisam seguir essa regra.

## O pedido do usuário

> As armas vão ganhar até 5 slots e vão custar dinheiro também.

O usuário explicou que são **5 slots da mesma arma para cada "equip"**: cada lugar de arma do carro (frente 1,
frente 2, traseira, extra) recebe um tipo de arma, e ela pode ser comprada até 5 vezes. Ele também pediu que
**motor, pneus e blindagem** entrem na loja agora, com 5 níveis cada.

## Como era no original

Do manual do *Mini Car Racing*:

- Embaixo de cada item há cinco LEDs, e cada compra acende um. São no máximo 5 compras por item.
- A munição depende de quanto se compra. Na Turbo Blaster, cada compra dá mais 10 tiros. A munição enche de novo a
  cada volta.
- Vender devolve só metade do que custou.
- Motor dá velocidade e aceleração, pneus dão tração e blindagem protege. O carro já vem com a versão básica dos três.

## Armas

- Cada lugar de arma tem um tipo de arma e de 0 a 5 unidades dela. Zero unidades é lugar vazio.
- Cada unidade multiplica a munição base da arma (`ammo` em `WEAPONS`). Laser ×3 dá 12 tiros, Metralhadora ×2 dá
  40 e Nitro ×2 dá 2 nitros. Fora isso, nada muda: dano, cadência e o jeito de recarregar continuam como hoje.
- Os dois lugares da frente do Arsenal podem ter a mesma arma.
- **Comprar uma unidade** custa o preço da arma. **Vender uma unidade** devolve metade.
- Escolher outra arma para um lugar que já tem unidades vende as antigas (metade) e compra 1 unidade da nova. Só deixa
  se o dinheiro der.
- As armas ficam no carro de uma corrida para a outra. Não é preciso comprar de novo.
- Carro novo vem com 1 Laser na frente 1, incluído no preço. Os outros lugares vêm vazios.

Preço por unidade (definido pelo usuário, em `WEAPONS` no config):

| Arma | Preço |
|---|---|
| Laser | $ 400 |
| Metralhadora | $ 700 |
| Foguete | $ 1.000 |
| Plasma | $ 800 |
| Mina | $ 500 |
| Mina PEM | $ 650 |
| Óleo | $ 350 |
| Cola | $ 400 |
| Nitro | $ 600 |

Com o Micro sobram $ 1.500, que dão certinho para +1 Laser, 1 Mina e 1 Nitro. Com o Flecha sobram $ 1.000, que dão
para +1 Laser e 1 Nitro, ou +1 Laser e 1 Mina.

## Melhorias

- Motor, pneus e blindagem vão do nível 0 (o básico, que já vem no carro) ao 5.
- Cada nível soma pontos ao modelo do carro:
  - **Motor:** +1 de velocidade e +1 de aceleração.
  - **Pneus:** +1 de tração.
  - **Blindagem:** +1 de blindagem.
- O nível N custa `base × N`: motor base $ 800, pneus $ 500, blindagem $ 400. O motor sai por $ 800, $ 1.600, $ 2.400,
  $ 3.200 e $ 4.000.
- Vender um nível devolve metade do preço daquele nível.
- Hoje os pontos vão até 8 (Flecha) ou 7 (tração do Micro). Com melhorias chegam a 13. A conta que transforma pontos
  em física precisa continuar fazendo sentido acima de 10: cada ponto a mais deixa o carro melhor, sem número absurdo
  e sem quebrar o modelo de aderência.

## Trocar de carro

Vender o carro devolve metade do preço dele, mais metade do que foi gasto nas armas e melhorias instaladas. Tudo vai
junto com o carro. A concessionária da tarefa 6 mostra esse valor total.

## Telas

- No campeonato, a tela **Equipar** vira a loja: dinheiro visível, cada lugar de arma com seus 5 LEDs e botões de
  comprar e vender, e as três melhorias também com 5 LEDs. Preço e efeito aparecem ao passar o mouse ou selecionar.
  O que não dá para pagar fica apagado.
- O jogo salva depois de cada compra ou venda.
- Na **corrida rápida**, tudo continua de graça: o jogador escolhe arma e quantidade (1 a 5) sem preço, e as melhorias
  ficam no nível 0.

## CPU

- A CPU não compra nada. No campeonato, cada carro da CPU tem o mesmo número de unidades em cada lugar: 1 no fácil,
  2 no médio e 3 no difícil (em `config.js`, junto de `DIFFICULTIES`).
- A CPU fica sem melhorias por enquanto. O elástico da tarefa 5 cuida do resto.

## Arquitetura

- As regras da loja ficam num módulo puro em `src/career/` (por exemplo `shop.js`): preço, comprar, vender, valor de
  revenda. Elas usam o estado de campeonato da tarefa 6.
- `src/sim/` não sabe de dinheiro. A corrida recebe, para cada carro, o modelo, as unidades de cada arma e os níveis
  de melhoria, e monta pontos e munição a partir disso.

## Testes (em `tests/shop.test.js`)

- Carro novo vem com 1 Laser e o resto vazio.
- Comprar uma unidade desconta o preço; vender devolve metade. Não passa de 5 unidades nem fica abaixo de 0. Sem
  dinheiro, não compra.
- Trocar a arma de um lugar vende as unidades antigas e compra 1 da nova.
- Munição na corrida = munição base × unidades.
- Melhorias: o nível 3 do motor custa $ 2.400. Cada nível aumenta os pontos certos. Não passa do 5. Vender devolve
  metade do preço do nível.
- Pontos para física: velocidade, aceleração e tração sobem a cada ponto até 13, sem dar `NaN`, `Infinity` nem número
  negativo.
- Valor de revenda do carro = metade do carro + metade do que foi instalado.
- CPU no campeonato recebe 1, 2 ou 3 unidades conforme a dificuldade.
- O save guarda e devolve armas e melhorias.
- Os testes que já existem continuam passando, incluindo `tests/championship.test.js`. `npm test` e `npm run build`
  passando.

## Escopo

- `src/career/` (novo `shop.js` e o que precisar no campeonato) e `tests/shop.test.js`.
- `src/config.js`: preços em `WEAPONS`, bloco das melhorias, unidades da CPU por dificuldade.
- A tela Equipar em `src/ui/` e a concessionária da tarefa 6.
- `src/sim/`: só onde o carro é montado (pontos, munição) para aceitar unidades e níveis. Nada de mexer em física de
  pista, IA ou armas em si.
- `README.md`: explique a loja.
