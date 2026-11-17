// SOLMAR HEAT — world simulation. Pure logic: no DOM, no audio, no canvas,
// so Node can import it headlessly for the smoke test. The step function
// returns events; the shell (main.js) turns them into sound and screens.

import { CONFIG, roadCenter, blockCenter, clamp, dist, angleTo, angleDelta } from './config.js';
import { makeRng, rngRange, rngInt, rngPick, rngShuffle } from './random.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e0b13c', '#4fbf6a', '#8e5fc0', '#d9d9d9', '#2b2f36', '#e07b39'];
export const PED_COLORS = ['#e8c39e', '#c98d5f', '#8a5a3b', '#f0d0b0', '#6b4a2f'];
export const PED_SHIRTS = ['#d94f3d', '#3d7dd9', '#4fbf6a', '#e0b13c', '#8e5fc0', '#e07b39', '#dddddd', '#2b2f36'];

// Fixed story locations. Shops and hideout sit on the south sidewalk of
// their block (the "doorstep"), never at the block centre — the centre is
// where the building stands, and the player cannot walk through a building.
function doorstep(col, row) {
  const c = blockCenter(col, row);
  return { x: c.x, y: c.y + 56 };
}

export const PLACES = {
  hideout: doorstep(1, 1),
  pawnShop: doorstep(7, 2),
  chopShop: doorstep(2, 7),
  docks: { x: 1512, y: 700 },
  comet: { x: roadCenter(5) + 9, y: 940 },
  bags: [
    doorstep(1, 7),
    doorstep(7, 1),
    doorstep(4, 4),
    doorstep(6, 6),
    doorstep(3, 6),
  ],
};

const MISSION_DEFS = [
  { name: 'The Pickup', payout: 8000 },
  { name: 'Hot Wheels', payout: 14000 },
  { name: 'The Big Score', payout: 28000 },
];

function setMessage(world, text, dur) {
  world.message = { text, until: world.time + (dur || 3.5) };
}

function addWanted(world, n) {
  const w = world.wanted;
  w.stars = Math.min(CONFIG.MAX_WANTED, w.stars + n);
  w.heat = 100;
  w.lastCrime = world.time;
}

function makeBlocks(rng) {
  const blocks = [];
  for (let row = 0; row < CONFIG.ROWS; row++) {
    for (let col = 0; col < CONFIG.COLS; col++) {
      let type = 'building';
      const r = rng();
      if (r < 0.16) type = 'park';
      else if (r < 0.24) type = 'plaza';
      // Fixed story blocks never roll as park/plaza.
      if ((col === 1 && row === 1) || (col === 7 && row === 2) || (col === 2 && row === 7)) type = 'building';
      if (col === 4 && row === 4) type = 'plaza';
      const bx = CONFIG.ROAD + col * CONFIG.PITCH;
      const by = CONFIG.ROAD + row * CONFIG.PITCH;
      blocks.push({
        col,
        row,
        type,
        color: type === 'building' ? rngPick(rng, ['#b08a5e', '#8a6a4e', '#7d8aa0', '#a08a7d', '#6e7d6a', '#9a7b8a']) : null,
        building:
          type === 'building'
            ? { x: bx + 16, y: by + 16, w: CONFIG.BLOCK - 32, h: CONFIG.BLOCK - 32 }
            : null,
      });
    }
  }
  return blocks;
}

