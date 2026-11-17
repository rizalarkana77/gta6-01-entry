// SOLMAR HEAT — the world: city generation, driving, traffic, pedestrians,
// police and wanted level, combat, the three story missions, pickups, and
// save/load. Pure logic on purpose: no DOM, no canvas, no audio here, so the
// whole game loop can run headless in Node for smoke tests. The browser side
// (main.js) only renders this state and feeds it input snapshots.

import {
  GRID, BLOCK, ROAD, PITCH, CITY, BEACH_W, WATER_X, WORLD_W, WORLD_H,
  roadCentre, WALK_SPEED, RUN_SPEED, PLAYER_R, PLAYER_MAX_HEALTH,
  CAR_MAX_SPEED, CAR_MAX_REVERSE, CAR_ACCEL, CAR_BRAKE, CAR_TURN, CAR_R,
  TRAFFIC_CARS, PED_COUNT, PARKED_CARS, TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX,
  PUNCH_RANGE, PUNCH_DAMAGE, PUNCH_COOLDOWN, PISTOL_DAMAGE, PISTOL_RANGE,
  PISTOL_COOLDOWN, START_AMMO, AMMO_PICKUP, MEDKIT_HEAL, WANTED_MAX,
  WANTED_DECAY_QUIET, WANTED_DECAY_STEP, POLICE_MAX, POLICE_SPEED, POLICE_HP,
  POLICE_RAM_DAMAGE, DEBT_TOTAL, MISSION_REWARDS, CASH_BAGS, AMMO_BOXES,
  MEDKITS, COLORS,
} from './config.js';
import { RNG } from './random.js';

const CAR_COLORS = ['#c94f3d', '#3d7ac9', '#e8c53d', '#7ac93d', '#c9c9c9', '#8f5fc9', '#3dc9b8', '#e87a3d'];
const PED_SHIRTS = ['#e8e8e8', '#3d7ac9', '#c94f3d', '#7ac93d', '#e8c53d', '#8f5fc9', '#e87a3d', '#3dc9b8'];

// Fixed story locations, derived from the block grid.
export const PLACES = {
  pawn: { x: 2 * PITCH + ROAD + BLOCK / 2, y: 2 * PITCH + ROAD + BLOCK / 2, label: 'Pawn Shop' },
  chop: { x: 6 * PITCH + ROAD + BLOCK / 2, y: 5 * PITCH + ROAD + BLOCK / 2, label: 'Chop Shop' },
  hideout: { x: 1 * PITCH + ROAD + BLOCK / 2, y: 7 * PITCH + ROAD + BLOCK / 2, label: 'Hideout' },
  docks: { x: CITY - 90, y: CITY - 130, label: 'Docks' },
  comet: { x: roadCentre(7) + 22, y: roadCentre(2) + 48, label: 'Comet GT' },
};
const BAG_SPOTS = [
  [1, 1], [7, 1], [1, 7], [8, 5], [4, 8],
].map(([i, j]) => ({ x: roadCentre(i), y: roadCentre(j) }));

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a toward angle b.
function turnToward(a, b, maxStep) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-maxStep, Math.min(maxStep, d));
}

// Push a circle out of a rectangle; returns the corrected centre.
function pushOutOfRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x: cx, y: cy, hit: false };
  if (d2 === 0) return { x: cx, y: cy - r, hit: true };
  const d = Math.sqrt(d2);
  return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true };
}

function resolveSolids(world, x, y, r) {
  let hit = false;
  for (const rect of world.solids) {
    const out = pushOutOfRect(x, y, r, rect);
    if (out.hit) {
      x = out.x;
      y = out.y;
      hit = true;
    }
  }
  return { x, y, hit };
}

