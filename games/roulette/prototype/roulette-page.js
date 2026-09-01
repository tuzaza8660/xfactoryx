import { RoulettePhysics } from './roulette-physics.js';
import { RoulettePlayer } from './roulette-player.js';
import { RouletteRenderer } from './roulette-renderer.js';

const $ = id => document.getElementById(id);
const physics = new RoulettePhysics();
const renderer = new RouletteRenderer($('roulette'));
const player = new RoulettePlayer({
  physics,
  renderer,
  onFrame: updatePanel,
  onResult: state => { $('result').textContent = `RESULT  ·  ${state.result}`; $('state').textContent = `POCKET ${state.result}`; },
});

function phaseLabel(state) {
  if (!state.running) return state.finished ? `POCKET ${state.result}` : 'READY';
  const { ball } = state;
  if (ball.z > 2) return 'AIRBORNE';
  if (ball.r > 277) return 'OUTER TRACK';
  if (ball.r > 240) return 'DEFLECTING';
  if (ball.r < 200) return 'INNER ROTOR';
  return 'POCKET RING';
}

function updatePanel(state) {
  $('wheelSpeed').textContent = `${state.wheel.v.toFixed(2)} rad/s`;
  $('ballSpeed').textContent = `${(Math.abs(state.ball.va) * state.ball.r).toFixed(0)} px/s`;
  if (!state.finished) $('state').textContent = phaseLabel(state);
}

$('spin').addEventListener('click', () => {
  const state = player.spin();
  $('seed').textContent = state.seed.toString(16).padStart(8, '0').toUpperCase();
  $('result').textContent = 'BALL IN OUTER TRACK';
});
$('replay').addEventListener('click', () => {
  const state = player.replay();
  if (state) { $('seed').textContent = state.seed.toString(16).padStart(8, '0').toUpperCase(); $('result').textContent = 'REPLAYING SAME SEED'; }
});
$('reset').addEventListener('click', () => { player.reset(); $('seed').textContent = '—'; $('result').textContent = 'SPIN을 눌러 시작하세요'; $('state').textContent = 'READY'; });

renderer.draw(physics.snapshot());
player.start();