function randomRoadPoint(rng, minDist, px, py) {
  // A point on a road centre line, at least minDist from (px, py).
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng() < 0.5;
    const i = rngInt(rng, 0, 10);
    const along = rngRange(rng, 60, 1420);
    const x = vertical ? roadCenter(i) : along;
    const y = vertical ? along : roadCenter(i);
    if (minDist === 0 || dist(x, y, px, py) >= minDist) return { x, y };
  }
  return { x: roadCenter(4), y: roadCenter(4) };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const blocks = makeBlocks(rng);
  const playerStart = { x: PLACES.hideout.x, y: PLACES.hideout.y + 24 };

  const cars = [];
  let nextCarId = 1;
  // Traffic: 14 cars cruising the road grid.
  for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
    const vertical = rng() < 0.5;
    const road = rngInt(rng, 0, 10);
    const lane = rng() < 0.5 ? -1 : 1;
    const dir = rng() < 0.5 ? -1 : 1;
    const along = rngRange(rng, 80, 1400);
    cars.push({
      id: nextCarId++,
      kind: 'traffic',
      x: vertical ? roadCenter(road) + lane * 9 : along,
      y: vertical ? along : roadCenter(road) + lane * 9,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      speed: rngRange(rng, 120, 180),
      targetSpeed: rngRange(rng, 130, 180),
      color: rngPick(rng, CAR_COLORS),
      axis: vertical ? 'v' : 'h',
      road,
      dir,
      lane,
      disabled: false,
      ramCooldown: 0,
    });
  }
  // Parked cars: 6, free to take, plus the marked Comet GT.
  const parkedSpots = [];
  for (let k = 0; k < CONFIG.PARKED_COUNT; k++) {
    const road = 1 + k;
    parkedSpots.push({
      x: roadCenter(road) + 13,
      y: rngRange(rng, 140, 1340),
      angle: Math.PI / 2,
    });
  }
  for (const s of parkedSpots) {
    cars.push({
      id: nextCarId++,
      kind: 'parked',
      x: s.x,
      y: s.y,
      angle: s.angle,
      speed: 0,
      targetSpeed: 0,
      color: rngPick(rng, CAR_COLORS),
      axis: 'v',
      road: 0,
      dir: 1,
      lane: 1,
      disabled: false,
      ramCooldown: 0,
    });
  }
  const comet = {
    id: nextCarId++,
    kind: 'comet',
    x: PLACES.comet.x,
    y: PLACES.comet.y,
    angle: -Math.PI / 2,
    speed: 0,
    targetSpeed: 0,
    color: '#e8c832',
    axis: 'v',
    road: 5,
    dir: -1,
    lane: 1,
    disabled: false,
    ramCooldown: 0,
  };
  cars.push(comet);

  // Pedestrians: 26, wandering the sidewalks.
  const peds = [];
  for (let i = 0; i < CONFIG.PED_COUNT; i++) {
    const b = rngPick(rng, blocks);
    const bx = CONFIG.ROAD + b.col * CONFIG.PITCH;
    const by = CONFIG.ROAD + b.row * CONFIG.PITCH;
    const edge = rngInt(rng, 0, 4);
    let x;
    let y;
    if (edge === 0) {
      x = bx + rngRange(rng, 4, CONFIG.BLOCK - 4);
      y = by + 5;
    } else if (edge === 1) {
      x = bx + rngRange(rng, 4, CONFIG.BLOCK - 4);
      y = by + CONFIG.BLOCK - 5;
    } else if (edge === 2) {
      x = bx + 5;
      y = by + rngRange(rng, 4, CONFIG.BLOCK - 4);
    } else {
      x = bx + CONFIG.BLOCK - 5;
      y = by + rngRange(rng, 4, CONFIG.BLOCK - 4);
    }
    peds.push({
      x,
      y,
      angle: rngRange(rng, 0, Math.PI * 2),
      speed: rngRange(rng, 38, 66),
      tx: x,
      ty: y,
      down: false,
      downT: 0,
      skin: rngPick(rng, PED_COLORS),
      shirt: rngPick(rng, PED_SHIRTS),
    });
  }

  const pickups = [];
  const ammoSpots = [doorstep(2, 2), doorstep(6, 2), doorstep(2, 6), doorstep(7, 6)];
  for (const s of ammoSpots) pickups.push({ kind: 'ammo', x: s.x, y: s.y, amount: CONFIG.AMMO_PICKUP, taken: false });
  const healthSpots = [doorstep(4, 1), doorstep(1, 4), doorstep(6, 4)];
  for (const s of healthSpots) pickups.push({ kind: 'health', x: s.x, y: s.y, amount: CONFIG.HEALTH_PICKUP, taken: false });
  const cashSpots = [doorstep(3, 1), doorstep(5, 7), doorstep(7, 5), doorstep(4, 6)];
  for (const s of cashSpots) pickups.push({ kind: 'cash', x: s.x, y: s.y, amount: 250, taken: false });

  const bags = PLACES.bags.map((p) => ({ x: p.x, y: p.y, taken: false }));

  return {
    seed,
    time: 0,
    rng,
    blocks,
    player: {
      x: playerStart.x,
      y: playerStart.y,
      angle: -Math.PI / 2,
      health: CONFIG.PLAYER_MAX_HEALTH,
      money: 0,
      ammo: CONFIG.START_AMMO,
      carId: null,
      hasPackage: false,
      speed: 0,
    },
    cars,
    cometId: comet.id,
    peds,
    bullets: [],
    pickups,
    bags,
    wanted: { stars: 0, heat: 0, lastCrime: -100 },
    missionIndex: 0,
    missionStage: 'pickup', // pickup -> deliver -> steal -> deliver -> collect -> return -> done
    debt: CONFIG.DEBT_TOTAL,
    won: false,
    busted: false,
    wasted: false,
    message: { text: 'Jax owes Sal $50,000. Three jobs. Pay it off.', until: 6 },
    bustHold: 0,
    spawnT: 0,
    punchCooldown: 0,
    fireCooldown: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, hits: 0, timePlayed: 0 },
  };
}

