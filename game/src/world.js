// SOLMAR HEAT — the world: the city, its people, its cars, the police, the
// wanted system and the three story missions. Everything the player can
// touch lives here; rendering only draws what this module returns.
import { CONFIG } from './config.js';
import { makeRng, pick, int, range } from './random.js';

const C = CONFIG;
const PITCH = C.roadW + 220; // road + block
const MARGIN = 120;
const CITY_W = MARGIN * 2 + C.blocksX * PITCH + C.roadW;
const CITY_H = MARGIN * 2 + C.blocksY * PITCH + C.roadW;
const BEACH_W = 190;
const WORLD_W = CITY_W + BEACH_W + 240; // + water strip
const WORLD_H = CITY_H;

const CAR_COLORS = ['#d84a4a', '#4a7fd8', '#e8e8e8', '#2e2e34', '#e8a13e', '#7fb069', '#c9c9c9', '#8a5aa5'];
const PED_COLORS = ['#e86a6a', '#6aa5e8', '#e8c85a', '#7fb069', '#c98a5a', '#a56a8a', '#5aa5a5', '#d8d8d8'];

// Mission script: Jax owes Sal $50,000. Three jobs pay it off.
export const MISSIONS = [
  {
    id: 'pickup',
    name: 'The Pickup',
    brief: 'Sal needs a package from the docks. Go to the yellow marker, grab it, then deliver it to the pawn shop downtown.',
    stages: [
      { text: 'Go to the DOCKS and pick up the package', target: 'docks', kind: 'goto' },
      { text: 'Deliver the package to the PAWN SHOP', target: 'pawn', kind: 'goto' },
    ],
    reward: 8000,
  },
  {
    id: 'hotwheels',
    name: 'Hot Wheels',
    brief: 'A buyer wants a Comet GT, fast and quiet. Steal the marked car and bring it to the chop shop. The cops will notice.',
    stages: [
      { text: 'Steal the marked COMET GT', target: 'targetCar', kind: 'steal' },
      { text: 'Deliver the Comet GT to the CHOP SHOP', target: 'chop', kind: 'deliver' },
    ],
    reward: 14000,
  },
  {
    id: 'bigscore',
    name: 'The Big Score',
    brief: 'Five cash bags are stashed around Solmar. Grab them all and get back to the hideout. The whole city will be looking for you.',
    stages: [
      { text: 'Collect the 5 CASH BAGS (0/5)', target: 'bags', kind: 'collect', count: 5 },
      { text: 'Get back to the HIDEOUT', target: 'hideout', kind: 'goto' },
    ],
    reward: 28000,
  },
];

function roadCenters(n) {
  const arr = [];
  for (let i = 0; i <= n; i++) arr.push(MARGIN + i * PITCH);
  return arr;
}

function buildCity(rng) {
  const roadsX = roadCenters(C.blocksX);
  const roadsY = roadCenters(C.blocksY);
  const buildings = [];
  const trees = [];
  const parks = new Set();
  // A few blocks are parks (trees, no buildings).
  for (let k = 0; k < 6; k++) parks.add(int(rng, 0, C.blocksX - 1) + ',' + int(rng, 0, C.blocksY - 1));
  for (let i = 0; i < C.blocksX; i++) {
    for (let j = 0; j < C.blocksY; j++) {
      const x0 = roadsX[i] + C.roadW / 2 + 12;
      const y0 = roadsY[j] + C.roadW / 2 + 12;
      const w = PITCH - C.roadW - 24;
      const h = PITCH - C.roadW - 24;
      if (parks.has(i + ',' + j)) {
        for (let t = 0; t < 5; t++) {
          trees.push({ x: x0 + range(rng, 20, w - 20), y: y0 + range(rng, 20, h - 20), r: range(rng, 10, 16) });
        }
        continue;
      }
      // 1-2 buildings per block, leaving plaza space.
      const n = rng() < 0.5 ? 1 : 2;
      for (let b = 0; b < n; b++) {
        const bw = range(rng, 70, Math.min(150, w - 20));
        const bh = range(rng, 60, Math.min(130, h - 20));
        const bx = x0 + (n === 1 ? (w - bw) / 2 : b === 0 ? 8 : w - bw - 8);
        const by = y0 + (n === 1 ? (h - bh) / 2 : range(rng, 8, h - bh - 8));
        buildings.push({ x: bx, y: by, w: bw, h: bh, color: pick(rng, C.palette.buildingRoof), hgt: int(rng, 1, 3) });
      }
      if (rng() < 0.5) trees.push({ x: x0 + range(rng, 15, w - 15), y: y0 + range(rng, 15, h - 15), r: 12 });
    }
  }
  // Named spots (road-adjacent, on the road so the player can reach them).
  const spot = (bx, by) => ({ x: roadsX[bx], y: roadsY[by] });
  const spots = {
    hideout: spot(1, 7),
    docks: { x: CITY_W - 60, y: roadsY[2] },
    pawn: spot(4, 4),
    chop: spot(7, 6),
  };
  // Cash-bag stashes for mission 3.
  const bagSpots = [spot(2, 2), spot(6, 1), spot(1, 4), spot(7, 3), spot(5, 7)];
  return { roadsX, roadsY, buildings, trees, parks, spots, bagSpots, w: WORLD_W, h: WORLD_H, cityW: CITY_W, cityH: CITY_H };
}

