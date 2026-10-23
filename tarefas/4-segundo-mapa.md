# Tarefa 4: segundo mapa novo

Leia antes `tarefas/regras.md`. Só comece depois que a tarefa 2 terminar: ela cria o registro de pistas e a escolha de
pista.

O usuário manda o desenho do mapa (imagem ou descrição) junto com esta tarefa. Se ele não mandou, peça antes de
começar.

## O que fazer

- Crie um arquivo novo em `src/sim/tracks/` no formato das outras pistas.
- Coloque a pista no registro, depois do Oito e do Deserto, a não ser que o usuário peça outra ordem.
- Siga o desenho: proporções, sentido da volta e lugar da largada. Ajuste só o necessário para as curvas serem
  possíveis de fazer de carro, e diga ao usuário o que você ajustou.
- Se o desenho tiver cruzamento, use o que a tarefa 2 fez no Oito.
- Se o desenho tiver ponte, com um trecho passando por cima de outro, avise o usuário antes de fazer: ponte ainda não
  existe no jogo.
- Se a tarefa 2 criou temas de chão, dê um tema próprio a esta pista.
- Os testes que rodam em todas as pistas precisam passar com a pista nova. `npm test` e `npm run build` passando.

## Escopo

`src/sim/tracks/` e, se precisar, os testes. Não mexa nas outras pistas.
