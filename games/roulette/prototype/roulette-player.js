import { FIXED_STEP } from './roulette-physics.js';

export function randomSeed() {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0];
}

export class RoulettePlayer {
  constructor({ physics, renderer, onFrame, onResult }) {
    this.physics = physics;
    this.renderer = renderer;
    this.onFrame = onFrame;
    this.onResult = onResult;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.lastResult = null;
    this.frameId = null;
    this.tick = this.tick.bind(this);
  }

  start() { if (this.frameId === null) this.frameId = requestAnimationFrame(this.tick); }
  stop() { if (this.frameId !== null) cancelAnimationFrame(this.frameId); this.frameId = null; }
  spin(seed = randomSeed()) { this.accumulator = 0; this.lastResult = null; return this.physics.start(seed); }
  spinAt(seed, elapsedSeconds = 0) {
    let state=this.spin(seed), steps=Math.floor(Math.max(0,Math.min(20,elapsedSeconds))/FIXED_STEP);
    while(steps-->0&&!state.finished) state=this.physics.step(FIXED_STEP);
    return state;
  }
  replay() { return this.physics.seed === null ? null : this.spin(this.physics.seed); }
  reset() { this.accumulator = 0; this.lastResult = null; return this.physics.reset(); }

  tick(now) {
    this.accumulator += Math.min(.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    while (this.accumulator >= FIXED_STEP) { this.physics.step(FIXED_STEP); this.accumulator -= FIXED_STEP; }
    const state = this.physics.snapshot();
    this.renderer.draw(state);
    this.onFrame?.(state);
    if (state.finished && state.result !== this.lastResult) { this.lastResult = state.result; this.onResult?.(state); }
    this.frameId = requestAnimationFrame(this.tick);
  }
}