function clampToWorld(x, y) {
  return {
    x: Math.max(12, Math.min(WORLD_W - 12, x)),
    y: Math.max(12, Math.min(WORLD_H - 12, y)),
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export function createWorld(seed) {
  const rng = new RNG(seed);
  const world = {
    seed,
    rng,
    time: 0,
    state: 'title', // title | playing | paused | busted | wasted | won
    money: 0,
    debt: DEBT_TOTAL,
    debtPaid: 0,
    ammo: START_AMMO,
    wanted: 0,
    crimeTimer: 999,
    quietTimer: 0,
    lastStarGain: -99,
    bustedTimer: 0,
    message: '',
    messageTimer: 0,
    events: [],
    particles: [],
    tracer: null,
    stats: { carsStolen: 0, shotsFired: 0, pedsDown: 0, missionsDone: 0 },
    solids: [],
    buildings: [],
    parks: [],
    trees: [],
    plazas: [],
    docks: [],
    blocks: [],
    traffic: [],
    parked: [],
    police: [],
    peds: [],
    ammoBoxes: [],
    medkits: [],
    comet: null,
    mission: { index: 0, stage: 'pickup', bagsGot: 0, bags: [] },
    player: {
      x: roadCentre(1), y: roadCentre(7), angle: -Math.PI / 2,
      health: PLAYER_MAX_HEALTH, car: null,
      punchCooldown: 0, shootCooldown: 0, lastCrash: -99,
    },
  };

  // --- City blocks ---------------------------------------------------------
  const storyBlocks = {
    '2,2': 'buildings', '6,5': 'buildings', '1,7': 'buildings',
    '8,8': 'docks', '7,2': 'plaza',
  };
  for (let bx = 0; bx < GRID; bx++) {
    for (let by = 0; by < GRID; by++) {
      const key = `${bx},${by}`;
      const kind = storyBlocks[key] ?? (rng.next() < 0.6 ? 'buildings' : rng.next() < 0.55 ? 'park' : 'plaza');
      const bx0 = bx * PITCH + ROAD;
      const by0 = by * PITCH + ROAD;
      world.blocks.push({ bx, by, kind, x: bx0, y: by0 });
      if (kind === 'buildings') {
        const margin = 16;
        const lot = (BLOCK - margin * 3) / 2;
        for (let lx = 0; lx < 2; lx++) {
          for (let ly = 0; ly < 2; ly++) {
            const jx = rng.range(-4, 4);
            const jy = rng.range(-4, 4);
            const rect = {
              x: bx0 + margin + lx * (lot + margin) + jx,
              y: by0 + margin + ly * (lot + margin) + jy,
              w: lot, h: lot, color: rng.pick(COLORS.buildingRoof),
            };
            world.buildings.push(rect);
            world.solids.push(rect);
          }
        }
      } else if (kind === 'park') {
        world.parks.push({ x: bx0, y: by0, w: BLOCK, h: BLOCK });
        const trees = rng.int(7, 12);
        for (let t = 0; t < trees; t++) {
          world.trees.push({
            x: bx0 + rng.range(18, BLOCK - 18),
            y: by0 + rng.range(18, BLOCK - 18),
            r: rng.range(9, 15),
          });
        }
      } else if (kind === 'plaza') {
        world.plazas.push({ x: bx0, y: by0, w: BLOCK, h: BLOCK });
      } else if (kind === 'docks') {
        // Wooden piers reaching toward the beach and the water.
        for (let p = 0; p < 3; p++) {
          const pier = { x: bx0 + 20, y: by0 + 18 + p * 52, w: BLOCK - 30, h: 26 };
          world.docks.push(pier);
          world.solids.push({ x: pier.x, y: pier.y, w: pier.w, h: 8 });
        }
      }
    }
  }

  // --- The Comet GT: the marked car for mission 2 --------------------------
  world.comet = {
    kind: 'comet', x: PLACES.comet.x, y: PLACES.comet.y,
    angle: Math.PI / 2, speed: 0, color: COLORS.comet, hp: 200,
  };

  // --- Parked cars ---------------------------------------------------------
  const usedSpots = new Set();
  for (let i = 0; i < PARKED_CARS; i++) {
    let road = rng.int(1, 8);
    let along = rng.range(120, CITY - 120);
    let guard = 0;
    while (usedSpots.has(`${road}:${Math.floor(along / 120)}`) && guard++ < 20) {
      road = rng.int(1, 8);
      along = rng.range(120, CITY - 120);
    }
    usedSpots.add(`${road}:${Math.floor(along / 120)}`);
    const horizontal = rng.chance(0.5);
    const side = rng.chance(0.5) ? 1 : -1;
    world.parked.push({
      kind: 'parked',
      x: horizontal ? along : roadCentre(road) + side * 20,
      y: horizontal ? roadCentre(road) + side * 20 : along,
      angle: horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0,
      color: rng.pick(CAR_COLORS),
      hp: 100,
    });
  }

  // --- Traffic -------------------------------------------------------------
  for (let i = 0; i < TRAFFIC_CARS; i++) {
    const horizontal = i % 2 === 0;
    const road = rng.int(1, 8);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(0, CITY);
    world.traffic.push({
      kind: 'traffic',
      axis: horizontal ? 'h' : 'v',
      road,
      dir,
      x: horizontal ? along : roadCentre(road) + (dir > 0 ? -14 : 14),
      y: horizontal ? roadCentre(road) + (dir > 0 ? 14 : -14) : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: rng.range(TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX),
      color: rng.pick(CAR_COLORS),
      hp: 100,
      turnCooldown: rng.range(1, 4),
    });
  }

  // --- Pedestrians ---------------------------------------------------------
  for (let i = 0; i < PED_COUNT; i++) {
    const p = makePed(world, rng);
    world.peds.push(p);
  }

  // --- Pickups -------------------------------------------------------------
  const spots = [];
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) spots.push({ x: roadCentre(i), y: roadCentre(j) });
  }
  rng.shuffle(spots);
  for (let i = 0; i < AMMO_BOXES; i++) {
    world.ammoBoxes.push({ ...spots[i], taken: false });
  }
  for (let i = 0; i < MEDKITS; i++) {
    world.medkits.push({ ...spots[AMMO_BOXES + i], taken: false });
  }

  setMissionTarget(world);
  return world;
}