function onRoad(city, x, y) {
  const hw = C.roadW / 2;
  for (const rx of city.roadsX) if (Math.abs(x - rx) <= hw) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) <= hw) return true;
  return false;
}

function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings. Returns true if it hit something.
function resolveBuildings(city, e, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
      hit = true;
    } else if (d2 <= 0.0001) {
      e.x += r;
      hit = true;
    }
  }
  return hit;
}

function makeCar(rng, city, kind, x, y, angle) {
  return {
    kind,
    x, y,
    angle: angle ?? pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: 0,
    maxSpeed: kind === 'police' ? C.policeSpeed : range(rng, 120, 200),
    color: kind === 'police' ? C.palette.police : kind === 'target' ? '#ffd23e' : pick(rng, CAR_COLORS),
    w: 46, h: 22,
    driver: kind !== 'parked',
    health: 100,
    stuck: 0,
  };
}

function randomRoadPoint(rng, city) {
  if (rng() < 0.5) {
    return { x: pick(rng, city.roadsX) + range(rng, -24, 24), y: range(rng, MARGIN, CITY_H - MARGIN) };
  }
  return { x: range(rng, MARGIN, CITY_W - MARGIN), y: pick(rng, city.roadsY) + range(rng, -24, 24) };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const player = {
    x: city.spots.hideout.x + 40,
    y: city.spots.hideout.y + 40,
    angle: -Math.PI / 2,
    health: C.playerHealth,
    money: 0,
    ammo: C.gunAmmoStart,
    inCar: null,
    onFoot: true,
    punchCd: 0,
    gunCd: 0,
    invuln: 0,
  };
  const cars = [];
  // Parked cars (free to take, no wanted).
  for (let i = 0; i < 6; i++) {
    const p = randomRoadPoint(rng, city);
    const c = makeCar(rng, city, 'parked', p.x, p.y);
    c.driver = false;
    cars.push(c);
  }
  // Traffic.
  for (let i = 0; i < C.trafficCars; i++) {
    const p = randomRoadPoint(rng, city);
    const c = makeCar(rng, city, 'traffic', p.x, p.y);
    c.speed = c.maxSpeed * range(rng, 0.6, 1);
    cars.push(c);
  }
  // The marked Comet GT for mission 2 (appears near downtown).
  const targetCar = makeCar(rng, city, 'target', city.roadsX[5], city.roadsY[3]);
  targetCar.driver = true;
  cars.push(targetCar);
  const peds = [];
  for (let i = 0; i < C.pedestrians; i++) {
    const p = randomRoadPoint(rng, city);
    peds.push({
      x: p.x, y: p.y,
      angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: range(rng, C.pedSpeed * 0.6, C.pedSpeed * 1.3),
      color: pick(rng, PED_COLORS),
      state: 'walk',
      fleeX: 0, fleeY: 0,
      down: 0,
      cash: int(rng, 20, 120),
    });
  }
  const pickups = [];
  return {
    seed,
    rng,
    city,
    player,
    cars,
    peds,
    police: [],
    bullets: [],
    particles: [],
    pickups,
    targetCar,
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    missionIndex: 0,
    stageIndex: 0,
    bagsCollected: 0,
    collectedBags: [], // bagSpots indices already picked up (mission 3)
    hasPackage: false,
    hasTargetCar: false,
    debtPaid: 0,
    time: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, copsDodged: 0 },
    message: '',
    messageTimer: 0,
    bustedTimer: 0,
    policeSpawnTimer: 0,
    sirenTimer: 0,
    shake: 0,
  };
}

