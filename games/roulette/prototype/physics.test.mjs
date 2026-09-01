import assert from 'node:assert/strict';
import { FIXED_STEP, POCKETS, RoulettePhysics } from './roulette-physics.js';

function run(seed) {
  const simulation = new RoulettePhysics();
  simulation.start(seed);
  let steps = 0;
  while (simulation.running && steps < 3000) { simulation.step(FIXED_STEP); steps++; }
  return { result: simulation.result, steps, ball: { ...simulation.ball }, wheel: { ...simulation.wheel } };
}

for (const seed of [1, 0x12345678, 0xFFFFFFFF]) {
  const first = run(seed);
  const second = run(seed);
  assert.ok(POCKETS.includes(first.result), `seed ${seed} must finish in a valid pocket`);
  assert.equal(first.result, second.result, `seed ${seed} result must be deterministic`);
  assert.equal(first.steps, second.steps, `seed ${seed} duration must be deterministic`);
  assert.deepEqual(first.ball, second.ball, `seed ${seed} final ball state must be deterministic`);
  assert.deepEqual(first.wheel, second.wheel, `seed ${seed} final wheel state must be deterministic`);
}

console.log('roulette physics deterministic tests passed');
