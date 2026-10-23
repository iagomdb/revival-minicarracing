@echo off
rem Abre o Minicar Racing no navegador. Na primeira vez instala as dependencias.
rem Deixe esta janela aberta enquanto joga; fechar a janela desliga o jogo.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, so na primeira vez...
  call npm install
)
call npm run dev
