// Pista do deserto. Os pontos de controle são suavizados com Catmull-Rom,
// e a largada fica no ponto de índice `startAt` (meio da reta de baixo).
export default {
  id: 'deserto',
  name: 'Deserto',
  ground: 'sand',
  scale: 1.3,
  startAt: 1,
  points: [
    [500, 1400], [1000, 1420], [1500, 1400], [1950, 1300], [2180, 1020], [2150, 650], [1850, 420], [1450, 430],
    [1200, 650], [900, 600], [700, 380], [420, 330], [220, 560], [300, 880], [620, 1000], [420, 1220],
  ],
};