export function currentMission(world) {
  return MISSIONS[Math.min(world.missionIndex, MISSIONS.length - 1)];
}

export function currentStage(world) {
  const m = currentMission(world);
  return m.stages[Math.min(world.stageIndex, m.stages.length - 1)];
}

export function missionTarget(world) {
  const stage = currentStage(world);
  if (world.missionIndex >= MISSIONS.length) return null;
  if (stage.target === 'bags') {
    // Taken bags are removed from world.pickups on collection, so the
    // collected indices must be tracked separately — otherwise the
    // marker keeps pointing at a bag that is already gone.
    const remaining = world.city.bagSpots.filter((s, i) => !world.collectedBags.includes(i));
    if (remaining.length === 0) return world.city.spots.hideout;
    let best = remaining[0];
    let bd = Infinity;
    for (const s of remaining) {
      const d = (s.x - world.player.x) ** 2 + (s.y - world.player.y) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  if (stage.target === 'targetCar') return { x: world.targetCar.x, y: world.targetCar.y };
  return world.city.spots[stage.target] || null;
}

function say(world, text, dur) {
  world.message = text;
  world.messageTimer = dur || 3.5;
}

function addWanted(world, n, reason) {
  const before = world.wanted;
  world.wanted = Math.min(C.maxWanted, world.wanted + n);
  world.crimeTimer = 0;
  if (world.wanted > before) {
    say(world, reason || ('Wanted level up! ' + '★'.repeat(world.wanted)), 2.5);
  }
}

function spawnPolice(world) {
  const want = 1 + Math.floor(world.wanted / 2);
  // Bounded retries: randomRoadPoint can keep landing too close to the
  // player, and an unbounded loop would hang the frame.
  let tries = 0;
  while (world.police.length < want && tries++ < 40) {
    const p = randomRoadPoint(world.rng, world.city);
    // Spawn a little away from the player so they arrive with sirens.
    const dx = p.x - world.player.x;
    const dy = p.y - world.player.y;
    if (dx * dx + dy * dy < 500 * 500) continue;
    const car = makeCar(world.rng, world.city, 'police', p.x, p.y);
    car.speed = car.maxSpeed * 0.7;
    world.police.push(car);
    world.cars.push(car);
  }
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(world.rng, 0.3, 0.7), max: 0.7, color, size: range(world.rng, 2, 5) });
  }
}