function makePed(world, rng) {
  const road = rng.int(0, 9);
  const along = rng.range(40, CITY - 40);
  const horizontal = rng.chance(0.5);
  const x = horizontal ? along : roadCentre(road) + rng.range(-22, 22);
  const y = horizontal ? roadCentre(road) + rng.range(-22, 22) : along;
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
    state: 'walk', hp: 50, downTimer: 0, tx: x, ty: y,
    shirt: rng.pick(PED_SHIRTS), retarget: rng.range(2, 6),
  };
}

function randomRoadPoint(world) {
  const rng = world.rng;
  const horizontal = rng.chance(0.5);
  const road = rng.int(0, 9);
  const along = rng.range(40, CITY - 40);
  return horizontal
    ? { x: along, y: roadCentre(road) + rng.range(-22, 22) }
    : { x: roadCentre(road) + rng.range(-22, 22), y: along };
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export function missionTarget(world) {
  const m = world.mission;
  if (m.index === 0) {
    return m.stage === 'pickup'
      ? { ...PLACES.docks, label: 'Pick up the package at the Docks' }
      : { ...PLACES.pawn, label: 'Deliver the package to the Pawn Shop' };
  }
  if (m.index === 1) {
    return m.stage === 'steal'
      ? { ...PLACES.comet, label: 'Steal the Comet GT' }
      : { ...PLACES.chop, label: 'Deliver the Comet GT to the Chop Shop' };
  }
  if (m.index === 2) {
    if (m.stage === 'collect') {
      const next = m.bags.find((b) => !b.taken);
      return next
        ? { x: next.x, y: next.y, label: `Collect cash bags (${m.bagsGot}/${CASH_BAGS})` }
        : { ...PLACES.hideout, label: 'Return to the Hideout' };
    }
    return { ...PLACES.hideout, label: 'Return to the Hideout' };
  }
  return { ...PLACES.hideout, label: 'Debt paid — Solmar is yours' };
}

export function objectiveText(world) {
  const m = world.mission;
  if (m.index >= 3) return 'Debt paid. You won, Jax.';
  return `${m.index + 1}. ${['The Pickup', 'Hot Wheels', 'The Big Score'][m.index]} — ${missionTarget(world).label}`;
}

function setMissionTarget(world) {
  // Bags only exist once mission 3 starts; (re)build them then.
  if (world.mission.index === 2 && world.mission.bags.length === 0) {
    world.mission.bags = BAG_SPOTS.map((s) => ({ ...s, taken: false }));
  }
}

function showMessage(world, text, seconds = 4) {
  world.message = text;
  world.messageTimer = seconds;
}

function completeMission(world) {
  const reward = MISSION_REWARDS[world.mission.index];
  world.money += reward;
  world.debt = Math.max(0, world.debt - reward);
  world.debtPaid += reward;
  world.stats.missionsDone++;
  world.events.push({ type: 'cash' });
  world.events.push({ type: 'mission' });
  showMessage(world, `Job done — $${reward.toLocaleString('en-US')} from Sal's crew`, 5);
  world.mission.index++;
  world.mission.stage = world.mission.index === 0 ? 'pickup' : world.mission.index === 1 ? 'steal' : 'collect';
  world.mission.bagsGot = 0;
  if (world.mission.index === 2) setMissionTarget(world);
  if (world.mission.index >= 3) {
    world.state = 'won';
    world.events.push({ type: 'won' });
    showMessage(world, 'Debt paid. Solmar City is yours, Jax.', 8);
  }
}

function addWanted(world, stars, major = false) {
  world.crimeTimer = 0;
  world.quietTimer = 0;
  if (!major && world.time - world.lastStarGain < 2) return;
  if (world.wanted < WANTED_MAX) {
    world.wanted = Math.min(WANTED_MAX, world.wanted + stars);
    world.lastStarGain = world.time;
  }
}

function spawnParticles(world, x, y, color, count, speed = 160) {
  for (let i = 0; i < count; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: world.rng.range(0.4, 0.9), maxLife: 0.9, color, size: world.rng.range(2, 5),
    });
  }
}