// Where the player has to go right now, and what the HUD should say.
export function currentTarget(world) {
  const m = world.missionIndex;
  const s = world.missionStage;
  if (world.won) return { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Debt paid — you are free' };
  if (m === 0 && s === 'pickup') return { x: PLACES.docks.x, y: PLACES.docks.y, label: 'Pick up the package at the docks' };
  if (m === 0 && s === 'deliver') return { x: PLACES.pawnShop.x, y: PLACES.pawnShop.y, label: 'Deliver the package to the pawn shop' };
  if (m === 1 && s === 'steal') return { x: PLACES.comet.x, y: PLACES.comet.y, label: 'Steal the Comet GT (yellow car)' };
  if (m === 1 && s === 'deliver') return { x: PLACES.chopShop.x, y: PLACES.chopShop.y, label: 'Deliver the Comet GT to the chop shop' };
  if (m === 2 && s === 'collect') {
    const left = world.bags.filter((b) => !b.taken);
    const next = left[0] || PLACES.hideout;
    return { x: next.x, y: next.y, label: `Collect the cash bags (${world.player.bagsCollected || 0}/${CONFIG.CASH_BAG_COUNT})` };
  }
  if (m === 2 && s === 'return') return { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Bring the cash home to the hideout' };
  return { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Lay low' };
}

export function carById(world, id) {
  return world.cars.find((c) => c.id === id) || null;
}

export function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of world.cars) {
    if (c.kind === 'police' || c.disabled) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// Push a circle out of every building rectangle it overlaps.
function collideBuildings(world, ent, radius) {
  for (const b of world.blocks) {
    if (!b.building) continue;
    const r = b.building;
    const cx = clamp(ent.x, r.x, r.x + r.w);
    const cy = clamp(ent.y, r.y, r.y + r.h);
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      ent.x = cx + (dx / d) * radius;
      ent.y = cy + (dy / d) * radius;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      const pl = ent.x - r.x;
      const pr = r.x + r.w - ent.x;
      const pt = ent.y - r.y;
      const pb = r.y + r.h - ent.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) ent.x = r.x - radius;
      else if (m === pr) ent.x = r.x + r.w + radius;
      else if (m === pt) ent.y = r.y - radius;
      else ent.y = r.y + r.h + radius;
    }
  }
}

// ---- movement + driving ----

function stepPlayerOnFoot(world, input, dt, events) {
  const p = world.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const speed = input.run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 12, CONFIG.WATER_X - 8);
  p.y = clamp(p.y, 12, CONFIG.WORLD_H - 12);
  collideBuildings(world, p, CONFIG.PLAYER_RADIUS);

  if (input.action) {
    const car = nearestCar(world, p.x, p.y, 48);
    if (car) enterCar(world, car, events);
    else events.push({ type: 'denied' });
  }
}

