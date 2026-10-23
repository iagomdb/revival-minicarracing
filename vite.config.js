import { defineConfig } from 'vite';

export default defineConfig({
  // "./" deixa o build funcionar em qualquer subpasta (GitHub Pages, itch.io etc.).
  base: './',
  // `npm run dev` (e o jogar.bat) já abrem o jogo no navegador.
  server: { open: true },
});