// ---------------------------------------------------------------------------
// Entering / exiting cars
// ---------------------------------------------------------------------------

function nearestEnterableCar(world, maxDist) {
  const p = world.player;
  let best = null;
  let bestD = maxDist;
  const candidates = [...world.parked, world.comet, ...world.traffic];
  for (const car of candidates) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(world, car) {
  const p = world.player;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  car.speed = 0;
  world.events.push({ type: 'door' });
  if (car.kind === 'traffic') {
    // Jacking a driven car: the driver bails and the law notices.
    world.stats.carsStolen++;
    addWanted(world, 2, true);
    showMessage(world, 'You jacked a moving car — the cops saw that', 4);
    spawnParticles(world, car.x, car.y, '#e8e8e8', 6, 90);
    world.traffic = world.traffic.filter((c) => c !== car);
    car.kind = 'parked';
    world.parked.push(car);
  } else if (car.kind === 'parked') {
    world.stats.carsStolen++;
    showMessage(world, 'Car taken — no one saw a thing', 3);
  } else if (car.kind === 'comet') {
    world.stats.carsStolen++;
    if (world.mission.index === 1 && world.mission.stage === 'steal') {
      world.mission.stage = 'deliver';
      showMessage(world, 'Comet GT secured — take it to the Chop Shop', 5);
      world.events.push({ type: 'mission' });
    } else {
      showMessage(world, 'The Comet GT — Sal will want this back', 3);
    }
  }
}

function exitCar(world) {
  const p = world.player;
  const car = p.car;
  if (!car) return;
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  const fixed = resolveSolids(world, sideX, sideY, PLAYER_R);
  const clamped = clampToWorld(fixed.x, fixed.y);
  p.x = clamped.x;
  p.y = clamped.y;
  p.angle = car.angle;
  p.car = null;
  car.speed = 0;
  world.events.push({ type: 'door' });
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

function doPunch(world) {
  const p = world.player;
  if (p.punchCooldown > 0 || p.car) return;
  p.punchCooldown = PUNCH_COOLDOWN;
  world.events.push({ type: 'punch' });
  let best = null;
  let bestD = PUNCH_RANGE;
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d >= bestD) continue;
    const facing = Math.cos(angleTo(p.x, p.y, ped.x, ped.y) - p.angle);
    if (facing < 0.2) continue;
    best = ped;
    bestD = d;
  }
  if (!best) return;
  best.hp -= PUNCH_DAMAGE;
  const a = angleTo(p.x, p.y, best.x, best.y);
  best.x += Math.cos(a) * 26;
  best.y += Math.sin(a) * 26;
  spawnParticles(world, best.x, best.y, '#ffd23d', 5, 120);
  if (best.hp <= 0) {
    best.state = 'down';
    best.downTimer = 6;
    world.stats.pedsDown++;
    addWanted(world, 1);
    showMessage(world, 'You knocked someone out — witnesses called it in', 3);
  }
}

