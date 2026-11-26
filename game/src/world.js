// Island Hopper — the archipelago: four islands, three legs, checkpoint rings,
// rain squalls and wind, all drawn from one seed. The world owns the sim state
// (plane, leg, score, time, messages) and steps it in fixed 1/60 s slices.
import { ISLANDS, LANDING, PLANE, RINGS_PER_LEG, RING_RADIUS, STEP } from './config.js';
import { createPlane, landingScore, stepPlane } from './plane.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_TAKEOFF = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASH = 8;
export const EVENT_COMPLETE = 16;
export const EVENT_FUEL_EMPTY = 32;

export const LEG_NAMES = ['Koral Bay', 'Palm Cay', 'Turtle Reef', 'Sunset Atoll'];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createWorld(random) {
  // Jitter the published layout a little per seed, keeping runways reachable.
  const islands = ISLANDS.map((base, i) => {
    const jitter = i === 0 ? 0 : random.range(-110, 110);
    const runway = {
      start: base.runway.start + jitter,
      end: base.runway.end + jitter,
    };
    return {
      name: base.name,
      centre: base.centre + jitter,
      height: base.height + random.range(-3, 3),
      halfWidth: base.halfWidth + random.range(-40, 40),
      runway,
      runwayCentre: (runway.start + runway.end) / 2,
    };
  });

  // One rain squall per gap between islands, drifting slowly east, biased
  // toward the far island so the weather sits near land, not empty sea.
  const squalls = [];
  for (let leg = 0; leg < 3; leg += 1) {
    const from = islands[leg].runway.end;
    const to = islands[leg + 1].runway.start;
    squalls.push({
      start: from + (to - from) * random.range(0.55, 0.75),
      width: random.range(320, 520),
      drift: random.range(1.5, 3.5),
      seed: random.range(0, 100),
    });
  }

  // Low reef islets in the gaps: no strips, just sand, grass and a palm or two,
  // so no stretch of sea is ever empty and a low flyer has something to hit.
  const islets = [];
  for (let leg = 0; leg < 3; leg += 1) {
    const from = islands[leg].runway.end;
    const to = islands[leg + 1].runway.start;
    for (const f of [0.3, 0.65]) {
      islets.push({
        centre: from + (to - from) * f + random.range(-80, 80),
        height: random.range(4, 7),
        halfWidth: random.range(60, 110),
      });
    }
  }

  // Three rings per leg, strung between the strips at flyable heights.
  const rings = [];
  for (let leg = 0; leg < 3; leg += 1) {
    const from = islands[leg].runway.end;
    const to = islands[leg + 1].runway.start;
    for (let n = 0; n < RINGS_PER_LEG; n += 1) {
      const f = (n + 1) / (RINGS_PER_LEG + 1);
      // The last ring of a leg sits low, so the pilot is already on the glide
      // slope when the strip comes into view.
      const height = n === RINGS_PER_LEG - 1
        ? 95 + random.range(0, 35)
        : 120 + random.range(0, 110) + (n === 1 ? 40 : 0);
      rings.push({
        leg,
        x: from + (to - from) * f + random.range(-60, 60),
        y: height,
        radius: RING_RADIUS,
        hit: false,
      });
    }
  }

  const world = {
    islands,
    islets,
    squalls,
    rings,
    random,
    state: null,
  };

  world.reset = function reset() {
    const home = islands[0];
    world.state = {
      plane: createPlane(home.runway.start + 20, runwayHeight(home)),
      leg: 0,
      score: 0,
      ringsHit: 0,
      time: 0,
      legTime: 0,
      elapsed: 0,
      crashed: false,
      complete: false,
      landedLeg: false,
      crashReason: '',
      message: '',
      messageAt: 0,
      vs: 0,
      lastTouchdown: null,
      fuelEmptyAnnounced: false,
    };
    world.state.plane.y = runwayHeight(home);
    return world.state;
  };

  function runwayHeight(island) {
    return island.height;
  }

  /** Terrain height in metres at world x: sea is 0, islands are smooth bumps. */
  world.terrainHeight = function terrainHeight(x) {
    let height = 0;
    for (const bump of [...islands, ...islets]) {
      const d = Math.abs(x - bump.centre);
      if (d >= bump.halfWidth) continue;
      // A plateau across the runway, falling away in smooth shoulders.
      const plateau = smoothstep(bump.halfWidth, bump.halfWidth * 0.55, d);
      const edge = 1 - smoothstep(bump.halfWidth * 0.55, bump.halfWidth, d);
      height = Math.max(height, bump.height * (plateau * 0.75 + edge * 0.25));
    }
    // Flatten the strip itself so takeoffs and landings roll true.
    for (const island of islands) {
      if (x >= island.runway.start - 30 && x <= island.runway.end + 30) {
        const edge = smoothstep(30, 0, Math.min(Math.abs(x - island.runway.start), Math.abs(x - island.runway.end)));
        height = Math.max(height, island.height * (0.4 + 0.6 * edge));
        if (x >= island.runway.start && x <= island.runway.end) height = island.height;
      }
    }
    return height;
  };

  world.runwayAt = function runwayAt(x) {
    for (let i = 0; i < islands.length; i += 1) {
      const r = islands[i].runway;
      if (x >= r.start && x <= r.end) return { island: islands[i], index: i };
    }
    return null;
  };

  /** Headwind (+) in m/s: a slow sea breeze plus gusts, stronger up high. */
  world.windAt = function windAt(x, y, t) {
    const base = 3.5 + 2.5 * Math.sin(x * 0.0009 + 1.3) + 1.5 * Math.sin(x * 0.0031 + t * 0.11);
    const gust = 2.2 * Math.sin(t * 0.7 + x * 0.002 + Math.sin(t * 0.23) * 2);
    const altFactor = 1 + Math.min(1, y / 300) * 0.6;
    let wind = (base + gust) * altFactor;
    if (world.inSquall(x, t)) wind += 6 * Math.sin(t * 1.7 + x * 0.01);
    return wind;
  };

  world.inSquall = function inSquall(x, t) {
    for (const squall of squalls) {
      const start = squall.start + squall.drift * t;
      if (x >= start && x <= start + squall.width) return squall;
    }
    return null;
  };

  world.nextRing = function nextRing() {
    const { leg } = world.state;
    for (const ring of rings) {
      if (ring.leg === leg && !ring.hit) return ring;
    }
    return null;
  };

  world.nextTarget = function nextTarget() {
    const ring = world.nextRing();
    if (ring) return { x: ring.x, y: ring.y, kind: 'ring' };
    // Past the last leg the route is done: the final strip stays the target.
    const island = islands[Math.min(world.state.leg + 1, islands.length - 1)];
    return { x: island.runwayCentre, y: island.height, kind: 'runway' };
  };

  function announce(state, text) {
    state.message = text;
    state.messageAt = state.elapsed;
  }

  /**
   * Step the sim. `control` is the pilot input (see plane.js). Returns an event
   * bitmask; the caller reads world.state for the details.
   */
  world.step = function step(dt, control) {
    const state = world.state;
    if (state.crashed || state.complete) return EVENT_NONE;
    state.elapsed += dt;
    state.legTime += dt;
    state.time += dt;

    const plane = state.plane;
    const ground = world.terrainHeight(plane.x);
    const squall = world.inSquall(plane.x, state.elapsed);
    const wind = world.windAt(plane.x, plane.y, state.elapsed);
    const turbulence = squall ? Math.sin(state.elapsed * 9 + squall.seed) * 0.9 : 0;
    const vsBefore = plane.y;
    const result = stepPlane(plane, dt, control, wind, ground, turbulence);
    state.vs = (plane.y - vsBefore) / dt;

    let events = EVENT_NONE;
    if (plane.fuel <= 0 && !state.fuelEmptyAnnounced) {
      state.fuelEmptyAnnounced = true;
      announce(state, 'Fuel empty — glide her in!');
      events |= EVENT_FUEL_EMPTY;
    }

    // Rings: fly through the glowing hoop, bank the points.
    for (const ring of rings) {
      if (ring.leg !== state.leg || ring.hit) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (dx * dx + dy * dy < ring.radius * ring.radius && plane.airborne) {
        ring.hit = true;
        state.ringsHit += 1;
        state.score += LANDING.ringScore;
        announce(state, `Ring! +${LANDING.ringScore} pts`);
        events |= EVENT_RING;
      }
    }

    if (result === 'takeoff') {
      announce(state, 'Airborne — gear up, flaps up, climb away.');
      events |= EVENT_TAKEOFF;
    } else if (result === 'touchdown' || result === 'hard') {
      const strip = world.runwayAt(plane.x);
      const vs = Math.max(0, -state.vs);
      if (strip && strip.index === state.leg + 1) {
        const island = strip.island;
        const pts = landingScore(vs, plane.x - island.runwayCentre, (island.runway.end - island.runway.start) / 2);
        state.score += pts;
        plane.fuel = Math.min(100, plane.fuel + PLANE.fuelRefillOnLanding);
        const bonus = Math.max(0, Math.round((90 - state.legTime) * LANDING.legTimeBonusPerSec));
        state.score += bonus;
        state.lastTouchdown = { vs, points: pts, timeBonus: bonus, hard: result === 'hard' };
        state.leg += 1;
        state.legTime = 0;
        state.landedLeg = true;
        if (state.leg >= 3) {
          state.complete = true;
          announce(state, `Route complete! Final score ${state.score}.`);
          events |= EVENT_COMPLETE;
        } else {
          announce(state, `Down safe on ${island.name} — +${pts} landing, +${bonus} time. Fuel topped up.`);
          events |= EVENT_LANDED;
        }
      } else if (strip) {
        announce(state, 'Wrong strip — that is not your destination. Take off and carry on.');
      } else {
        // Rough field: the plane survives, badly shaken.
        plane.damage += PLANE.damageRoughField;
        if (plane.damage >= 100) {
          state.crashed = true;
          state.crashReason = 'Rough-field landing tore the undercarriage off.';
          events |= EVENT_CRASH;
        } else {
          announce(state, 'Rough landing off the strip — airframe damaged. Get airborne again.');
          events |= EVENT_LANDED;
        }
      }
    } else if (result === 'crash') {
      state.crashed = true;
      if (ground <= 0.5) state.crashReason = 'Ditched in the sea.';
      else if (plane.gear === 0) state.crashReason = 'Belly landing — gear was up.';
      else if (plane.damage >= 100) state.crashReason = 'Airframe gave up after too much damage.';
      else state.crashReason = 'Came down too hard on the ground.';
      events |= EVENT_CRASH;
    }
    return events;
  };

  world.reset();
  return world;
}