function nearestCar(world, x, y, maxDist, kinds) {
  let best = null;
  let bd = maxDist * maxDist;
  for (const c of world.cars) {
    if (kinds && !kinds.includes(c.kind)) continue;
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function nearestPed(world, x, y, maxDist) {
  let best = null;
  let bd = maxDist * maxDist;
  for (const p of world.peds) {
    if (p.down > 0) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function enterCar(world, audio) {
  const p = world.player;
  const car = nearestCar(world, p.x, p.y, 70, ['traffic', 'parked', 'target']);
  if (!car) return false;
  // Jacking a driven car is a crime; a parked one is free.
  if (car.driver) {
    addWanted(world, world.police.length > 0 ? 2 : 1, 'Car stolen! The cops are coming.');
    world.stats.carsStolen++;
    // The driver flees on foot.
    world.peds.push({
      x: car.x + 30, y: car.y + 30, angle: world.rng() * Math.PI * 2,
      speed: C.pedSpeed * 2.2, color: '#e8e8e8', state: 'flee',
      fleeX: car.x, fleeY: car.y, down: 0, cash: 0,
    });
    car.driver = false;
  }
  p.inCar = car;
  p.onFoot = false;
  car.kind = car.kind === 'target' ? 'target' : 'player';
  if (audio) audio.door();
  return true;
}

export function exitCar(world, audio) {
  const p = world.player;
  if (!p.inCar) return false;
  const car = p.inCar;
  // Step out to the side of the car.
  const sx = Math.cos(car.angle + Math.PI / 2);
  const sy = Math.sin(car.angle + Math.PI / 2);
  p.x = car.x + sx * 40;
  p.y = car.y + sy * 40;
  if (hitsBuilding(world.city, p.x, p.y, C.playerRadius)) {
    p.x = car.x - sx * 40;
    p.y = car.y - sy * 40;
  }
  p.angle = car.angle;
  p.inCar = null;
  p.onFoot = true;
  if (car.kind === 'player') car.kind = 'parked';
  if (audio) audio.door();
  return true;
}

function fireGun(world, tx, ty, audio) {
  const p = world.player;
  if (p.ammo <= 0 || p.gunCd > 0) return;
  p.ammo--;
  p.gunCd = C.gunCooldown;
  world.stats.shotsFired++;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const a = Math.atan2(ty - oy, tx - ox);
  world.bullets.push({ x: ox, y: oy, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: C.gunRange / 900 });
  burst(world, ox + Math.cos(a) * 24, oy + Math.sin(a) * 24, '#ffd23e', 3, 120);
  if (audio) audio.shoot();
  // Firing a gun in public draws the law.
  if (world.wanted < 2) addWanted(world, 1, 'Shots fired! Wanted level up.');
  // Scare nearby pedestrians.
  for (const ped of world.peds) {
    const d = (ped.x - ox) ** 2 + (ped.y - oy) ** 2;
    if (d < 350 * 350 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeX = ox;
      ped.fleeY = oy;
    }
  }
}

function punch(world, audio) {
  const p = world.player;
  if (p.punchCd > 0 || !p.onFoot) return;
  p.punchCd = C.punchCooldown;
  const fx = p.x + Math.cos(p.angle) * 30;
  const fy = p.y + Math.sin(p.angle) * 30;
  const ped = nearestPed(world, fx, fy, C.punchRange);
  if (audio) audio.punch();
  if (ped) {
    ped.down = 2.5;
    burst(world, ped.x, ped.y, '#ffffff', 8, 160);
    if (ped.cash > 0) {
      world.player.money += ped.cash;
      world.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: ped.cash, taken: false, bagIndex: -1 });
      ped.cash = 0;
    }
    addWanted(world, 1, 'Assault! Wanted level up.');
    world.stats.pedsHit++;
  }
}

function completeStage(world, audio) {
  const m = currentMission(world);
  world.stageIndex++;
  if (audio) audio.mission();
  if (world.stageIndex >= m.stages.length) {
    // Mission complete: pay out and advance the story.
    world.player.money += m.reward;
    world.debtPaid += m.reward;
    say(world, 'JOB DONE: ' + m.name + ' — +$' + m.reward.toLocaleString(), 4);
    burst(world, world.player.x, world.player.y, '#ffd23e', 24, 260);
    world.missionIndex++;
    world.stageIndex = 0;
    world.hasPackage = false;
    world.hasTargetCar = false;
    if (world.missionIndex >= MISSIONS.length) {
      say(world, 'DEBT PAID! Solmar is yours, Jax.', 6);
      if (audio) audio.cash();
    }
  }
}

function checkMission(world, audio) {
  if (world.missionIndex >= MISSIONS.length) return;
  const stage = currentStage(world);
  const p = world.player;
  const t = missionTarget(world);
  if (!t) return;
  const d = (p.x - t.x) ** 2 + (p.y - t.y) ** 2;
  if (stage.kind === 'goto' && d < 70 * 70) {
    if (stage.target === 'docks') {
      world.hasPackage = true;
      say(world, 'Package picked up. Deliver it to the pawn shop.', 3);
      if (audio) audio.pickup();
    }
    completeStage(world, audio);
  } else if (stage.kind === 'steal' && p.inCar === world.targetCar) {
    world.hasTargetCar = true;
    say(world, 'Got the Comet GT! Lose the heat and bring it to the chop shop.', 3);
    completeStage(world, audio);
  } else if (stage.kind === 'deliver' && p.inCar === world.targetCar && d < 70 * 70) {
    completeStage(world, audio);
  } else if (stage.kind === 'collect') {
    // Bags are pickups; collection happens in the pickup loop.
    if (world.bagsCollected >= 5) completeStage(world, audio);
  }
}

function ensureBags(world) {
  // Spawn the 5 cash bags when mission 3 starts.
  if (world.missionIndex === 2 && world.stageIndex === 0 && !world.pickups.some((pk) => pk.kind === 'bag')) {
    world.city.bagSpots.forEach((s, i) => {
      world.pickups.push({ x: s.x, y: s.y, kind: 'bag', amount: 0, taken: false, bagIndex: i });
    });
    say(world, 'Five stashes. Grab them all — and watch for the law.', 4);
  }
}

function updateTraffic(world, dt) {
  const city = world.city;
  for (const car of world.cars) {
    if (car.kind === 'player' || car.kind === 'target' && car === world.player.inCar) continue;
    if (car.kind === 'police') continue; // police handled separately
    if (car.kind === 'parked') continue;
    if (car.kind === 'disabled') continue; // shot-out cop stays put, it is not traffic
    // Drive along the current heading; at intersections sometimes turn.
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!onRoad(city, nx, ny)) {
      // Reached a dead end / off road: turn around at the next intersection.
      car.angle += Math.PI / 2 * (world.rng() < 0.5 ? 1 : -1);
      car.stuck += dt;
      if (car.stuck > 2) {
        // Teleport back onto a road to keep traffic flowing.
        const p = randomRoadPoint(world.rng, city);
        car.x = p.x;
        car.y = p.y;
        car.angle = Math.round(world.rng() * 3) * Math.PI / 2;
        car.stuck = 0;
      }
      continue;
    }
    car.stuck = 0;
    car.x = nx;
    car.y = ny;
    // Slow for the car ahead.
    for (const other of world.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 30) {
        car.speed = Math.max(0, other.speed - 40);
      } else {
        car.speed += (car.maxSpeed - car.speed) * dt * 0.5;
      }
    }
    // Random turn at intersections.
    const nearX = city.roadsX.some((rx) => Math.abs(car.x - rx) < 14);
    const nearY = city.roadsY.some((ry) => Math.abs(car.y - ry) < 14);
    if (nearX && nearY && world.rng() < dt * 0.5) {
      car.angle += (world.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
  }
}

function updatePeds(world, dt) {
  for (const ped of world.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    let sp = ped.speed;
    if (ped.state === 'flee') {
      sp = ped.speed * 2.4;
      const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.angle = a;
      ped.x += Math.cos(a) * sp * dt;
      ped.y += Math.sin(a) * sp * dt;
      if (world.rng() < dt * 0.2) ped.state = 'walk';
    } else {
      // Wander along sidewalks: keep walking, turn at random.
      if (world.rng() < dt * 0.25) ped.angle += (world.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      ped.x += Math.cos(ped.angle) * sp * dt;
      ped.y += Math.sin(ped.angle) * sp * dt;
    }
    // Stay in the city and out of buildings.
    ped.x = Math.max(40, Math.min(WORLD_W - 40, ped.x));
    ped.y = Math.max(40, Math.min(WORLD_H - 40, ped.y));
    resolveBuildings(world.city, ped, 10);
  }
}

function updatePolice(world, dt, audio) {
  if (world.wanted > 0) {
    spawnPolice(world);
    world.policeSpawnTimer += dt;
    world.sirenTimer -= dt;
    if (world.sirenTimer <= 0) {
      world.sirenTimer = 2.2;
      if (audio) audio.siren();
    }
  } else {
    // Wanted cleared: police give up and drive off.
    for (const cop of world.police) {
      cop.kind = 'traffic';
      cop.speed = cop.maxSpeed * 0.6;
    }
    world.police = [];
  }
  const p = world.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const cop of world.police) {
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let da = want - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, da));
    cop.speed += (cop.maxSpeed - cop.speed) * dt * 0.8;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(30, Math.min(WORLD_W - 30, cop.x));
    cop.y = Math.max(30, Math.min(WORLD_H - 30, cop.y));
    const hitB = resolveBuildings(world.city, cop, 24);
    if (hitB) cop.speed *= 0.6;
    // Ram the player.
    if (dist < 46) {
      if (p.inCar) {
        const car = p.inCar;
        const push = 260 * dt;
        car.x += (dx / dist) * push * 0.4;
        car.y += (dy / dist) * push * 0.4;
        if (p.invuln <= 0) {
          p.health -= C.policeRamDamage * dt * 3;
          p.invuln = 0.4;
          world.shake = 6;
          if (audio) audio.crash();
        }
      } else if (p.invuln <= 0) {
        p.health -= 22;
        p.invuln = 0.8;
        world.shake = 8;
        if (audio) audio.crash();
        say(world, 'The cops are on you! Run!', 2);
      }
    }
  }
}