function enterCar(world, car, events) {
  const p = world.player;
  if (car.kind === 'traffic') {
    // Jack it: the driver bails out on foot and the law notices.
    addWanted(world, 1);
    world.stats.carsStolen++;
    spawnFleeingPed(world, car.x, car.y);
    car.kind = 'parked'; // now yours; it no longer follows traffic rules
    setMessage(world, 'You jacked the car! Wanted +1', 3);
    events.push({ type: 'jack' });
  } else if (car.kind === 'parked' || car.kind === 'comet') {
    events.push({ type: 'door' });
    if (car.kind === 'comet') setMessage(world, 'The Comet GT is yours. Lose the heat, then chop shop.', 3);
  }
  car.speed = 0;
  p.carId = car.id;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function spawnFleeingPed(world, x, y) {
  const a = world.rng() * Math.PI * 2;
  world.peds.push({
    x: x + Math.cos(a) * 26,
    y: y + Math.sin(a) * 26,
    angle: a,
    speed: 120,
    tx: x + Math.cos(a) * 220,
    ty: y + Math.sin(a) * 220,
    down: false,
    downT: 0,
    skin: '#e8c39e',
    shirt: '#d94f3d',
  });
}

function exitCar(world, events) {
  const p = world.player;
  const car = carById(world, p.carId);
  if (!car) {
    p.carId = null;
    return;
  }
  const side = car.angle + Math.PI / 2;
  p.x = clamp(car.x + Math.cos(side) * 26, 12, CONFIG.WATER_X - 8);
  p.y = clamp(car.y + Math.sin(side) * 26, 12, CONFIG.WORLD_H - 12);
  collideBuildings(world, p, CONFIG.PLAYER_RADIUS);
  p.angle = car.angle;
  p.carId = null;
  car.speed = 0;
  events.push({ type: 'door' });
}

function stepDriving(world, input, dt, events) {
  const p = world.player;
  const car = carById(world, p.carId);
  if (!car) {
    p.carId = null;
    return;
  }
  if (input.action) {
    exitCar(world, events);
    return;
  }
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  if (input.up) car.speed += CONFIG.CAR_ACCEL * dt;
  if (input.down) {
    if (car.speed > 30) car.speed -= CONFIG.CAR_BRAKE * dt;
    else car.speed -= CONFIG.CAR_ACCEL * 0.55 * dt;
  }
  if (!input.up && !input.down) {
    car.speed -= car.speed * CONFIG.CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CONFIG.CAR_REVERSE_MAX, CONFIG.CAR_MAX_SPEED);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 12) {
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.angle += steer * CONFIG.CAR_TURN * dt * dirSign * Math.min(1, Math.abs(car.speed) / 160);
  }
  const nx = car.x + forward.x * car.speed * dt;
  const ny = car.y + forward.y * car.speed * dt;
  const hitWall =
    nx < 14 || nx > CONFIG.BEACH_X - 12 || ny < 14 || ny > CONFIG.WORLD_H - 14;
  car.x = clamp(nx, 14, CONFIG.BEACH_X - 12);
  car.y = clamp(ny, 14, CONFIG.WORLD_H - 14);
  const before = { x: car.x, y: car.y };
  collideBuildings(world, car, CONFIG.CAR_RADIUS);
  const pushed = dist(before.x, before.y, car.x, car.y);
  if (hitWall || pushed > 0.5) {
    if (Math.abs(car.speed) > 240) {
      events.push({ type: 'crash' });
      p.health = Math.max(1, p.health - 4);
    }
    car.speed *= 0.45;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;

  // Running over a pedestrian is a crime, and it is loud.
  for (const ped of world.peds) {
    if (ped.down) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 24 && Math.abs(car.speed) > 60) {
      ped.down = true;
      ped.downT = 3;
      addWanted(world, 1);
      world.stats.pedsHit++;
      events.push({ type: 'crash' });
      setMessage(world, 'You ran someone over! Wanted +1', 3);
    }
  }
}

