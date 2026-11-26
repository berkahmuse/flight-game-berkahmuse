// Island Hopper — the screenshot scenes behind ?shot=start|play|storm|end.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (pitch toward the next ring or the strip,
// throttle to hold a target speed, flaps and gear on final, flare over the
// numbers), so the frame is what a real flight looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { EVENT_COMPLETE, EVENT_CRASH, EVENT_LANDED } from './world.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 46;
const STORM_SECONDS = 52;
const END_LIMIT_SECONDS = 900;
const SAMPLE = STEP;

/**
 * stepPlane reads control.pitch as a fraction of the maximum pitch, so the
 * pilot converts an absolute wanted pitch (radians) into that fraction here.
 */
function pitchCommand(wantPitch) {
  const fraction = wantPitch >= 0 ? wantPitch / 0.61 : wantPitch / 0.44;
  return Math.max(-1, Math.min(1, fraction));
}

/** A steady hand: nose at the next target, speed held, glide slope to the strip. */
export function autopilot(world) {
  const state = world.state;
  const plane = state.plane;
  const target = world.nextTarget();
  const ground = world.terrainHeight(plane.x);
  const control = { pitch: 0, throttle: 0.75, flaps: false, gear: true, brakes: false };
  const dx = target.x - plane.x;
  const dy = target.y - plane.y;

  // On the ground: full throttle, rotate once fast enough.
  if (!plane.airborne) {
    control.throttle = 1;
    control.pitch = plane.speed > 24 ? 0.8 : 0;
    control.gear = true;
    return control;
  }

  if (target.kind === 'runway') {
    const island = world.islands[state.leg + 1];
    const distToThreshold = island.runway.start - plane.x;
    const onFinal = distToThreshold < 2000 && distToThreshold > -700;
    if (onFinal) {
      control.flaps = true;
      control.gear = true;
      const targetSpeed = 30;
      if (distToThreshold <= 0) {
        // Over the strip: sink at a steady rate, then hold off in the last few
        // metres so the wheels kiss the numbers instead of floating past them.
        const heightAbove = plane.y - ground;
        const vsDes = heightAbove < 3 ? -1.0 : -2.6;
        const wantPitch = Math.asin(Math.max(-0.4, Math.min(0.4, vsDes / Math.max(20, plane.speed))));
        control.pitch = pitchCommand(wantPitch);
        control.throttle = 0.15;
      } else {
        // Ride a ~4 degree glide slope down to the threshold: the sink rate
        // follows the slope (feedforward) plus a correction for the error.
        const heightAboveRunway = plane.y - island.height;
        const desiredHeight = 2 + distToThreshold * 0.075;
        const vx = Math.max(20, plane.speed);
        const vsDes = Math.max(-8.5, Math.min(2.5, -vx * 0.075 + (desiredHeight - heightAboveRunway) * 0.4));
        const wantPitch = Math.asin(Math.max(-0.4, Math.min(0.4, vsDes / Math.max(20, plane.speed))));
        control.pitch = pitchCommand(wantPitch);
        if (plane.speed > targetSpeed + 4) control.throttle = 0.15;
        else if (plane.speed < targetSpeed - 3) control.throttle = 0.6;
        else control.throttle = 0.3;
      }
      return control;
    }
  }

  // En route: nose at the next ring (or the strip, from far out), speed held.
  const targetSpeed = 52;
  control.throttle = Math.max(0.25, Math.min(1, 0.55 + (targetSpeed - plane.speed) * 0.05));
  control.flaps = plane.speed < 30;
  control.pitch = pitchCommand(Math.atan2(dy, dx));
  return control;
}

function flyFor(world, seconds, pilot) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const events = world.step(SAMPLE, pilot(world));
    if (events & EVENT_CRASH) return 'crash';
    if (events & EVENT_COMPLETE) return 'complete';
    if (events & EVENT_LANDED) return 'landed';
  }
  return 'flying';
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { pitch: 0, throttle: 0.25, flaps: false, gear: true, brakes: false });
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    flyFor(world, PLAY_SECONDS, autopilot);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'storm') {
    // Fly until the plane is inside the first squall, then hold the frame there.
    for (let i = 0; i < STORM_SECONDS / STEP; i += 1) {
      const outcome = flyFor(world, SAMPLE, autopilot);
      if (outcome !== 'flying') break;
      if (world.inSquall(world.state.plane.x, world.state.elapsed)) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // end: fly the whole route; a hurried pilot may crash, so the frame shows the
  // result honestly — complete when the route is flown, over when it is not.
  let outcome = 'flying';
  for (let i = 0; i < END_LIMIT_SECONDS / STEP && outcome === 'flying'; i += 1) {
    outcome = flyFor(world, SAMPLE, autopilot);
    if (outcome === 'landed') outcome = 'flying';
  }
  if (outcome === 'complete' || world.state.complete) return { screen: SCREEN_COMPLETE, best: world.state.score };
  return { screen: SCREEN_OVER, best: world.state.score };
}