function updateBullets(world, dt, audio) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Hit a pedestrian.
    for (const ped of world.peds) {
      if (ped.down > 0) continue;
      if ((ped.x - b.x) ** 2 + (ped.y - b.y) ** 2 < 16 * 16) {
        ped.down = 3;
        b.life = 0;
        burst(world, ped.x, ped.y, '#ff5a5a', 10, 180);
        addWanted(world, 1, 'Pedestrian down! Wanted level up.');
        world.stats.pedsHit++;
        if (ped.cash > 0) {
          world.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: ped.cash, taken: false, bagIndex: -1 });
          ped.cash = 0;
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit a police car.
    for (const cop of world.police) {
      if ((cop.x - b.x) ** 2 + (cop.y - b.y) ** 2 < 26 * 26) {
        cop.health -= C.gunDamage;
        b.life = 0;
        burst(world, b.x, b.y, '#9db8e8', 8, 160);
        if (cop.health <= 0) {
          cop.health = 100;
          cop.speed = 0;
          // Disabled cop: it stops chasing for a while.
          cop.kind = 'disabled';
          world.police = world.police.filter((c) => c !== cop);
          world.stats.copsDodged++;
          say(world, 'Cop car disabled!', 2);
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    if (hitsBuilding(world.city, b.x, b.y, 2)) {
      burst(world, b.x, b.y, '#c9c9c9', 4, 100);
      b.life = 0;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
}

function updatePickups(world, audio) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
    const reach = p.inCar ? 60 : 44;
    if (d < reach * reach) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.money += pk.amount;
        say(world, '+$' + pk.amount, 1.5);
        if (audio) audio.cash();
      } else if (pk.kind === 'ammo') {
        p.ammo += C.ammoPickup;
        say(world, '+' + C.ammoPickup + ' ammo', 1.5);
        if (audio) audio.pickup();
      } else if (pk.kind === 'health') {
        p.health = Math.min(C.playerHealth, p.health + 40);
        say(world, '+40 health', 1.5);
        if (audio) audio.pickup();
      } else if (pk.kind === 'bag') {
        world.bagsCollected++;
        world.collectedBags.push(pk.bagIndex);
        say(world, 'Cash bag ' + world.bagsCollected + '/5', 2);
        burst(world, pk.x, pk.y, '#ffd23e', 14, 200);
        if (audio) audio.cash();
      }
    }
  }
  world.pickups = world.pickups.filter((pk) => !pk.taken);
}

