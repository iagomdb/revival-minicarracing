// Todos os números ajustáveis do jogo num lugar só.
// Os marcados com "original" vêm do manual de Asphalt Duell (1999).

export const STEP = 1 / 120;          // passo fixo da simulação (s)
export const TOTAL_LAPS = 3;
export const COUNTDOWN = 3;           // segundos de semáforo
export const GRID_SIZE = 8;           // carros por corrida (original)

export const TRACK_HALF = 70;         // meia largura da pista (px)
export const TRACK_SPACING = 10;      // distância entre os pontos da linha central (px)
export const WALL_MARGIN = 11;        // o centro do carro para a esta distância da mureta

// Cada carro tem pontos nos 4 medidores da loja original. Os upgrades somam pontos:
// motor → velocidade e aceleração, pneus → tração, blindagem → blindagem (até 5 níveis cada).
// `slots`: quantas armas cabem. Na frente, 1 ou 2 (teclas Arma 1 e Arma 2); traseira e extra, 0 ou 1.
// `price`: preço na concessionária do campeonato. A tela Equipar mostra os carros nesta ordem.
export const CAR_MODELS = {
  micro: {
    name: 'Micro', info: 'Equilibrado e firme nas curvas', price: 10500,
    points: { speed: 5, accel: 5, traction: 7, armor: 5 }, slots: { front: 1, rear: 1, extra: 1 },
  },
  flecha: {
    name: 'Flecha', info: 'O mais rápido, mas demora a embalar e derrapa', price: 11000,
    points: { speed: 8, accel: 3, traction: 3, armor: 5 }, slots: { front: 1, rear: 1, extra: 1 },
  },
  arsenal: {
    name: 'Arsenal', info: 'Duas armas na frente, mas derrapa mais', price: 14000,
    points: { speed: 5, accel: 5, traction: 4, armor: 5 }, slots: { front: 2, rear: 1, extra: 1 },
  },
};
export const DEFAULT_CAR = 'micro';
export const UPGRADE_MAX = 5;

// Melhorias da loja do campeonato. O nível N custa `base × N` (o motor: 800, 1.600 ... 4.000), e cada
// nível soma 1 ponto ao modelo (`carPoints`, em src/sim/stats.js).
export const UPGRADES = {
  engine: { name: 'Motor', info: '+1 de velocidade e +1 de aceleração', base: 800 },
  tires:  { name: 'Pneus', info: '+1 de tração', base: 500 },
  armor:  { name: 'Blindagem', info: '+1 de blindagem', base: 400 },
};

// Quanto vale cada ponto na física: valor = base + perPoint × pontos.
// A tração é diferente: conta o que sobra dela em relação à velocidade, porque mais velocidade pede mais pneu.
// Aderência = base + perPoint × (tração − velocidade), nunca abaixo de `min`. Com tração igual à velocidade
// o carro fica equilibrado; com velocidade acima da tração ele derrapa até ganhar pneu.
export const POINT_VALUES = {
  speed:    { base: 300, perPoint: 26 },             // velocidade máxima (px/s)
  accel:    { base: 200, perPoint: 26 },             // aceleração (px/s²)
  traction: { base: 800, perPoint: 100, min: 200 },  // força lateral máxima do pneu, parado (px/s²)
  armor:    { base: 60,  perPoint: 8 },              // pontos de vida
};

export const HANDLING = {
  brake: 720, reverse: 160,     // px/s², px/s
  gripLoss: 0.25,               // fração da tração perdida na velocidade gripLossSpeed
  gripLossSpeed: 600,           // px/s
  turnRate: 3.2,                // giro máximo do volante (rad/s), em velocidade média
  turnRateLossAtTop: 0.25,      // o volante fica um pouco mais "pesado" na velocidade máxima
  minTurnRadius: 40,            // em baixa velocidade o carro faz curva como carro, sem girar no eixo (px)
  scrub: 0.7,                   // quanto a derrapagem freia o carro
};

