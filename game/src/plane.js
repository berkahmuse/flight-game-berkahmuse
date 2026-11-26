// Island Hopper — the bush plane itself: one scalar speed along the pitch axis,
// throttle, flaps, gear, fuel and damage. No DOM here: step() is pure sim, so the
// autopilot in shots.js and a Node test harness can drive it exactly like the game.
import { GRAVITY, LANDING, PLANE } from './config.js';

export const GEAR_UP = 0;
export const GEAR_DOWN = 1;

export function createPlane(x, y) {
  return {
    x, y,
    speed: 0,
    pitch: 0,
    throttle: 0,
    flaps: false,
    gear: GEAR_DOWN,
    fuel: PLANE.fuelStart,
    damage: 0,
    airborne: false,
    heading: 90,
  };
}

/**
 * Advance the plane one fixed step. `control` is { pitch: -1..1, throttle: 0..1,
 * flaps, gear, brakes }, `wind` is headwind (+) / tailwind (-) in m/s, `ground`
 * is the terrain height under the plane, `turbulence` a small pitch disturbance.
 * Returns an event string: '' | 'takeoff' | 'touchdown' | 'hard' | 'crash'.
 */
export function stepPlane(plane, dt, control, wind, ground, turbulence) {
  plane.throttle = Math.max(0, Math.min(1, control.throttle));
  plane.flaps = !!control.flaps;
  plane.gear = control.gear ? GEAR_DOWN : GEAR_UP;

  const stall = plane.flaps ? PLANE.stallSpeedFlaps : PLANE.stallSpeed;

  // Pitch chases the stick; turbulence rattles it a little in a squall.
  const rate = control.pitch > 0 ? PLANE.pitchUpRate : PLANE.pitchDownRate;
  const target = control.pitch > 0
    ? PLANE.maxPitchUp * control.pitch
    : PLANE.maxPitchDown * -control.pitch;
  plane.pitch += (target - plane.pitch) * Math.min(1, rate * dt * 2.2);
  if (turbulence) plane.pitch += turbulence * dt * 0.35;
  plane.pitch = Math.max(PLANE.maxPitchDown, Math.min(PLANE.maxPitchUp, plane.pitch));

  // Speed along the nose: thrust minus drag minus the climb penalty.
  let drag = PLANE.dragCoefficient;
  if (plane.flaps) drag += PLANE.flapDrag;
  if (plane.gear === GEAR_DOWN && plane.airborne) drag += PLANE.gearDrag;
  const thrust = plane.throttle * PLANE.maxThrustAccel;
  plane.speed += (thrust - drag * plane.speed * plane.speed - GRAVITY * Math.sin(plane.pitch)) * dt;
  if (!plane.airborne && control.brakes) plane.speed -= 14 * dt;
  if (plane.speed < 0) plane.speed = 0;
  if (plane.speed > PLANE.maxSpeed) plane.speed = PLANE.maxSpeed;

  // Fuel burns with the throttle; an empty tank glides.
  if (plane.fuel > 0) {
    plane.fuel -= (PLANE.fuelBurnBase + PLANE.fuelBurnThrottle * plane.throttle) * dt;
    if (plane.fuel <= 0) {
      plane.fuel = 0;
      plane.throttle = 0;
    }
  }

  const stalled = plane.airborne && plane.speed < stall;
  let vx = Math.cos(plane.pitch) * plane.speed + wind;
  let vy = Math.sin(plane.pitch) * plane.speed;
  if (stalled) {
    vy -= 6; // a stalled wing quits flying: sink now, nose drops below
    plane.pitch -= 0.25 * dt;
  }
  if (!plane.airborne) {
    // Rolling on the strip: follow the ground, no climb until rotation speed.
    plane.y = ground;
    vy = 0;
    if (plane.speed >= PLANE.rotateSpeed && plane.pitch > 0.05) {
      plane.airborne = true;
      plane.y = ground + 0.5;
      return 'takeoff';
    }
  }

  plane.x += vx * dt;
  plane.y += vy * dt;

  // Touchdown: the ground decides whether it was a landing, a hard one or a crash.
  if (plane.airborne && plane.y <= ground) {
    plane.y = ground;
    const vs = -vy;
    const pitchDeg = Math.abs((plane.pitch * 180) / Math.PI);
    const onWater = ground <= 0.5;
    if (onWater) return 'crash';
    if (plane.gear === GEAR_UP) return 'crash';
    if (vs > LANDING.hardVs || pitchDeg > LANDING.maxPitchDeg + 6) return 'crash';
    plane.airborne = false;
    plane.pitch = 0;
    if (vs > LANDING.smoothVs) {
      plane.damage += PLANE.damageHardLanding;
      if (plane.damage >= 100) return 'crash';
      return 'hard';
    }
    return 'touchdown';
  }
  return '';
}

/** Score for a touchdown: soft and near the strip centre pays best. */
export function landingScore(vs, offsetFromCentre, stripHalfLength) {
  const soft = Math.max(0, 1 - vs / LANDING.hardVs);
  const centred = Math.max(0, 1 - Math.abs(offsetFromCentre) / Math.max(1, stripHalfLength));
  return Math.round(LANDING.scoreSoft * soft + LANDING.scoreCentre * centred);
}