function updateCarPhysics(world, car, dt, input, audio) {
  // Arcade car: W/S accelerate/brake, A/D steer (steering scales with speed).
  const fwd = input.held('KeyW', 'ArrowUp');
  const back = input.held('KeyS', 'ArrowDown');
  const left = input.held('KeyA', 'ArrowLeft');
  const right = input.held('KeyD', 'ArrowRight');
  if (fwd) car.speed += C.carAccel * dt;
  if (back) car.speed -= (car.speed > 0 ? C.carBrake : C.carAccel * 0.6) * dt;
  if (!fwd && !back) car.speed -= car.speed * C.carDrag * dt * 2;
  car.speed = Math.max(-C.carReverseMax, Math.min(C.carMaxSpeed, car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spdFactor = Math.min(1, Math.abs(car.speed) / 160);
  car.angle += steer * C.carTurn * spdFactor * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const ox = car.x;
  const oy = car.y;
  car.x = nx;
  car.y = ny;
  const hitB = resolveBuildings(world.city, car, 24);
  if (hitB) {
    const impact = Math.abs(car.speed);
    if (impact > 240) {
      world.player.health -= Math.min(18, (impact - 240) / 22);
      world.shake = Math.min(10, impact / 40);
      burst(world, car.x, car.y, '#ffb03e', 10, 200);
      if (audio) audio.crash();
    }
    car.speed *= -0.25;
    car.x = ox;
    car.y = oy;
    resolveBuildings(world.city, car, 24);
  }
  // Car-vs-car bumps.
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 48) {
      const push = (48 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      other.x += ux * push;
      other.y += uy * push;
      car.x -= ux * push * 0.5;
      car.y -= uy * push * 0.5;
      if (Math.abs(car.speed) > 200) {
        car.speed *= 0.7;
        if (other.kind === 'traffic' || other.kind === 'parked') {
          // Shove the other car and scare its driver out.
          other.speed = 60;
          if (other.driver && world.rng() < 0.5) {
            other.driver = false;
            world.peds.push({
              x: other.x + 30, y: other.y, angle: world.rng() * Math.PI * 2,
              speed: C.pedSpeed * 2.4, color: '#e8e8e8', state: 'flee',
              fleeX: car.x, fleeY: car.y, down: 0, cash: 0,
            });
          }
        }
        if (audio) audio.crash();
        world.shake = 4;
      }
      // Running over a pedestrian while driving is a crime.
      if (other.kind === 'traffic') {
        // not a ped
      }
    }
  }
  // Running over pedestrians.
  for (const ped of world.peds) {
    if (ped.down > 0) continue;
    const d = (ped.x - car.x) ** 2 + (ped.y - car.y) ** 2;
    if (d < 30 * 30 && Math.abs(car.speed) > 60) {
      ped.down = 3;
      world.stats.pedsHit++;
      addWanted(world, 1, 'Pedestrian hit! Wanted level up.');
      burst(world, ped.x, ped.y, '#ff5a5a', 10, 180);
      if (ped.cash > 0) {
        world.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: ped.cash, taken: false, bagIndex: -1 });
        ped.cash = 0;
      }
    }
  }
  car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));
  if (Math.abs(car.speed) > 300 && world.rng() < dt * 8 && audio) audio.engine();
}

