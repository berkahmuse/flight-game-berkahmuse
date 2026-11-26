// Island Hopper — procedural sound, no audio files: a WebAudio engine drone whose
// pitch follows the throttle, filtered-noise wind, and short blips for rings,
// touchdowns and crashes. Starts on the first user gesture; M toggles mute.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
      started = true;

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();

      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSource.start();
    } catch {
      ctx = null;
    }
  }

  function blip(frequency, duration, type, volume) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    update(throttle, speed, airborne, squall) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(48 + throttle * 95 + speed * 0.25, t, 0.08);
      engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.02 + throttle * 0.05, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0011 + (squall ? 0.05 : 0)), t, 0.15);
      windFilter.frequency.setTargetAtTime(380 + speed * 6, t, 0.2);
    },
    ring() {
      blip(880, 0.18, 'sine', 0.16);
      setTimeout(() => blip(1318, 0.22, 'sine', 0.12), 70);
    },
    touchdown() {
      blip(140, 0.16, 'triangle', 0.22);
    },
    crash() {
      blip(70, 0.5, 'sawtooth', 0.25);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sine', 0.14), i * 110));
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        const t = ctx.currentTime;
        if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : 0.05, t, 0.05);
        if (windGain) windGain.gain.setTargetAtTime(muted ? 0 : 0.03, t, 0.05);
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
