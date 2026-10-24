# Tarefa 6: O primeiro campeonato

Leia antes `tarefas/regras.md`. Pode rodar junto com a tarefa 5: as duas mexem em `config.js`, então só edições
pontuais lá.

## O pedido do usuário

> Acho que já dá pra preparar o primeiro campeonato.
>
> Dinheiro inicial 12 mil.
>
> Carro 1 = 10500, carro 2 = 11000, carro 3 = 14000.

## Como era no original

Do manual do *Mini Car Racing*:

- O campeonato é dividido em ligas. Cada liga tem várias corridas, e é preciso ficar entre os primeiros para passar
  para a próxima liga.
- Antes de começar, o jogador escolhe a dificuldade. No fácil passam os 4 primeiros; no médio e no difícil, os 3
  primeiros.
- No começo, o dinheiro só dá para comprar os carros mais baratos. Dá para trocar de carro entre as corridas, e o
  carro velho é vendido pela metade do preço.

Esta tarefa faz só o **Campeonato 1**. A loja de armas e melhorias (motor, pneus, blindagem) é a tarefa 7, que
roda depois desta. Aqui as armas continuam de graça na tela Equipar, como hoje. Deixe o estado do campeonato fácil
de ampliar: a tarefa 7 vai guardar nele as armas compradas e os níveis de melhoria do carro.

## Números (em `src/config.js`)

- Dinheiro inicial: **$ 12.000**.
- Preço dos carros, na ordem de `CAR_MODELS`: Micro **$ 10.500**, Flecha **$ 11.000**, Arsenal **$ 14.000**.
  Com $ 12.000 dá para comprar o Micro (sobram $ 1.500) ou o Flecha (sobram $ 1.000), mas não o Arsenal.
- Carro vendido devolve **metade do preço**: Micro $ 5.250, Flecha $ 5.500, Arsenal $ 7.000.
- Campeonato 1: as 5 pistas, uma vez cada, na ordem do menu: `oito`, `deserto`, `serpente`, `escada`, `triangulo`.
  Deixe a lista de pistas no config, para que repetir pistas (o original corria cada pista duas vezes) seja só mudar
  a lista.
- Pontos por posição: 10, 8, 6, 5, 4, 3, 2, 1.
- Dinheiro por corrida: o que a tela de resultado já mostra, ou seja, o prêmio da posição (`PRIZES`) mais os sacos
  de dinheiro e os abates (`car.extras`).

## Como funciona

### Menu

- O menu ganha **Campeonato**. A corrida rápida que existe hoje continua igual: escolhe pista, escolhe carro de
  graça e não mexe em nada do campeonato.
- Se existir um campeonato salvo, aparece **Continuar campeonato**. **Novo campeonato** com um save existente pede
  confirmação antes de apagar.

### Começo

1. O jogador escolhe a dificuldade (`facil`, `medio`, `dificil` de `DIFFICULTIES`). Ela vale para o campeonato todo.
2. **Concessionária:** os 3 carros com preço, pontos (velocidade, aceleração, tração, blindagem) e espaços de arma.
   O dinheiro do jogador fica visível. O carro que ele não pode pagar aparece apagado e não deixa comprar.
3. Comprou, vai para a garagem.

### Garagem (entre as corridas)

- Mostra o dinheiro, o carro atual, a próxima corrida ("Corrida 2 de 5 · Deserto") e a classificação: posição, nome,
  pontos, com o jogador destacado.
- **Correr:** vai para a tela Equipar, que já existe, com o carro do jogador travado (sem trocar de carro ali). As
  armas continuam de graça, limitadas pelos espaços do carro. Depois vem a corrida.
- **Trocar de carro:** abre a concessionária mostrando quanto o carro atual vale na venda. Comprar outro carro vende
  o atual na mesma hora. Só deixa comprar se dinheiro + valor de venda ≥ preço do novo. Não dá para comprar o carro
  que ele já tem. O jogador nunca fica sem carro.
- O carro começa toda corrida consertado. Conserto não custa nada.

### Corrida