function updatePlayerOnFoot(world, dt, input, audio) {
  const p = world.player;
  const run = input.held('ShiftLeft', 'ShiftRight');
  const sp = run ? C.runSpeed : C.walkSpeed;
  let mx = 0;
  let my = 0;
  if (input.held('KeyW', 'ArrowUp')) my -= 1;
  if (input.held('KeyS', 'ArrowDown')) my += 1;
  if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.held('KeyD', 'ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * sp * dt;
    p.y += (my / len) * sp * dt;
    p.angle = Math.atan2(my, mx);
    resolveBuildings(world.city, p, C.playerRadius);
  }
  p.x = Math.max(20, Math.min(WORLD_W - 20, p.x));
  p.y = Math.max(20, Math.min(WORLD_H - 20, p.y));
  // Aim with the mouse; Space punches, click shoots.
  if (input.mouse) {
    p.aimAngle = Math.atan2(input.mouse.worldY - p.y, input.mouse.worldX - p.x);
  }
  if (input.wasPressed('Space')) punch(world, audio);
  if (input.mouse && input.mouse.down && p.gunCd <= 0) {
    fireGun(world, input.mouse.worldX, input.mouse.worldY, audio);
  }
}

export function updateWorld(world, input, dt, audio) {
  world.time += dt;
  const p = world.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.gunCd = Math.max(0, p.gunCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 22);
  // Enter / exit car.
  if (input.wasPressed('KeyE')) {
    if (p.onFoot) enterCar(world, audio);
    else exitCar(world, audio);
  }
  if (p.inCar) {
    updateCarPhysics(world, p.inCar, dt, input, audio);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    // Drive-by shooting with the mouse.
    if (input.mouse && input.mouse.down && p.gunCd <= 0) {
      fireGun(world, input.mouse.worldX, input.mouse.worldY, audio);
    }
  } else {
    updatePlayerOnFoot(world, dt, input, audio);
  }
  ensureBags(world);
  updateTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt, audio);
  updateBullets(world, dt, audio);
  updatePickups(world, audio);
  checkMission(world, audio);
  // Wanted decay: lay low and the heat dies down.
  if (world.wanted > 0) {
    world.crimeTimer += dt;
    const policeNear = world.police.some((c) => {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      return d < 520 * 520;
    });
    if (world.crimeTimer > C.wantedDecayTime && !policeNear) {
      world.wanted--;
      world.crimeTimer = 0;
      say(world, world.wanted === 0 ? 'You lost them. The heat is off.' : 'Wanted level down.', 2.5);
      if (world.wanted === 0) world.stats.copsDodged++;
    }
  }
  // Slow health regen when calm.
  if (world.wanted === 0 && p.health > 0 && p.health < C.playerHealth) {
    p.health = Math.min(C.playerHealth, p.health + 2.5 * dt);
  }
  // Particles.
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  // Death / busted.
  if (p.health <= 0) {
    if (world.wanted > 0) {
      world.bustedTimer = 1;
      return 'busted';
    }
    return 'wasted';
  }
  if (world.missionIndex >= MISSIONS.length) return 'won';
  return 'playing';
}