function doShoot(world, input) {
  const p = world.player;
  if (p.shootCooldown > 0 || p.car) return;
  p.shootCooldown = PISTOL_COOLDOWN;
  if (world.ammo <= 0) return;
  world.ammo--;
  world.stats.shotsFired++;
  const aim = input.aimWorld ?? { x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100 };
  const aimAngle = angleTo(p.x, p.y, aim.x, aim.y);
  p.angle = aimAngle;
  world.events.push({ type: 'shoot' });
  const dx = Math.cos(aimAngle);
  const dy = Math.sin(aimAngle);
  let hit = null;
  let hitDist = PISTOL_RANGE;
  let hitKind = null;
  const consider = (tx, ty, radius, obj, kind) => {
    const rx = tx - p.x;
    const ry = ty - p.y;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > hitDist) return;
    const perp = Math.abs(rx * dy - ry * dx);
    if (perp > radius) return;
    hit = obj;
    hitDist = along;
    hitKind = kind;
  };
  for (const ped of world.peds) {
    if (ped.state !== 'down') consider(ped.x, ped.y, 18, ped, 'ped');
  }
  for (const cop of world.police) consider(cop.x, cop.y, 26, cop, 'police');
  const endX = p.x + dx * hitDist;
  const endY = p.y + dy * hitDist;
  world.tracer = { x1: p.x, y1: p.y, x2: endX, y2: endY, timer: 0.08 };
  if (!hit) return;
  spawnParticles(world, endX, endY, '#ff5a3d', 6, 130);
  if (hitKind === 'ped') {
    hit.hp -= PISTOL_DAMAGE;
    if (hit.hp <= 0) {
      hit.state = 'down';
      hit.downTimer = 8;
      world.stats.pedsDown++;
    }
    addWanted(world, 1);
  } else {
    hit.hp -= PISTOL_DAMAGE;
    if (hit.hp <= 0) {
      hit.dead = true;
      spawnParticles(world, hit.x, hit.y, '#ff7a3d', 26, 260);
      spawnParticles(world, hit.x, hit.y, '#3a3a40', 14, 180);
      world.events.push({ type: 'explosion' });
      addWanted(world, 1, true);
      showMessage(world, 'You blew up a police car — every cop in Solmar is coming', 4);
    }
  }
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepWorld(world, input, dt) {
  if (world.state !== 'playing') return;
  dt = Math.min(dt, 0.05);
  world.time += dt;
  const p = world.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (world.messageTimer > 0) {
    world.messageTimer -= dt;
    if (world.messageTimer <= 0) world.message = '';
  }
  if (world.tracer) {
    world.tracer.timer -= dt;
    if (world.tracer.timer <= 0) world.tracer = null;
  }
  world.crimeTimer += dt;

  // --- Player --------------------------------------------------------------
  if (input.interact) {
    if (p.car) exitCar(world);
    else {
      const car = nearestEnterableCar(world, 72);
      if (car) enterCar(world, car);
    }
  }

  if (p.car) {
    const car = p.car;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (input.up) car.speed += CAR_ACCEL * dt;
    if (input.down) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    car.speed -= car.speed * 0.45 * dt;
    car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
    const turnRate = CAR_TURN * Math.min(1, Math.abs(car.speed) / 220);
    car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveSolids(world, nx, ny, CAR_R);
    const clamped = clampToWorld(fixed.x, fixed.y);
    if (fixed.hit && Math.abs(car.speed) > 260 && world.time - p.lastCrash > 0.5) {
      world.events.push({ type: 'crash' });
      spawnParticles(world, car.x, car.y, '#c9c9c9', 8, 140);
      p.lastCrash = world.time;
    }
    if (fixed.hit || clamped.x !== nx || clamped.y !== ny) car.speed *= 0.55;
    car.x = Math.min(WATER_X + 20, clamped.x);
    car.y = clamped.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  } else {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      const speed = input.run ? RUN_SPEED : WALK_SPEED;
      p.angle = input.shootHeld && input.aimWorld
        ? angleTo(p.x, p.y, input.aimWorld.x, input.aimWorld.y)
        : Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      const fixedX = resolveSolids(world, nx, p.y, PLAYER_R);
      const fixed = resolveSolids(world, fixedX.x, ny, PLAYER_R);
      const clamped = clampToWorld(fixed.x, fixed.y);
      p.x = Math.min(WATER_X + 20, clamped.x);
      p.y = clamped.y;
    } else if (input.shootHeld && input.aimWorld) {
      p.angle = angleTo(p.x, p.y, input.aimWorld.x, input.aimWorld.y);
    }
  }

  if (input.punch) doPunch(world);
  if (input.shoot || input.shootHeld) doShoot(world, input);

  // --- Traffic -------------------------------------------------------------
  for (const car of world.traffic) {
    car.turnCooldown -= dt;
    const step = car.speed * dt;
    if (car.axis === 'h') {
      car.x += car.dir * step;
      const nearRoad = Math.round(car.x / PITCH);
      if (car.turnCooldown <= 0 && nearRoad >= 0 && nearRoad <= 9
        && Math.abs(car.x - roadCentre(nearRoad)) < step * 0.6
        && world.rng.chance(0.16)) {
        car.axis = 'v';
        car.road = nearRoad;
        car.dir = world.rng.chance(0.5) ? 1 : -1;
        car.x = roadCentre(nearRoad) + (car.dir > 0 ? -14 : 14);
        car.y = roadCentre(car.road);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.turnCooldown = 3;
      }
      if (car.x > CITY + 50) car.x = -50;
      if (car.x < -50) car.x = CITY + 50;
    } else {
      car.y += car.dir * step;
      const nearRoad = Math.round(car.y / PITCH);
      if (car.turnCooldown <= 0 && nearRoad >= 0 && nearRoad <= 9
        && Math.abs(car.y - roadCentre(nearRoad)) < step * 0.6
        && world.rng.chance(0.16)) {
        car.axis = 'h';
        car.road = nearRoad;
        car.dir = world.rng.chance(0.5) ? 1 : -1;
        car.y = roadCentre(nearRoad) + (car.dir > 0 ? 14 : -14);
        car.x = roadCentre(car.road);
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.turnCooldown = 3;
      }
      if (car.y > CITY + 50) car.y = -50;
      if (car.y < -50) car.y = CITY + 50;
    }
    // Gentle separation so cars do not pile up on one lane.
    for (const other of world.traffic) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0.01 && d < 34) {
        const push = (34 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uy = (car.y - other.y) / d;
        car.x += ux * push;
        car.y += uy * push;
      }
    }
  }

  // Traffic running over pedestrians (not the player's fault).
  for (const car of world.traffic) {
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 24 && Math.abs(car.speed) > 50) {
        ped.state = 'down';
        ped.downTimer = 6;
        ped.hp = 0;
        world.stats.pedsDown++;
      }
    }
  }

  // Player's car vs other cars.
  if (p.car) {
    const all = [...world.traffic, ...world.parked, world.comet, ...world.police];
    for (const other of all) {
      if (other === p.car || other.dead) continue;
      const d = dist(p.car.x, p.car.y, other.x, other.y);
      if (d > 0.01 && d < 36) {
        const push = (36 - d) / 2;
        const ux = (p.car.x - other.x) / d;
        const uy = (p.car.y - other.y) / d;
        p.car.x += ux * push;
        p.car.y += uy * push;
        if (Math.abs(p.car.speed) > 240 && world.time - p.lastCrash > 0.5) {
          world.events.push({ type: 'crash' });
          p.lastCrash = world.time;
        }
        p.car.speed *= 0.8;
        if (other.kind === 'traffic') other.speed *= 0.6;
      }
    }
    // Running over a pedestrian while driving.
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (dist(p.car.x, p.car.y, ped.x, ped.y) < 26 && Math.abs(p.car.speed) > 150) {
        ped.state = 'down';
        ped.downTimer = 7;
        ped.hp = 0;
        world.stats.pedsDown++;
        p.car.speed *= 0.85;
        world.events.push({ type: 'crash' });
        addWanted(world, 1);
        showMessage(world, 'You ran someone over — witnesses called it in', 3);
      }
    }
  } else {
    // A traffic car hitting the player on foot hurts.
    for (const car of world.traffic) {
      if (dist(car.x, car.y, p.x, p.y) < 26 && Math.abs(car.speed) > 60) {
        p.health -= 12;
        const a = angleTo(car.x, car.y, p.x, p.y);
        p.x += Math.cos(a) * 30;
        p.y += Math.sin(a) * 30;
        world.events.push({ type: 'crash' });
        car.speed *= 0.5;
      }
    }
  }

  // --- Pedestrians ---------------------------------------------------------
  for (const ped of world.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.hp = 50;
        const spot = randomRoadPoint(world);
        ped.x = spot.x;
        ped.y = spot.y;
        ped.tx = spot.x;
        ped.ty = spot.y;
      }
      continue;
    }
    // Flee from gunfire, and from a fast car bearing down on them.
    let fleeX = 0;
    let fleeY = 0;
    let fleeing = false;
    const threat = p.car ? { x: p.car.x, y: p.car.y, r: 110, fast: Math.abs(p.car.speed) > 200 } : null;
    if (threat && threat.fast && dist(ped.x, ped.y, threat.x, threat.y) < threat.r) {
      fleeing = true;
      fleeX = ped.x - threat.x;
      fleeY = ped.y - threat.y;
    } else if (world.tracer && dist(ped.x, ped.y, world.tracer.x1, world.tracer.y1) < 260) {
      fleeing = true;
      fleeX = ped.x - world.tracer.x1;
      fleeY = ped.y - world.tracer.y1;
    }
    if (fleeing) {
      const len = Math.hypot(fleeX, fleeY) || 1;
      ped.angle = Math.atan2(fleeY / len, fleeX / len);
      const nx = ped.x + (fleeX / len) * ped.speed * 2.1 * dt;
      const ny = ped.y + (fleeY / len) * ped.speed * 2.1 * dt;
      const fixed = resolveSolids(world, nx, ny, 10);
      const clamped = clampToWorld(fixed.x, fixed.y);
      ped.x = Math.min(WATER_X + 20, clamped.x);
      ped.y = clamped.y;
      continue;
    }
    ped.retarget -= dt;
    if (ped.retarget <= 0 || dist(ped.x, ped.y, ped.tx, ped.ty) < 14) {
      const spot = randomRoadPoint(world);
      ped.tx = spot.x;
      ped.ty = spot.y;
      ped.retarget = world.rng.range(3, 8);
    }
    const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt;
    const ny = ped.y + Math.sin(a) * ped.speed * dt;
    const fixed = resolveSolids(world, nx, ny, 10);
    const clamped = clampToWorld(fixed.x, fixed.y);
    ped.x = Math.min(WATER_X + 20, clamped.x);
    ped.y = clamped.y;
  }

  // --- Wanted + police -----------------------------------------------------
  const desiredPolice = world.wanted >= 1 ? Math.min(1 + Math.floor(world.wanted / 2), POLICE_MAX) : 0;
  while (world.police.length < desiredPolice) {
    const a = world.rng.range(0, Math.PI * 2);
    let sx = p.x + Math.cos(a) * 460;
    let sy = p.y + Math.sin(a) * 460;
    sx = Math.max(40, Math.min(CITY - 40, sx));
    sy = Math.max(40, Math.min(CITY - 40, sy));
    // Snap onto the nearest road so the cruiser starts on asphalt.
    const ri = Math.round(sx / PITCH);
    const rj = Math.round(sy / PITCH);
    if (Math.abs(sx - roadCentre(ri)) < Math.abs(sy - roadCentre(rj))) sx = roadCentre(ri);
    else sy = roadCentre(rj);
    world.police.push({
      kind: 'police', x: sx, y: sy, angle: angleTo(sx, sy, p.x, p.y),
      speed: 0, hp: POLICE_HP, color: COLORS.police, dead: false,
    });
    world.events.push({ type: 'siren' });
  }
  if (world.wanted === 0 && world.police.length > 0) world.police.length = 0;

  let nearestCop = Infinity;
  for (const cop of world.police) {
    if (cop.dead) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    nearestCop = Math.min(nearestCop, d);
    const targetAngle = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = turnToward(cop.angle, targetAngle, 3.4 * dt);
    const targetSpeed = Math.min(POLICE_SPEED, 240 + d * 1.1);
    cop.speed += (targetSpeed - cop.speed) * Math.min(1, 1.6 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const fixed = resolveSolids(world, nx, ny, CAR_R);
    const clamped = clampToWorld(fixed.x, fixed.y);
    cop.x = Math.min(WATER_X + 20, clamped.x);
    cop.y = clamped.y;
    // Ramming the player.
    if (d < 40) {
      if (p.car) {
        if (Math.abs(cop.speed) > 120) {
          p.car.speed *= 0.72;
          p.health -= 4;
          world.events.push({ type: 'crash' });
          cop.speed *= 0.4;
        }
      } else {
        world.bustedTimer += dt;
        if (world.bustedTimer > 1.6 && world.wanted >= 1) {
          world.state = 'busted';
          world.events.push({ type: 'busted' });
          showMessage(world, 'BUSTED — the cops dragged you in', 6);
        }
      }
    }
  }
  world.police = world.police.filter((c) => !c.dead);
  if (nearestCop > 60) world.bustedTimer = Math.max(0, world.bustedTimer - dt * 2);

  // Wanted decays only while the player lays low and unseen.
  if (world.crimeTimer > WANTED_DECAY_QUIET && nearestCop > 300) {
    world.quietTimer += dt;
    if (world.quietTimer >= WANTED_DECAY_STEP && world.wanted > 0) {
      world.wanted--;
      world.quietTimer = 0;
      showMessage(world, `Heat cooling off — ${world.wanted} star${world.wanted === 1 ? '' : 's'} left`, 3);
    }
  } else {
    world.quietTimer = 0;
  }

  // Slow health regen while the heat is off.
  if (world.wanted === 0 && p.health > 0 && p.health < PLAYER_MAX_HEALTH) {
    p.health = Math.min(PLAYER_MAX_HEALTH, p.health + 1.2 * dt);
  }

  // --- Pickups -------------------------------------------------------------
  if (!p.car) {
    for (const box of world.ammoBoxes) {
      if (!box.taken && dist(p.x, p.y, box.x, box.y) < 42) {
        box.taken = true;
        world.ammo += AMMO_PICKUP;
        world.events.push({ type: 'pickup' });
        showMessage(world, `Ammo +${AMMO_PICKUP}`, 2.5);
      }
    }
    for (const kit of world.medkits) {
      if (!kit.taken && dist(p.x, p.y, kit.x, kit.y) < 42) {
        kit.taken = true;
        p.health = Math.min(PLAYER_MAX_HEALTH, p.health + MEDKIT_HEAL);
        world.events.push({ type: 'pickup' });
        showMessage(world, `Health +${MEDKIT_HEAL}`, 2.5);
      }
    }
  }

  // --- Missions ------------------------------------------------------------
  const m = world.mission;
  if (m.index === 0) {
    const target = m.stage === 'pickup' ? PLACES.docks : PLACES.pawn;
    if (dist(p.x, p.y, target.x, target.y) < (m.stage === 'pickup' ? 60 : 65)) {
      if (m.stage === 'pickup') {
        m.stage = 'deliver';
        world.events.push({ type: 'pickup' });
        showMessage(world, 'Package secured — take it to the Pawn Shop', 5);
      } else {
        completeMission(world);
      }
    }
  } else if (m.index === 1) {
    if (m.stage === 'deliver' && p.car === world.comet
      && dist(p.x, p.y, PLACES.chop.x, PLACES.chop.y) < 80) {
      completeMission(world);
    }
  } else if (m.index === 2) {
    if (m.stage === 'collect') {
      for (const bag of m.bags) {
        if (!bag.taken && dist(p.x, p.y, bag.x, bag.y) < 48) {
          bag.taken = true;
          m.bagsGot++;
          world.events.push({ type: 'cash' });
          showMessage(world, `Cash bag ${m.bagsGot}/${CASH_BAGS}`, 3);
          if (m.bagsGot >= CASH_BAGS) {
            m.stage = 'return';
            showMessage(world, 'All bags grabbed — get back to the Hideout', 5);
          }
        }
      }
    } else if (dist(p.x, p.y, PLACES.hideout.x, PLACES.hideout.y) < 75) {
      completeMission(world);
    }
  }

  // --- Particles -----------------------------------------------------------
  for (const pt of world.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);

  // --- Death ---------------------------------------------------------------
  if (p.health <= 0 && world.state === 'playing') {
    p.health = 0;
    world.state = 'wasted';
    world.events.push({ type: 'busted' });
    showMessage(world, 'WASTED — Solmar keeps moving without you', 6);
  }
}

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

