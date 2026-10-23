// Câmera que segue o carro com suavidade, olhando um pouco à frente, e treme nas explosões.
export function createCamera() {
  return {
    x: 0, y: 0, shake: 0,

    snap(target) {
      this.x = target.x;
      this.y = target.y;
      this.shake = 0;
    },

    follow(target, dt) {
      if (target) {
        const k = 1 - Math.exp(-5 * dt);
        this.x += (target.x + target.vx * 0.35 - this.x) * k;
        this.y += (target.y + target.vy * 0.35 - this.y) * k;
      }
      this.shake *= Math.exp(-6 * dt);
    },

    kick(amount) {
      this.shake = Math.max(this.shake, amount);
    },
  };
}