// Catálogo de armas. Dano em pontos de vida. `ammo` é a munição por volta de cada unidade: recarrega ao
// cruzar a linha de chegada, sem acumular (original). `price`: preço de uma unidade na loja do campeonato.
// Tiros: speed (px/s, somada à do carro) ou carSpeed (vezes a velocidade máxima do carro que atira, sem nitro
// e sem somar nada), life (s), radius (distância de acerto), push (fração da velocidade do tiro que empurra o alvo).
export const WEAPONS = {
  laser: {
    slot: 'front', name: 'Laser', ammo: 4, price: 400, cooldown: 0.3, info: 'Dois lasers paralelos a cada disparo',
    // twin: cada disparo solta dois lasers paralelos, `twin` px para cada lado do centro; cada um dá o dano todo.
    shot: { speed: 1050, life: 0.5, damage: 35, radius: 17, push: 0.04, twin: 6 },
  },
  mg: {
    slot: 'front', name: 'Metralhadora', ammo: 26, price: 700, cooldown: 0.07, spread: 0.06, info: 'Rajada: segure para atirar',
    // 26 × 5 = 130 na rajada toda. `life` alto: na prática a bala só some ao bater na mureta ou num carro.
    shot: { speed: 1250, life: 4, damage: 5, radius: 15, push: 0.01 },
  },
  rocket: {
    slot: 'front', name: 'Foguete', ammo: 2, price: 1000, cooldown: 0.6, info: 'Lento, reto e devastador',
    shot: { carSpeed: 1.9, life: 1.4, damage: 60, radius: 19, push: 0.3 },
  },
  // bounce: quica na mureta em vez de sumir; some só depois de `life` s ou ao acertar alguém.
  // hitsOwnerAfter: depois de tantos segundos, acerta também quem atirou.
  plasma: {
    slot: 'front', name: 'Plasma', ammo: 2, price: 800, cooldown: 0.6, info: 'Quica nas paredes e acerta qualquer um, até você',
    shot: { carSpeed: 1.5, life: 10, damage: 40, radius: 16, push: 0.1, bounce: true, hitsOwnerAfter: 0.3 },
  },
  mine: {
    slot: 'rear', name: 'Mina', ammo: 2, price: 500, cooldown: 0.6, info: 'Explode e joga o carro longe',
    mine: { damage: 45, push: 200, spin: true },
  },
  emp: {
    slot: 'rear', name: 'Mina PEM', ammo: 2, price: 650, cooldown: 0.6, info: 'Inverte a direção de quem passa',
    mine: { damage: 15, push: 60, effect: 'emp' },
  },
  oil: {
    slot: 'rear', name: 'Óleo', ammo: 2, price: 350, cooldown: 0.6, info: 'Quem passa por cima derrapa',
    puddle: { effect: 'oil' },
  },
  glue: {
    slot: 'rear', name: 'Cola', ammo: 2, price: 400, cooldown: 0.6, info: 'Quem passa por cima fica lento',
    puddle: { effect: 'glue' },
  },
  nitro: { slot: 'extra', name: 'Nitro', ammo: 1, price: 600, cooldown: 0, info: 'Velocidade máxima por um instante; na cola, sai mais rápido' },
};
// Equipamento padrão. Carro com 1 arma de frente leva só a primeira; um encaixe vazio ou inválido
// é preenchido com a primeira arma desta lista que ainda não estiver no carro.
export const DEFAULT_LOADOUT = { front: ['laser', 'mg'], rear: 'mine', extra: 'nitro' };
// Unidades da mesma arma num encaixe (os 5 LEDs da loja original). Cada unidade soma `ammo` por volta.
export const UNIT_MAX = 5;

export const MINES = { arm: 0.7, radius: 22, max: 30 };              // armam 0,7 s depois de soltas
export const PUDDLES = { arm: 0.7, radius: 28, life: 20, max: 20 };  // manchas duram 20 s
export const EFFECTS = {
  emp:  { duration: 2 },               // direção invertida
  // Óleo: dura `duration` s desde a entrada na mancha. Tração zero no começo; nos últimos `recover` s
  // ela volta aos poucos. Sem tração o carro desliza reto perdendo `slowdown` px/s a cada segundo
  // e gira para um lado sorteado (`spin`: entre os dois valores, em rad/s).
  oil:  { duration: 2, recover: 1, slowdown: 150, spin: [1, 2] },
  // Cola: só em cima da mancha. Para na entrada e fica com 30% da velocidade máxima; com nitro, 75%.
  glue: { speed: 0.3, nitroSpeed: 0.75 },
};
export const NITRO = { duration: 1.6, speed: 1.45, accel: 2.2 };