// ---- traffic + pedestrians ----

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.kind !== 'traffic' || car.disabled) continue;
    const speed = car.targetSpeed;
    // Advance along the current road.
    if (car.axis === 'v') {
      car.y += car.dir * speed * dt;
      car.x = roadCenter(car.road) + car.lane * 9;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // At an intersection, sometimes turn onto the cross road.
      const j = Math.round((car.y - CONFIG.ROAD / 2) / CONFIG.PITCH);
      if (j >= 0 && j <= 9) {
        const cy = roadCenter(j);
        if (Math.abs(car.y - cy) < speed * dt * 0.6 && world.rng() < 0.4) {
          car.axis = 'h';
          car.road = j;
          car.dir = world.rng() < 0.5 ? -1 : 1;
          car.lane = world.rng() < 0.5 ? -1 : 1;
          car.y = cy + car.lane * 9;
        }
      }
      if (car.y < 24) {
        car.y = 24;
        car.dir = 1;
      }
      if (car.y > CONFIG.WORLD_H - 24) {
        car.y = CONFIG.WORLD_H - 24;
        car.dir = -1;
      }
    } else {
      car.x += car.dir * speed * dt;
      car.y = roadCenter(car.road) + car.lane * 9;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      const i = Math.round((car.x - CONFIG.ROAD / 2) / CONFIG.PITCH);
      if (i >= 0 && i <= 9) {
        const cx = roadCenter(i);
        if (Math.abs(car.x - cx) < speed * dt * 0.6 && world.rng() < 0.4) {
          car.axis = 'v';
          car.road = i;
          car.dir = world.rng() < 0.5 ? -1 : 1;
          car.lane = world.rng() < 0.5 ? -1 : 1;
          car.x = cx + car.lane * 9;
        }
      }
      if (car.x < 24) {
        car.x = 24;
        car.dir = 1;
      }
      if (car.x > CONFIG.BEACH_X - 24) {
        car.x = CONFIG.BEACH_X - 24;
        car.dir = -1;
      }
    }
  }
}

function stepPeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.down) {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.down = false;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 8) {
      // Pick a new stroll target: a nearby sidewalk point.
      const b = world.blocks[Math.floor(world.rng() * world.blocks.length)];
      const bx = CONFIG.ROAD + b.col * CONFIG.PITCH;
      const by = CONFIG.ROAD + b.row * CONFIG.PITCH;
      ped.tx = clamp(bx + world.rng() * CONFIG.BLOCK, 20, CONFIG.BEACH_X - 20);
      ped.ty = clamp(by + world.rng() * CONFIG.BLOCK, 20, CONFIG.WORLD_H - 20);
      continue;
    }
    const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
    ped.x = clamp(ped.x, 12, CONFIG.WATER_X - 8);
    ped.y = clamp(ped.y, 12, CONFIG.WORLD_H - 12);
  }
}

// ---- police + wanted ----

function policeCars(world) {
  return world.cars.filter((c) => c.kind === 'police' && !c.disabled);
}