export function respawn(world) {
  const p = world.player;
  p.health = C.playerHealth;
  p.x = world.city.spots.hideout.x + 40;
  p.y = world.city.spots.hideout.y + 40;
  p.angle = -Math.PI / 2;
  if (p.inCar) {
    p.inCar.kind = 'parked';
    p.inCar = null;
    p.onFoot = true;
  }
  if (world.wanted > 0) {
    p.money = Math.max(0, p.money - 1000);
    world.wanted = 0;
    world.police = [];
  }
  world.bustedTimer = 0;
}

// Save / load (localStorage).
export function saveGame(world) {
  try {
    const p = world.player;
    const data = {
      money: p.money,
      debtPaid: world.debtPaid,
      missionIndex: world.missionIndex,
      stageIndex: world.stageIndex,
      bagsCollected: world.bagsCollected,
      health: p.health,
      ammo: p.ammo,
      x: p.x,
      y: p.y,
      stats: world.stats,
      time: world.time,
    };
    localStorage.setItem('solmar-heat-save-v1', JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem('solmar-heat-save-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem('solmar-heat-save-v1');
  } catch {
    return false;
  }
}

export function applySave(world, save) {
  const p = world.player;
  p.money = save.money || 0;
  world.debtPaid = save.debtPaid || 0;
  world.missionIndex = save.missionIndex || 0;
  world.stageIndex = save.stageIndex || 0;
  world.bagsCollected = save.bagsCollected || 0;
  p.health = save.health ?? C.playerHealth;
  p.ammo = save.ammo ?? C.gunAmmoStart;
  if (save.x !== undefined) {
    p.x = save.x;
    p.y = save.y;
  }
  if (save.stats) world.stats = save.stats;
  if (save.time) world.time = save.time;
  // If the save is mid-mission-3, respawn the bags.
  if (world.missionIndex === 2) {
    world.pickups = world.pickups.filter((pk) => pk.kind !== 'bag');
    world.collectedBags = [];
    for (let i = 0; i < world.bagsCollected; i++) world.collectedBags.push(i);
    world.city.bagSpots.forEach((s, i) => {
      if (i >= world.bagsCollected) world.pickups.push({ x: s.x, y: s.y, kind: 'bag', amount: 0, taken: false, bagIndex: i });
    });
  }
}