export function serializeWorld(world) {
  const p = world.player;
  return {
    v: 1,
    seed: world.seed,
    time: world.time,
    money: world.money,
    debt: world.debt,
    debtPaid: world.debtPaid,
    ammo: world.ammo,
    wanted: world.wanted,
    health: p.health,
    px: p.x,
    py: p.y,
    pangle: p.angle,
    inCar: Boolean(p.car),
    missionIndex: world.mission.index,
    missionStage: world.mission.stage,
    bagsGot: world.mission.bagsGot,
    bagsTaken: world.mission.bags.map((b) => b.taken),
    stats: { ...world.stats },
  };
}

export function applySave(world, data) {
  if (!data || data.v !== 1) return false;
  const p = world.player;
  world.time = data.time || 0;
  world.money = data.money || 0;
  world.debt = data.debt ?? DEBT_TOTAL;
  world.debtPaid = data.debtPaid || 0;
  world.ammo = data.ammo ?? START_AMMO;
  world.wanted = data.wanted || 0;
  p.health = data.health ?? PLAYER_MAX_HEALTH;
  p.x = data.px ?? p.x;
  p.y = data.py ?? p.y;
  p.angle = data.pangle ?? p.angle;
  world.mission.index = data.missionIndex || 0;
  world.mission.stage = data.missionStage || 'pickup';
  world.mission.bagsGot = data.bagsGot || 0;
  if (world.mission.index === 2) {
    setMissionTarget(world);
    (data.bagsTaken || []).forEach((taken, i) => {
      if (world.mission.bags[i]) world.mission.bags[i].taken = taken;
    });
  }
  world.stats = { ...world.stats, ...(data.stats || {}) };
  if (data.inCar) {
    let best = null;
    let bestD = Infinity;
    for (const car of world.parked) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (best) {
      p.car = best;
      p.x = best.x;
      p.y = best.y;
    }
  }
  world.state = world.mission.index >= 3 ? 'won' : 'playing';
  return true;
}
