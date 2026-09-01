export const TAU = Math.PI * 2;
export const POCKETS = Object.freeze(['0','32','15','19','4','21','2','25','17','34','6','27','13','36','11','30','8','23','10','5','24','16','33','1','20','14','31','9','22','18','29','7','28','12','35','3','26']);
export const RED_NUMBERS = new Set(['32','19','21','25','34','27','36','30','23','5','16','1','14','9','18','7','12','3']);
export const FIXED_STEP = 1 / 120;
export const POCKET_STEP = TAU / POCKETS.length;

export function wrapAngle(angle) { return (angle % TAU + TAU) % TAU; }
function signedAngle(angle) { return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI; }

export function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function makePhysics(seed) {
  const next = seededRng(seed ^ 0xA5314C7D);
  return {
    trackFriction: .76 + next() * .52,
    pocketFriction: .72 + next() * .62,
    outerSlope: .75 + next() * .54,
    innerSlope: .74 + next() * .58,
    innerThreshold: 28 + next() * 20,
    pinRestitution: Array.from({ length: 8 }, () => .25 + next() * .40),
    pinLift: Array.from({ length: 8 }, () => .72 + next() * .58),
    pinAngleOffset: Array.from({ length: 8 }, () => (next() - .5) * .042),
    wallKick: Array.from({ length: POCKETS.length }, () => (next() - .5) * 24),
  };
}

export class RoulettePhysics {
  constructor() { this.reset(); }

  reset() {
    this.seed = null;
    this.wheel = { a: 0, v: 0 };
    this.physics = makePhysics(0);
    this.ball = { r: 357, a: -0.65, vr: 0, va: 0, z: 0, vz: 0, age: 0, hits: 0, pinCooldown: 0, innerReturn: false, innerVisits: 0 };
    this.running = false;
    this.finished = false;
    this.result = null;
    return this.snapshot();
  }

  start(seed) {
    this.seed = seed >>> 0;
    const next = seededRng(this.seed);
    this.physics = makePhysics(this.seed);
    this.wheel = { a: next() * TAU, v: .92 + next() * 1.25 };
    this.ball = { r: 349 + next() * 16, a: next() * TAU, vr: -5 + next() * 10, va: -(4.05 + next() * 2.05), z: 0, vz: 0, age: 0, hits: 0, pinCooldown: 0, innerReturn: false, innerVisits: 0 };
    this.running = true;
    this.finished = false;
    this.result = null;
    return this.snapshot();
  }

  pocketAt(angle) {
    const local = wrapAngle(angle - this.wheel.a + POCKET_STEP / 2);
    return Math.floor(local / POCKET_STEP) % POCKETS.length;
  }