function stepWanted(world, dt) {
  const w = world.wanted;
  const p = world.player;
  const cops = policeCars(world);
  if (w.stars > 0 && world.time - w.lastCrime > CONFIG.WANTED_DECAY_DELAY) {
    const nearCop = cops.some((c) => dist(c.x, c.y, p.x, p.y) < 420);
    if (!nearCop) {
      w.heat -= CONFIG.WANTED_DECAY_RATE * dt;
      if (w.heat <= 0) {
        w.stars -= 1;
        w.heat = w.stars > 0 ? 60 : 0;
        if (w.stars === 0) setMessage(world, 'You lost the cops.', 3);
      }
    }
  }
  // Spawn police up to the wanted level.
  world.spawnT -= dt;
  if (w.stars > 0 && cops.length < Math.min(w.stars, CONFIG.MAX_POLICE) && world.spawnT <= 0) {
    world.spawnT = 2.2;
    const spot = randomRoadPoint(world.rng, 380, p.x, p.y);
    const id = Math.max(0, ...world.cars.map((c) => c.id)) + 1;
    world.cars.push({
      id,
      kind: 'police',
      x: spot.x,
      y: spot.y,
      angle: angleTo(spot.x, spot.y, p.x, p.y),
      speed: 0,
      targetSpeed: 0,
      color: '#20242c',
      axis: 'v',
      road: 0,
      dir: 1,
      lane: 1,
      disabled: false,
      ramCooldown: 0,
    });
    setMessage(world, 'The cops are on you!', 3);
  }
  // With no stars left, distant police give up and drive off the books.
  if (w.stars === 0) {
    for (const cop of cops) {
      if (dist(cop.x, cop.y, p.x, p.y) > 800) cop.disabled = true;
    }
    world.cars = world.cars.filter((c) => !(c.kind === 'police' && c.disabled));
  }
}

function stepPolice(world, dt, events) {
  const p = world.player;
  for (const cop of policeCars(world)) {
    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    const turn = clamp(angleDelta(cop.angle, want), -2.4 * dt, 2.4 * dt);
    cop.angle += turn;
    const targetSpeed = d > 60 ? 470 : 300;
    cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.4);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 14, CONFIG.BEACH_X - 12);
    cop.y = clamp(cop.y, 14, CONFIG.WORLD_H - 14);
    collideBuildings(world, cop, CONFIG.CAR_RADIUS);
    if (d < 34 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 0.9;
      cop.speed *= 0.3;
      events.push({ type: 'crash' });
      if (p.carId) {
        p.health -= CONFIG.POLICE_RAM_DAMAGE_CAR;
        const car = carById(world, p.carId);
        if (car) car.speed *= 0.55;
      } else {
        p.health -= CONFIG.POLICE_RAM_DAMAGE_FOOT;
        p.x += Math.cos(cop.angle) * 26;
        p.y += Math.sin(cop.angle) * 26;
        p.x = clamp(p.x, 12, CONFIG.WATER_X - 8);
        p.y = clamp(p.y, 12, CONFIG.WORLD_H - 12);
      }
      if (p.health <= 0) {
        p.health = 0;
        world.wasted = true;
        events.push({ type: 'wasted' });
      }
    }
    // On foot, a cop that stays glued to you busts you.
    if (!p.carId && world.wanted.stars >= 2 && d < 30) {
      world.bustHold += dt;
      if (world.bustHold >= CONFIG.BUST_HOLD_TIME) {
        world.busted = true;
        events.push({ type: 'busted' });
      }
    } else {
      world.bustHold = Math.max(0, world.bustHold - dt * 2);
    }
  }
}

// ---- combat ----