- Os 7 adversários são sempre os mesmos durante o campeonato (`AI_NAMES`, mesmas cores). Cada um tem um modelo de
  carro sorteado no começo do campeonato e fica com ele até o fim.
- A corrida usa a dificuldade escolhida no começo.
- Se der para abandonar a corrida no meio, a corrida não conta: o jogador volta para a garagem e corre a mesma pista
  de novo.

### Depois de cada corrida

- A tela de resultado que já existe aparece como hoje. Ao sair dela, o jogador recebe o dinheiro, todos recebem os
  pontos da posição, e o jogo salva e volta para a garagem.
- A CPU não tem dinheiro: só pontos.

### Fim do campeonato

- Depois da última corrida, aparece a classificação final.
- Ordem de desempate: mais pontos, depois mais vitórias, depois melhor posição na última corrida.
- Se o jogador ficou entre os 3 primeiros (4 no fácil): "Classificado para o Campeonato 2!". Ainda não existe
  Campeonato 2, então a mensagem fala que ele vem em breve. Se não ficou: "Não foi dessa vez" e um botão para
  tentar de novo.
- No fim, o save é apagado.

### Save

- Fica no `localStorage`, numa chave só, com um número de versão.
- Leitura e escrita dentro de `try/catch`. Um save que falta, está corrompido ou é de outra versão é tratado como
  "sem campeonato salvo", sem quebrar o jogo.
- Salva quando o campeonato começa, depois de cada corrida e depois de trocar de carro.

## Arquitetura

- As regras do campeonato ficam num módulo puro, sem tela nem `localStorage`, por exemplo
  `src/career/championship.js`: criar o campeonato, comprar e trocar de carro, registrar o resultado de uma corrida,
  montar a classificação, dizer se acabou e se o jogador se classificou. Tudo testável no Node.
- O acesso ao `localStorage` fica separado, por exemplo `src/career/storage.js`.
- As telas novas (concessionária, garagem, classificação final) seguem o jeito de `src/ui/screens.js`. Se esse
  arquivo ficar grande demais, crie um arquivo novo em `src/ui/` em vez de inchar ele.
- `src/sim/` não sabe que existe campeonato: a corrida recebe pista, carros e dificuldade como já recebe hoje.
- Dinheiro na tela sempre como `$ 12.000`, com ponto separando os milhares. Faça um formatador e use também na tela
  de resultado.

## Testes (em `tests/championship.test.js`)

- Começa com $ 12.000. Pode comprar o Micro (sobram $ 1.500) e o Flecha (sobram $ 1.000). Não pode comprar o Arsenal.
- Troca: com o Micro e $ 8.750, pode trocar pelo Arsenal e fica com $ 0. Com $ 8.749, não pode. Não pode "trocar"
  pelo carro que já tem.
- Registrar uma corrida dá os pontos certos por posição e soma prêmio + extras ao dinheiro do jogador.
- Classificação: ordem por pontos, e o desempate por vitórias e depois pela última corrida.
- Depois da 5ª corrida, o campeonato acabou. Classificado em 3º no médio, sim; 4º no médio, não; 4º no fácil, sim.
- Os adversários e os carros deles são os mesmos do começo ao fim. A mesma semente dá os mesmos carros.
- Save: salvar e carregar devolve o mesmo campeonato. Texto corrompido ou versão diferente dá "sem save". Para testar
  sem navegador, a parte de storage recebe o `localStorage` (ou um objeto falso) como parâmetro.
- Os testes que já existem continuam passando. `npm test` e `npm run build` passando.

## Escopo

- Novo: `src/career/` e `tests/championship.test.js`.
- `src/config.js`: preço em cada carro de `CAR_MODELS`, e um bloco novo com dinheiro inicial, fração de revenda,
  pontos e a lista de campeonatos.
- `src/ui/` (telas novas, e a tela Equipar com o carro travado no campeonato), `src/game.js`, `index.html` e
  `src/styles.css`: só edições pontuais.
- `README.md`: explique o modo campeonato e a pasta nova.

Não mexa na física, na IA, nas armas nem nas pistas.
