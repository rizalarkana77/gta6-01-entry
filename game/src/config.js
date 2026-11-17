// SOLMAR HEAT — tuning constants.
// A sun-soaked coastal city, top-down. All distances in world pixels, all
// times in seconds, all speeds in pixels per second.

export const CONFIG = {
  // City layout: 9x9 blocks, roads between them, beach + water on the east.
  COLS: 9,
  ROWS: 9,
  BLOCK: 120, // block side
  ROAD: 40, // road width
  PITCH: 160, // BLOCK + ROAD
  WORLD_W: 1600, // city (1480) + beach (72) + water (48)
  WORLD_H: 1480,
  BEACH_X: 1480,
  WATER_X: 1552,

  // Player on foot.
  WALK_SPEED: 175,
  RUN_SPEED: 265,
  PLAYER_RADIUS: 11,
  PLAYER_MAX_HEALTH: 100,

  // Driving.
  CAR_ACCEL: 430,
  CAR_BRAKE: 700,
  CAR_REVERSE_MAX: 190,
  CAR_MAX_SPEED: 540,
  CAR_TURN: 2.7, // radians per second at full steer
  CAR_DRAG: 0.55, // per-second speed decay when coasting
  CAR_RADIUS: 15,

  // Traffic + pedestrians.
  TRAFFIC_COUNT: 14,
  PED_COUNT: 26,
  PARKED_COUNT: 6,
  TRAFFIC_SPEED: 150,
  PED_SPEED: 52,

  // Combat.
  PUNCH_RANGE: 34,
  PUNCH_DAMAGE: 34,
  PUNCH_COOLDOWN: 0.38,
  BULLET_SPEED: 760,
  BULLET_RANGE: 520,
  BULLET_DAMAGE: 34,
  FIRE_COOLDOWN: 0.22,
  START_AMMO: 24,
  AMMO_PICKUP: 24,
  HEALTH_PICKUP: 40,

  // Wanted + police.
  MAX_WANTED: 5,
  MAX_POLICE: 4,
  WANTED_DECAY_DELAY: 10, // seconds quiet before heat starts falling
  WANTED_DECAY_RATE: 9, // heat points per second
  POLICE_RAM_DAMAGE_FOOT: 20,
  POLICE_RAM_DAMAGE_CAR: 6,
  BUST_HOLD_TIME: 1.2, // seconds a cop must stay close on foot to bust you

  // Story: Jax Moreno owes Sal $50,000.
  DEBT_TOTAL: 50000,
  MISSION_PAYOUTS: [8000, 14000, 28000],
  CASH_BAG_COUNT: 5,

  // Camera + minimap.
  VIEW_W: 1280,
  VIEW_H: 720,
  MINIMAP_SIZE: 168,

  SAVE_KEY: 'solmar-heat-save-v1',
};

// Road centre line for road index i (0..9) in either axis.
export function roadCenter(i) {
  return i * CONFIG.PITCH + CONFIG.ROAD / 2;
}

// Centre of block (col, row), both 0..8.
export function blockCenter(col, row) {
  return {
    x: CONFIG.ROAD + col * CONFIG.PITCH + CONFIG.BLOCK / 2,
    y: CONFIG.ROAD + row * CONFIG.PITCH + CONFIG.BLOCK / 2,
  };
}

// Is this point on a road (either a vertical or a horizontal road)?
export function onRoad(x, y) {
  const mx = ((x % CONFIG.PITCH) + CONFIG.PITCH) % CONFIG.PITCH;
  const my = ((y % CONFIG.PITCH) + CONFIG.PITCH) % CONFIG.PITCH;
  return mx < CONFIG.ROAD || my < CONFIG.ROAD;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a toward angle b.
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