function stepCombat(world, input, dt, events) {
  const p = world.player;
  world.punchCooldown = Math.max(0, world.punchCooldown - dt);
  world.fireCooldown = Math.max(0, world.fireCooldown - dt);
  if (p.carId) return; // no fists or firearms from the driver's seat

  if (input.punch && world.punchCooldown <= 0) {
    world.punchCooldown = CONFIG.PUNCH_COOLDOWN;
    events.push({ type: 'punch' });
    const fx = p.x + Math.cos(p.angle) * 20;
    const fy = p.y + Math.sin(p.angle) * 20;
    let hit = false;
    for (const ped of world.peds) {
      if (ped.down) continue;
      if (dist(fx, fy, ped.x, ped.y) < CONFIG.PUNCH_RANGE) {
        ped.down = true;
        ped.downT = 4;
        addWanted(world, 1);
        world.stats.pedsHit++;
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const cop of policeCars(world)) {
        if (dist(fx, fy, cop.x, cop.y) < CONFIG.PUNCH_RANGE + 8) {
          cop.speed = Math.max(0, cop.speed - 120);
          addWanted(world, 1);
          hit = true;
          break;
        }
      }
    }
    if (hit) events.push({ type: 'hit' });
  }

  if (input.shoot && world.fireCooldown <= 0 && p.ammo > 0) {
    world.fireCooldown = CONFIG.FIRE_COOLDOWN;
    p.ammo--;
    world.stats.shotsFired++;
    events.push({ type: 'shoot' });
    const aim = angleTo(p.x, p.y, input.aimX, input.aimY);
    world.bullets.push({
      x: p.x + Math.cos(aim) * 18,
      y: p.y + Math.sin(aim) * 18,
      vx: Math.cos(aim) * CONFIG.BULLET_SPEED,
      vy: Math.sin(aim) * CONFIG.BULLET_SPEED,
      life: CONFIG.BULLET_RANGE / CONFIG.BULLET_SPEED,
    });
  }

  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    for (const ped of world.peds) {
      if (ped.down) continue;
      if (dist(b.x, b.y, ped.x, ped.y) < 12) {
        ped.down = true;
        ped.downT = 5;
        b.life = 0;
        addWanted(world, 1);
        world.stats.hits++;
        events.push({ type: 'hit' });
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of world.cars) {
      if (car.kind === 'police') {
        if (dist(b.x, b.y, car.x, car.y) < 18) {
          car.disabled = true;
          b.life = 0;
          addWanted(world, 1);
          world.stats.hits++;
          events.push({ type: 'hit' });
          break;
        }
      } else if (car.kind === 'traffic') {
        if (dist(b.x, b.y, car.x, car.y) < 18) {
          car.kind = 'parked';
          car.disabled = false;
          car.speed = 0;
          spawnFleeingPed(world, car.x, car.y);
          b.life = 0;
          addWanted(world, 1);
          world.stats.hits++;
          events.push({ type: 'hit' });
          break;
        }
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < CONFIG.WORLD_W && b.y > 0 && b.y < CONFIG.WORLD_H);
  world.cars = world.cars.filter((c) => !(c.kind === 'police' && c.disabled));
}

// ---- pickups + missions ----

function stepPickups(world, events) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'ammo') {
        p.ammo += pk.amount;
        events.push({ type: 'pickup' });
        setMessage(world, `+${pk.amount} ammo`, 2);
      } else if (pk.kind === 'health') {
        p.health = Math.min(CONFIG.PLAYER_MAX_HEALTH, p.health + pk.amount);
        events.push({ type: 'pickup' });
        setMessage(world, `+${pk.amount} health`, 2);
      } else {
        p.money += pk.amount;
        events.push({ type: 'cash' });
        setMessage(world, `+$${pk.amount} found cash`, 2);
      }
    }
  }
}

function completeMission(world, events, idx) {
  const def = MISSION_DEFS[idx];
  world.player.money += def.payout;
  world.debt -= def.payout;
  world.stats.missionsDone = (world.stats.missionsDone || 0) + 1;
  events.push({ type: 'mission' });
  if (idx >= 2) {
    world.missionIndex = 3;
    world.missionStage = 'done';
    world.debt = 0;
    world.won = true;
    setMessage(world, 'DEBT PAID. Solmar is yours, Jax.', 6);
    events.push({ type: 'win' });
  } else {
    setMessage(world, `${def.name} complete — $${def.payout.toLocaleString('en-US')} paid. Debt left: $${world.debt.toLocaleString('en-US')}`, 4);
  }
}

