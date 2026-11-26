// Island Hopper — tuning constants. One clear job: every number the sim and the
// renderer agree on lives here, so a balance change is a one-line edit.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
/** Pixels per metre on screen. 1280 px shows 800 m of sky, 720 px shows 450 m. */
export const SCALE = 1.6;
export const GRAVITY = 9.81;
export const KNOTS_PER_MS = 1.94384;
export const FEET_PER_M = 3.28084;

/** Bush-plane flight model (arcade, scalar speed along the pitch axis). */
export const PLANE = {
  maxThrustAccel: 17.0,
  dragCoefficient: 0.0028,
  stallSpeed: 24.0,
  stallSpeedFlaps: 19.0,
  rotateSpeed: 27.0,
  maxSpeed: 78.0,
  pitchUpRate: 0.9,
  pitchDownRate: 1.1,
  maxPitchUp: 0.61, // ~35 deg
  maxPitchDown: -0.44, // ~-25 deg
  stallSink: 7.0,
  flapDrag: 0.0016,
  gearDrag: 0.0004,
  fuelBurnBase: 0.22,
  fuelBurnThrottle: 0.68,
  fuelStart: 100,
  fuelRefillOnLanding: 55,
  damageHardLanding: 34,
  damageRoughField: 55,
};

export const LANDING = {
  smoothVs: 3.5,
  hardVs: 6.0,
  maxPitchDeg: 12,
  scoreSoft: 500,
  scoreCentre: 150,
  ringScore: 100,
  legTimeBonusPerSec: 4,
};

/** The archipelago. Centres and runway spans are jittered by the seed in world.js. */
export const ISLANDS = [
  { name: 'Koral Bay', centre: 0, height: 30, halfWidth: 620, runway: { start: 180, end: 470 } },
  { name: 'Palm Cay', centre: 3300, height: 26, halfWidth: 540, runway: { start: 3150, end: 3430 } },
  { name: 'Turtle Reef', centre: 6600, height: 34, halfWidth: 580, runway: { start: 6450, end: 6740 } },
  { name: 'Sunset Atoll', centre: 9900, height: 28, halfWidth: 560, runway: { start: 9760, end: 10050 } },
];
export const RINGS_PER_LEG = 3;
export const RING_RADIUS = 30;

/** Golden-hour palette, one style for sky, sea, land and the plane. */
export const PALETTE = {
  skyTop: '#2e6fb0',
  skyMid: '#7fb6d9',
  skyLow: '#ffd9a0',
  sun: '#fff3c4',
  seaDeep: '#0e6f8e',
  seaShallow: '#2ec4b6',
  sand: '#f2d8a0',
  grass: '#4da34d',
  jungle: '#2f7a3d',
  rock: '#8a7a66',
  runway: '#3c3f4a',
  runwayLine: '#f5f0dc',
  planeBody: '#e8503a',
  planeWing: '#f4f1e6',
  planeTrim: '#ffd166',
};
