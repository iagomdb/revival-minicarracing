/**
 * Sintetizador com Web Audio: todos os sons são gerados na hora, sem arquivos.
 * Só pode começar depois de um clique ou tecla (regra dos navegadores), por isso o `init()`.
 */
export function createSynth() {
  let ctx = null, master = null, noiseBuf = null, engineOsc = null, engineGain = null;

  return {
    muted: false,

    init() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);

        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        // Motor: dente de serra abafado, com o tom acompanhando a velocidade.
        engineOsc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 50;
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineGain.gain.value = 0;
        engineOsc.connect(filter).connect(engineGain).connect(master);
        engineOsc.start();
      } catch {
        ctx = null;
      }
    },

    tone(freq, dur, type, vol, endFreq = null, delay = 0) {
      if (!ctx || this.muted) return;
      const t = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    noise(dur, vol, cutoff) {
      if (!ctx || this.muted) return;
      const t = ctx.currentTime, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      src.buffer = noiseBuf;
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(master);
      src.start(t, Math.random() * 0.4, dur + 0.05);
    },

    engine(on, ratio) {
      if (!engineGain) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on && !this.muted ? 0.06 : 0, t, 0.05);
      engineOsc.frequency.setTargetAtTime(45 + ratio * 120, t, 0.05);
    },
  };
}