export const WALL_DAMAGE = { threshold: 70, factor: 0.07, accident: 140 };
export const BUMP_DAMAGE = { threshold: 90, factor: 0.05 };
export const RESPAWN = { delay: 2.2, invulnerable: 1.5 };
export const KILL_CREDIT_WINDOW = 4;  // segundos em que o último a acertar leva o abate

export const PRIZES = [2000, 1400, 1000, 800, 600, 300, 100, 0];  // prêmio por posição (original)
export const MONEY = { bag: 100, kill: 150 };                     // original
export const PICKUPS = { bags: 12, repairAt: [0.3, 0.62, 0.86], repairRespawn: 15, radius: 24 };

// speed: ritmo da CPU · aggro: vontade de atirar · dodge: chance de perceber um tiro e desviar
export const DIFFICULTIES = {
  facil:   { speed: 0.85, aggro: 0.25, dodge: 0.3 },
  medio:   { speed: 0.93, aggro: 0.5,  dodge: 0.6 },
  dificil: { speed: 1.0,  aggro: 1.0,  dodge: 0.9 },
};

// Campeonato. Carro, arma ou melhoria vendida devolve `resale` do preço (original: metade).
// `qualify`: quantos primeiros passam para o próximo campeonato, por dificuldade (original).
// `cpuUnits`: unidades de cada arma da CPU, por dificuldade (a CPU não compra nada).
// Carro novo vem com 1 unidade de `starterWeapon` na Arma 1, incluída no preço.
export const CAREER = {
  startMoney: 12000,
  resale: 0.5,
  points: [10, 8, 6, 5, 4, 3, 2, 1],
  qualify: { facil: 4, medio: 3, dificil: 3 },
  cpuUnits: { facil: 1, medio: 2, dificil: 3 },
  starterWeapon: 'laser',
};
// As pistas de cada campeonato, na ordem das corridas (ids de src/sim/tracks/). O original corria cada
// pista duas vezes: para isso, é só repetir os ids.
export const CHAMPIONSHIPS = [
  { id: 'camp1', name: 'Campeonato 1', tracks: ['oito', 'deserto', 'serpente', 'escada', 'triangulo'] },
];

// Perfis de comportamento da CPU. Os perfis se revezam entre os carros da CPU, numa ordem sorteada a cada
// corrida, e a dificuldade vale por cima. Cada número multiplica o jeito padrão da IA (1 = igual):
// aggro: vontade de atirar · hunt: quanto muda de faixa para alinhar atrás do alvo · rear: vontade de usar a
// arma traseira · dodge: chance de perceber um tiro · bias: quanto anda fora do traçado · corner: quão perto
// do limite do pneu faz as curvas · block: quanto fecha a faixa de quem vem atrás (0 = nunca).
export const AI_STYLES = {
  agressivo: { name: 'Agressivo', aggro: 1.5, hunt: 1.5, rear: 1,   dodge: 0.8, bias: 1,   corner: 1,    block: 0 },
  piloto:    { name: 'Piloto',    aggro: 0.7, hunt: 0,   rear: 0.6, dodge: 1,   bias: 0.3, corner: 1.03, block: 0 },
  defensivo: { name: 'Defensivo', aggro: 0.8, hunt: 0.5, rear: 2,   dodge: 1.3, bias: 1,   corner: 1,    block: 1 },
};
// Quanto da largura útil da pista o traçado da CPU usa para abrir as curvas (1 = de mureta a mureta, 0 = pelo meio).
export const RACING_LINE = { width: 0.5 };

export const AI_NAMES = ['Rico Scholetti', 'Kurt Kowalski', 'Speedy Buzz', 'Apache Indy', 'Sammy Mosh', 'Jack Artigun', 'John McFlame']; // original
export const AI_COLORS = ['#2f7de1', '#f2c230', '#3cb371', '#9b59b6', '#f08a24', '#1fb5b5', '#e84393'];
export const PLAYER = { name: 'Você', color: '#e8392b' };
export const DEMO_EXTRA = { name: 'Opfer', color: '#e8392b' };   // "Opfer" é o nome do jogador no print do manual
