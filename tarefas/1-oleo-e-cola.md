# Tarefa 1: óleo e cola

Leia antes `tarefas/regras.md`. Esta tarefa pode começar agora.

## O pedido do usuário

> No óleo, o carro perde 100% da tração durante 1,5 segundos.
> Na cola, o carro freia 100% e fica só com 30% da velocidade máxima até atravessar a cola.
> Lembrando que quando perde a tração, também perde velocidade.

## Como está hoje

- Óleo: 20% da tração por 1,2 s.
- Cola: velocidade máxima em 45% por 2,5 s depois do último contato.
- Arquivos: `EFFECTS` em `src/config.js`, `drive()` em `src/sim/car.js`, `applyEffect` e `updatePuddles` em
  `src/sim/weapons.js`.

## O que fazer

### Óleo

- A tração vai a zero por 1,5 s: o pneu não segura nada de lado.
- O carro continua deslizando na direção em que vinha. O volante ainda gira a carroceria, mas volante, acelerador e
  freio não mudam a trajetória enquanto o efeito durar. O giro de escorregão que já existe continua.
- Sem tração, ele também perde velocidade: enquanto desliza no óleo, a velocidade vai caindo. Hoje a perda de
  velocidade na derrapagem (`scrub`) depende da tração, então com tração zero ela some. Precisa de uma regra própria,
  com o valor em `EFFECTS.oil`.
- A contagem do tempo continua como hoje: renova enquanto o carro estiver em cima da mancha.

### Cola

- No primeiro contato com a cola, o carro para na hora (velocidade zero).
- Enquanto estiver em cima da mancha, a velocidade máxima é 30% da velocidade máxima do carro (`EFFECTS.glue`).
  O nitro não passa desse limite.
- Saiu da mancha, volta ao normal na hora. Não sobra tempo de efeito depois de sair.
- Atenção: a parada total só acontece na entrada. Se ela acontecesse a cada passo em cima da cola, o carro ficaria
  preso para sempre.
- O aviso "COLA!" no HUD e o evento `status` continuam saindo uma vez a cada entrada.

### CPU

A CPU já desvia de manchas. Confira pelo código que ela consegue atravessar a cola a 30% sem travar.

## Testes

Atualize os testes de óleo e cola em `tests/weapons.test.js`:

- Óleo: a velocidade lateral não é anulada; o carro perde velocidade durante o efeito; o efeito acaba depois de 1,5 s.
- Cola: entrar zera a velocidade; em cima da mancha, o carro não passa de 30% da máxima, mesmo acelerando e mesmo
  com nitro; depois de sair, passa de 30%; acelerando, ele atravessa a mancha inteira sem ficar preso.
- `npm test` e `npm run build` passando.

## Escopo

`src/config.js` (só `EFFECTS`), `src/sim/car.js` (`drive`), `src/sim/weapons.js` (manchas e efeitos),
`src/render/hud.js` só se o aviso precisar, e `tests/weapons.test.js`.

Não mexa em carros, pistas nem telas: são outras tarefas.