function stepMissions(world, events) {
  const p = world.player;
  const m = world.missionIndex;
  const s = world.missionStage;
  if (world.won || m >= 3) return;
  if (m === 0 && s === 'pickup') {
    if (dist(p.x, p.y, PLACES.docks.x, PLACES.docks.y) < 38) {
      p.hasPackage = true;
      world.missionStage = 'deliver';
      setMessage(world, 'Package grabbed. Take it to the pawn shop.', 3.5);
      events.push({ type: 'pickup' });
    }
  } else if (m === 0 && s === 'deliver') {
    if (dist(p.x, p.y, PLACES.pawnShop.x, PLACES.pawnShop.y) < 44) {
      completeMission(world, events, 0);
      world.missionIndex = 1;
      world.missionStage = 'steal';
      setMessage(world, 'Job 2: Hot Wheels — steal the yellow Comet GT.', 4);
    }
  } else if (m === 1 && s === 'steal') {
    if (p.carId === world.cometId) {
      world.missionStage = 'deliver';
      setMessage(world, 'Comet GT stolen! Get it to the chop shop.', 3.5);
    }
  } else if (m === 1 && s === 'deliver') {
    const car = carById(world, world.cometId);
    if (p.carId === world.cometId && car && dist(p.x, p.y, PLACES.chopShop.x, PLACES.chopShop.y) < 52) {
      exitCar(world, events);
      car.disabled = true;
      world.cars = world.cars.filter((c) => c.id !== world.cometId);
      completeMission(world, events, 1);
      world.missionIndex = 2;
      world.missionStage = 'collect';
      setMessage(world, 'Job 3: The Big Score — grab 5 cash bags, then come home.', 4);
    }
  } else if (m === 2 && s === 'collect') {
    for (const bag of world.bags) {
      if (!bag.taken && dist(p.x, p.y, bag.x, bag.y) < 30) {
        bag.taken = true;
        p.bagsCollected = (p.bagsCollected || 0) + 1;
        events.push({ type: 'cash' });
        setMessage(world, `Cash bag ${p.bagsCollected}/${CONFIG.CASH_BAG_COUNT}`, 2.5);
      }
    }
    if ((p.bagsCollected || 0) >= CONFIG.CASH_BAG_COUNT) {
      world.missionStage = 'return';
      setMessage(world, 'All bags grabbed. Back to the hideout!', 3.5);
    }
  } else if (m === 2 && s === 'return') {
    if (dist(p.x, p.y, PLACES.hideout.x, PLACES.hideout.y) < 48) {
      completeMission(world, events, 2);
    }
  }
}

// ---- main step ----

export function step(world, input, dt, events) {
  const ev = events || [];
  if (world.won || world.busted || world.wasted) return ev;
  world.time += dt;
  world.stats.timePlayed += dt;
  if (world.player.carId) stepDriving(world, input, dt, ev);
  else stepPlayerOnFoot(world, input, dt, ev);
  stepTraffic(world, dt);
  stepPeds(world, dt);
  stepWanted(world, dt);
  stepPolice(world, dt, ev);
  stepCombat(world, input, dt, ev);
  stepPickups(world, ev);
  stepMissions(world, ev);
  if (world.player.health <= 0 && !world.wasted) {
    world.player.health = 0;
    world.wasted = true;
    ev.push({ type: 'wasted' });
  }
  return ev;
}

// ---- save / load (plain JSON, no functions) ----

export function saveGame(world) {
  const { rng, blocks, ...rest } = world;
  return {
    version: 1,
    savedAt: Date.now(),
    state: JSON.parse(
      JSON.stringify({ ...rest, blocks: undefined, missionIndex: rest.missionIndex }),
    ),
  };
}

export function loadGame(data) {
  if (!data || data.version !== 1 || !data.state || typeof data.state.seed !== 'number') return null;
  const world = createWorld(data.state.seed);
  const saved = data.state;
  for (const key of Object.keys(saved)) {
    if (key === 'blocks' || key === 'rng') continue;
    world[key] = saved[key];
  }
  return world;
}