  step(dt = FIXED_STEP) {
    if (!this.running) return this.snapshot();
    const { ball, wheel, physics } = this;
    ball.age += dt;
    ball.pinCooldown = Math.max(0, ball.pinCooldown - dt);
    ball.vz -= 255 * dt;
    ball.z += ball.vz * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -24) ball.vz *= -.23;
      else ball.vz = 0;
    }
    const onTrack = ball.z < .5;
    wheel.a = wrapAngle(wheel.a + wheel.v * dt);
    wheel.v *= Math.exp(-.035 * dt);

    const descent = Math.max(0, ball.age - 2.0);
    if (onTrack) {
      if (ball.r > 277) ball.vr += (-2.3 * physics.outerSlope * descent - .20 * ball.vr) * dt;
      else if (ball.r > 242) ball.vr += (-10 * physics.innerSlope - .75 * ball.vr) * dt;
      else if (ball.r > 221) ball.vr += (-4.5 * physics.innerSlope - .9 * ball.vr) * dt;
      else if (ball.r < 205) ball.vr += ((205 - ball.r) * 1.65 - ball.vr * .65) * dt;
    }
    const surfaceFriction = ball.r > 278 ? physics.trackFriction : physics.pocketFriction;
    ball.va *= Math.exp(-(ball.r > 278 ? .17 : .42) * surfaceFriction * dt * (onTrack ? 1 : .12));

    if (ball.r > 367) { ball.r = 367; ball.vr = -Math.abs(ball.vr) * .40; }
    if (ball.r < 118) {
      ball.r = 118;
      ball.vr = Math.abs(ball.vr) * .48;
      ball.va = wheel.v + (ball.va - wheel.v) * .55;
      ball.vz = Math.max(ball.vz, 34);
      ball.innerReturn = true;
      ball.innerVisits++;
    }

    if (ball.r < 330 && ball.r > 262 && ball.z < 1.5 && ball.pinCooldown === 0) {
      for (let i = 0; i < 8; i++) {
        const pinA = i * TAU / 8 + .09 + physics.pinAngleOffset[i];
        const radial = ball.r - 302;
        const tangent = 302 * signedAngle(ball.a - pinA);
        const halfRadial = 17, halfTangent = 16;
        if (Math.abs(radial) / halfRadial + Math.abs(tangent) / halfTangent < 1 && ball.hits < 24) {
          let nr = (radial >= 0 ? 1 : -1) / halfRadial;
          let nt = (tangent >= 0 ? 1 : -1) / halfTangent;
          const nLength = Math.hypot(nr, nt); nr /= nLength; nt /= nLength;
          const vr = ball.vr, vt = ball.va * ball.r;
          const towardFace = vr * nr + vt * nt;
          if (towardFace < 0) {
            const restitution = physics.pinRestitution[i];
            ball.vr = vr - (1 + restitution) * towardFace * nr;
            ball.va = (vt - (1 + restitution) * towardFace * nt) / ball.r;
            ball.vz = Math.max(ball.vz, (76 + Math.min(56, Math.abs(towardFace) * .18)) * physics.pinLift[i]);
            ball.r += nr * 1.2;
            ball.a = wrapAngle(ball.a + nt * 1.2 / ball.r);
            ball.pinCooldown = .075;
            ball.hits++;
          }
          if (ball.pinCooldown > 0) break;
        }
      }
    }

    if (ball.r < 266 && ball.r > 211) {
      const phase = wrapAngle(ball.a - wheel.a);
      const wallAngle = (Math.floor(phase / POCKET_STEP) + .5) * POCKET_STEP;
      const boundary = Math.abs(signedAngle(phase - wallAngle));
      const relAngular = ball.va - wheel.v;
      if (boundary < .023 && Math.abs(relAngular) > .16) {
        ball.va = wheel.v - relAngular * .35;
        ball.vr += physics.wallKick[Math.floor(phase / POCKET_STEP) % POCKETS.length];
        ball.a += Math.sign(relAngular) * .018;
      }
    }

    ball.r += ball.vr * dt;
    ball.a = wrapAngle(ball.a + ball.va * dt);
    const relativeSpeed = Math.abs(ball.va - wheel.v);
    if (ball.r < 238 && ball.age > 4 && (ball.innerReturn || ball.vr > -physics.innerThreshold)) {
      const pocket = this.pocketAt(ball.a);
      const center = wheel.a + pocket * POCKET_STEP;
      const offset = signedAngle(ball.a - center);
      const relativeVa = ball.va - wheel.v;
      ball.vr += ((217 - ball.r) * 5.8 - ball.vr * 3.5) * dt;
      ball.va += (-42 * offset - relativeVa * 4.2) * dt;
      if (Math.abs(offset) < .006 && Math.abs(ball.r - 217) < .7 && Math.abs(ball.vr) < .7 && relativeSpeed < .12) this.finish(pocket);
    }
    if (ball.age > 18) this.finish(this.pocketAt(ball.a));
    return this.snapshot();
  }

  finish(pocketIndex) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.result = POCKETS[pocketIndex];
  }

  snapshot() {
    return { seed: this.seed, wheel: this.wheel, ball: this.ball, physics: this.physics, running: this.running, finished: this.finished, result: this.result };
  }
}
