// SOLMAR HEAT — the world. One job: the whole simulation — city, traffic,
// pedestrians, police, wanted level, combat, missions, save data.
// Pure logic: no DOM, no canvas, no AudioContext here, so Node can import it
// headlessly and drive it with a plain input object.
import { CFG, SPOTS, MISSIONS } from './config.js';
import { makeRng } from './random.js';

export const roadCenter = (i) => CFG.ROAD / 2 + i * CFG.PITCH;
export const blockOrigin = (i) => CFG.ROAD + i * CFG.PITCH;
const WATER_Y = () => CFG.SIZE - CFG.ROAD; // south strip is the sea

export function isInWater(x, y) {
  return y > WATER_Y();
}

function onRoadAxis(v) {
  const m = (((v - CFG.ROAD / 2) % CFG.PITCH) + CFG.PITCH) % CFG.PITCH;
  return m < CFG.ROAD;
}
export function isOnRoad(x, y) {
  return onRoadAxis(x) || onRoadAxis(y);
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function pushOutOfRect(pos, r, rect) {
  const cx = Math.max(rect.x, Math.min(pos.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(pos.y, rect.y + rect.h));
  let dx = pos.x - cx;
  let dy = pos.y - cy;
  let d = Math.hypot(dx, dy);
  if (d >= r) return;
  if (d < 0.001) {
    // Centre is inside the rect: push out along the smallest penetration.
    const left = pos.x - rect.x;
    const right = rect.x + rect.w - pos.x;
    const top = pos.y - rect.y;
    const bottom = rect.y + rect.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = rect.x - r;
    else if (m === right) pos.x = rect.x + rect.w + r;
    else if (m === top) pos.y = rect.y - r;
    else pos.y = rect.y + rect.h + r;
    return;
  }
  dx /= d;
  dy /= d;
  pos.x = cx + dx * r;
  pos.y = cy + dy * r;
}

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33a', '#7fc24f', '#c9c9c9', '#8a5fd0', '#e07a2e', '#4fd0c9'];
const PED_COLORS = ['#f2c14e', '#e07856', '#5ba8a0', '#c96f8e', '#8a7fc0', '#7fc24f', '#d9d9d9', '#e8a54b'];

function randomWalkTarget(rng, buildings) {
  for (let tries = 0; tries < 12; tries++) {
    const x = rng.range(60, CFG.SIZE - 60);
    const y = rng.range(60, WATER_Y() - 40);
    if (isInWater(x, y)) continue;
    if (buildings.some((b) => circleHitsRect(x, y, 20, b))) continue;
    return { x, y };
  }
  return { x: CFG.SIZE / 2, y: CFG.SIZE / 2 };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];

  for (let c = 0; c < CFG.GRID; c++) {
    for (let r = 0; r < CFG.GRID; r++) {
      const bx = blockOrigin(c);
      const by = blockOrigin(r);
      if (r === CFG.GRID - 1) {
        // Beach row: sand, palms, no buildings.
        const palms = rng.int(2, 5);
        for (let i = 0; i < palms; i++) {
          trees.push({ x: bx + rng.range(24, CFG.BLOCK - 24), y: by + rng.range(24, CFG.BLOCK - 24), palm: true });
        }
        continue;
      }
      if ((c + r) % 4 === 0) {
        parks.push({ x: bx, y: by, w: CFG.BLOCK, h: CFG.BLOCK });
        const n = rng.int(5, 9);
        for (let i = 0; i < n; i++) {
          trees.push({ x: bx + rng.range(20, CFG.BLOCK - 20), y: by + rng.range(20, CFG.BLOCK - 20), palm: false });
        }
        continue;
      }
      const roof = rng.pick(CFG.COLORS.buildingRoof);
      const wall = rng.pick(CFG.COLORS.buildingWall);
      if (rng.chance(0.45)) {
        buildings.push({ x: bx + 16, y: by + 16, w: CFG.BLOCK - 32, h: CFG.BLOCK - 32, roof, wall, big: true });
      } else {
        const splitV = rng.chance(0.5);
        for (let k = 0; k < 2; k++) {
          if (splitV) {
            buildings.push({
              x: bx + 14,
              y: by + 14 + k * (CFG.BLOCK / 2),
              w: CFG.BLOCK - 28,
              h: CFG.BLOCK / 2 - 22,
              roof: rng.pick(CFG.COLORS.buildingRoof),
              wall,
              big: false,
            });
          } else {
            buildings.push({
              x: bx + 14 + k * (CFG.BLOCK / 2),
              y: by + 14,
              w: CFG.BLOCK / 2 - 22,
              h: CFG.BLOCK - 28,
              roof: rng.pick(CFG.COLORS.buildingRoof),
              wall,
              big: false,
            });
          }
        }
      }
    }
  }

  // Traffic cars drive the road grid.
  const cars = [];
  for (let i = 0; i < CFG.TRAFFIC_CARS; i++) {
    const horizontal = rng.chance(0.5);
    const road = rng.int(0, CFG.GRID + 1);
    const lane = rng.pick([-14, 14]);
    const dir = rng.pick([-1, 1]);
    const along = rng.range(80, CFG.SIZE - 80);
    cars.push({
      id: `traffic-${i}`,
      kind: 'traffic',
      x: horizontal ? along : roadCenter(road) + lane,
      y: horizontal ? roadCenter(road) + lane : along,
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      speed: rng.range(90, CFG.TRAFFIC_SPEED),
      cruise: rng.range(90, CFG.TRAFFIC_SPEED),
      axis: horizontal ? 'x' : 'y',
      dir,
      color: rng.pick(CAR_COLORS),
      driver: true,
      hp: 100,
      wrecked: false,
    });
  }

  // Parked cars sit at the kerb, free for the taking. None parks near the
  // Comet GT's spot, so mission 2's prize is always the obvious car there.
  for (let i = 0; i < CFG.PARKED_CARS; i++) {
    let horizontal = rng.chance(0.5);
    let px = 0;
    let py = 0;
    for (let tries = 0; tries < 20; tries++) {
      horizontal = rng.chance(0.5);
      const road = rng.int(1, CFG.GRID);
      const along = rng.range(150, CFG.SIZE - 150);
      const side = rng.pick([-1, 1]);
      const off = (CFG.ROAD / 2 - 15) * side;
      px = horizontal ? along : roadCenter(road) + off;
      py = horizontal ? roadCenter(road) + off : along;
      if (Math.hypot(px - SPOTS.cometGt.x, py - SPOTS.cometGt.y) > 160) break;
    }
    cars.push({
      id: `parked-${i}`,
      kind: 'parked',
      x: px,
      y: py,
      angle: horizontal ? 0 : Math.PI / 2,
      speed: 0,
      cruise: 0,
      axis: horizontal ? 'x' : 'y',
      dir: 1,
      color: rng.pick(CAR_COLORS),
      driver: false,
      hp: 100,
      wrecked: false,
    });
  }

  // The Comet GT: the prize of mission 2, parked downtown.
  cars.push({
    id: 'comet',
    kind: 'comet',
    x: SPOTS.cometGt.x,
    y: SPOTS.cometGt.y,
    angle: 0,
    speed: 0,
    cruise: 0,
    axis: 'x',
    dir: 1,
    color: '#e8c33a',
    driver: false,
    hp: 100,
    wrecked: false,
  });

  const peds = [];
  for (let i = 0; i < CFG.PEDESTRIANS; i++) {
    const t = randomWalkTarget(rng, buildings);
    peds.push({
      id: `ped-${i}`,
      x: t.x,
      y: t.y,
      tx: t.x,
      ty: t.y,
      speed: rng.range(40, CFG.PED_SPEED),
      color: rng.pick(PED_COLORS),
      down: 0,
      flee: 0,
      angle: rng.range(0, Math.PI * 2),
    });
  }

  const ammoBoxes = [
    { x: 300, y: 1200, taken: false },
    { x: 1300, y: 300, taken: false },
    { x: 2050, y: 1500, taken: false },
    { x: 800, y: 2050, taken: false },
    { x: 1900, y: 600, taken: false },
  ];

  const start = { x: SPOTS.hideout.x, y: SPOTS.hideout.y + 60 };
  return {
    seed,
    time: 0,
    state: 'playing', // playing | busted | wasted | won
    stateTimer: 0,
    player: {
      x: start.x,
      y: start.y,
      angle: -Math.PI / 2,
      health: CFG.PLAYER_HEALTH,
      money: CFG.START_MONEY,
      ammo: CFG.PISTOL_AMMO_START,
      car: null,
      carHp: 100,
      speed: 0,
    },
    wanted: 0,
    crimeTimer: 0,
    debtPaid: 0,
    mission: 1,
    missionStage: 0,
    packageHeld: false,
    cometStolen: false,
    bagsCollected: 0,
    bags: SPOTS.cashBags.map((b) => ({ x: b.x, y: b.y, taken: false })),
    ammoBoxes,
    cars,
    peds,
    police: [],
    policeSpawnTimer: 0,
    bustedHold: 0,
    buildings,
    trees,
    parks,
    particles: [],
    message: 'Jax owes Sal $50,000. Time to work it off.',
    messageTimer: 6,
    stats: { carsStolen: 0, crimes: 0, shotsFired: 0, pedsDown: 0, missionsDone: 0 },
    frozen: false,
    rngState: null,
  };
}

export function debtLeft(w) {
  return Math.max(0, CFG.DEBT_TOTAL - w.debtPaid);
}

export function currentObjective(w) {
  if (w.state === 'won') return 'Debt paid. Solmar is yours, Jax.';
  return MISSIONS[w.mission - 1].objective(w);
}

export function currentTarget(w) {
  if (w.mission === 1) return w.missionStage === 0 ? SPOTS.docksPackage : SPOTS.pawnShop;
  if (w.mission === 2) return w.cometStolen ? SPOTS.chopShop : SPOTS.cometGt;
  if (w.mission === 3) {
    const next = w.bags.find((b) => !b.taken);
    return next ? { x: next.x, y: next.y } : SPOTS.hideout;
  }
  return null;
}

function setMessage(w, text, seconds = 4) {
  w.message = text;
  w.messageTimer = seconds;
}

function addWanted(w, n, hooks) {
  if (w.wanted >= CFG.WANTED_MAX) return;
  w.wanted = Math.min(CFG.WANTED_MAX, w.wanted + n);
  w.crimeTimer = 0;
  w.stats.crimes++;
  if (hooks) hooks.sfx?.('siren');
}

function payMission(w, amount, hooks) {
  w.player.money += amount;
  w.debtPaid += amount;
  w.stats.missionsDone++;
  if (hooks) hooks.sfx?.('cash');
}

function spawnParticles(w, x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 });
  }
  if (w.particles.length > 400) w.particles.splice(0, w.particles.length - 400);
}

function collideWorld(pos, r, w) {
  pos.x = Math.max(r, Math.min(CFG.SIZE - r, pos.x));
  pos.y = Math.max(r, Math.min(WATER_Y() - r, pos.y));
  for (const b of w.buildings) pushOutOfRect(pos, r, b);
}

function nearestCar(w, x, y, maxDist) {
  // Prefer a parked car (or the Comet GT) over a passing traffic car: when
  // the player stands next to a parked car, that is the one they mean.
  for (const pass of ['parked', 'traffic']) {
    let best = null;
    let bestD = maxDist;
    for (const c of w.cars) {
      if (c.wrecked) continue;
      const isParked = c.kind === 'parked' || c.kind === 'comet';
      if ((pass === 'parked') !== isParked) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return best;
  }
  return null;
}

function enterCar(w, car, hooks) {
  const p = w.player;
  p.car = car;
  p.carHp = car.hp;
  car.speed = 0;
  if (car.kind === 'traffic' && car.driver) {
    car.driver = false;
    w.stats.carsStolen++;
    addWanted(w, 1, hooks);
    setMessage(w, 'You jacked a car! The driver ran off screaming.', 4);
    // The driver flees on foot.
    w.peds.push({
      id: `driver-${Date.now() % 100000}`,
      x: car.x + 30,
      y: car.y + 30,
      tx: car.x + 300,
      ty: car.y - 200,
      speed: 180,
      color: '#e8e8e8',
      down: 0,
      flee: 6,
      angle: 0,
    });
    if (hooks) hooks.sfx?.('door');
  } else {
    w.stats.carsStolen++;
    if (car.kind === 'comet' && w.mission === 2 && !w.cometStolen) {
      w.cometStolen = true;
      setMessage(w, 'Got the Comet GT! Now get it to the chop shop.', 4);
    } else if (car.kind === 'parked') {
      setMessage(w, 'Nice ride. Nobody saw a thing.', 3);
    }
    if (hooks) hooks.sfx?.('door');
  }
}

function exitCar(w, hooks) {
  const p = w.player;
  const car = p.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.angle = car.angle;
  p.car = null;
  collideWorld(p, CFG.PLAYER_RADIUS, w);
  if (hooks) hooks.sfx?.('door');
}

function spawnPolice(w) {
  const p = w.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 550 + Math.random() * 200;
    const x = px + Math.cos(a) * d;
    const y = py + Math.sin(a) * d;
    if (x < 60 || x > CFG.SIZE - 60 || y < 60 || y > WATER_Y() - 60) continue;
    if (isInWater(x, y)) continue;
    // Snap onto the nearest road so the cruiser starts on asphalt.
    const rx = isOnRoad(x, y) ? x : Math.round((x - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2;
    const ry = isOnRoad(x, y) ? y : Math.round((y - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2;
    w.police.push({
      x: rx,
      y: ry,
      angle: Math.atan2(py - ry, px - rx),
      speed: 0,
      hp: 120,
      color: '#1c2733',
      light: 0,
    });
    return;
  }
}

function updateTraffic(w, dt) {
  const pc = w.player.car;
  for (const c of w.cars) {
    if (c.kind !== 'traffic' || c.wrecked) continue;
    if (!pc || pc !== c) {
      // Do not drive through the player's car: stop behind it.
      if (pc) {
        const dx = pc.x - c.x;
        const dy = pc.y - c.y;
        const d = Math.hypot(dx, dy);
        const heading = c.axis === 'x' ? (c.dir > 0 ? 1 : -1) : 0;
        const headingY = c.axis === 'y' ? (c.dir > 0 ? 1 : -1) : 0;
        const toward = d > 0.01 ? (dx * heading + dy * headingY) / d : 0;
        if (d < 60 && toward > 0.3) continue;
      }
      // Drive along the current axis; turn at intersections sometimes.
      const nearRoadX = Math.abs((((c.x - CFG.ROAD / 2) % CFG.PITCH) + CFG.PITCH) % CFG.PITCH) < 12;
      const nearRoadY = Math.abs((((c.y - CFG.ROAD / 2) % CFG.PITCH) + CFG.PITCH) % CFG.PITCH) < 12;
      const atCrossing = c.axis === 'x' ? nearRoadY : nearRoadX;
      if (atCrossing && Math.random() < 0.25 * dt * 10) {
        const turn = Math.random() < 0.5;
        if (turn) {
          if (c.axis === 'x') {
            c.axis = 'y';
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.y = Math.round((c.y - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2 + (c.dir > 0 ? -14 : 14);
          } else {
            c.axis = 'x';
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.x = Math.round((c.x - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2 + (c.dir > 0 ? -14 : 14);
          }
        }
      }
      if (c.axis === 'x') {
        c.x += c.dir * c.cruise * dt;
        c.angle = c.dir > 0 ? 0 : Math.PI;
        if (c.x < 40) { c.x = 40; c.dir = 1; }
        if (c.x > CFG.SIZE - 40) { c.x = CFG.SIZE - 40; c.dir = -1; }
      } else {
        c.y += c.dir * c.cruise * dt;
        c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (c.y < 40) { c.y = 40; c.dir = 1; }
        if (c.y > WATER_Y() - 40) { c.y = WATER_Y() - 40; c.dir = -1; }
      }
      // Stay glued to the lane.
      if (c.axis === 'x') {
        const lane = Math.round((c.y - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2;
        c.y += (lane - c.y) * Math.min(1, dt * 3);
      } else {
        const lane = Math.round((c.x - CFG.ROAD / 2) / CFG.PITCH) * CFG.PITCH + CFG.ROAD / 2;
        c.x += (lane - c.x) * Math.min(1, dt * 3);
      }
    }
  }
}

function updatePeds(w, dt, hooks) {
  const p = w.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const playerSpeed = p.car ? Math.abs(p.car.speed) : 0;
  for (const ped of w.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    const d = Math.hypot(ped.x - px, ped.y - py);
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - py, ped.x - px);
      ped.x += Math.cos(a) * 190 * dt;
      ped.y += Math.sin(a) * 190 * dt;
      ped.angle = a;
    } else {
      if (d < 130 && playerSpeed > 120) ped.flee = 2.5;
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        const t = randomWalkTarget(makeRng((Math.random() * 1e9) | 0), w.buildings);
        ped.tx = t.x;
        ped.ty = t.y;
      } else {
        ped.x += (dx / dist) * ped.speed * dt;
        ped.y += (dy / dist) * ped.speed * dt;
        ped.angle = Math.atan2(dy, dx);
      }
    }
    collideWorld(ped, 10, w);
    // Run over by a car.
    if (p.car && d < 30 && playerSpeed > 60) {
      ped.down = 4;
      addWanted(w, 2, hooks);
      spawnParticles(w, ped.x, ped.y, '#e07856', 10);
      w.stats.pedsDown++;
      if (hooks) hooks.sfx?.('crash');
      setMessage(w, 'You ran someone over! The cops noticed.', 3);
    }
  }
}

function updatePolice(w, dt, hooks) {
  const p = w.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  // Spawn up to one cruiser per wanted star.
  const want = Math.min(w.wanted, CFG.POLICE_MAX);
  w.policeSpawnTimer -= dt;
  if (w.police.length < want && w.policeSpawnTimer <= 0) {
    spawnPolice(w);
    w.policeSpawnTimer = 2.5;
    if (hooks) hooks.sfx?.('siren');
  }
  for (const cop of w.police) {
    cop.light += dt * 8;
    const wantAngle = Math.atan2(py - cop.y, px - cop.x);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    cop.speed = Math.min(CFG.POLICE_SPEED, cop.speed + 260 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    collideWorld(cop, 18, w);
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (d < 46) {
      // Ram!
      if (p.car) {
        p.carHp -= 22 * dt * 10 * 0.12;
        p.car.speed *= 0.94;
        spawnParticles(w, cop.x, cop.y, '#f2c14e', 6);
        if (hooks) hooks.sfx?.('crash');
        if (p.carHp <= 0) {
          p.car.wrecked = true;
          p.car.speed = 0;
          setMessage(w, 'Your car is wrecked! Bail out!', 4);
          exitCar(w, hooks);
          p.carHp = 100;
        }
      } else {
        p.health -= 26 * dt * 4;
        p.x += Math.cos(cop.angle) * 60 * dt;
        p.y += Math.sin(cop.angle) * 60 * dt;
        if (hooks) hooks.sfx?.('crash');
      }
      // Being rammed on foot is what gets you busted; rams against your car
      // only damage the car, they never count toward a bust.
      if (!p.car) {
        w.bustedHold += dt;
        if (w.bustedHold > CFG.BUSTED_HOLD_SECONDS) {
          w.state = 'busted';
          w.stateTimer = 0;
          if (hooks) hooks.sfx?.('busted');
        }
      } else {
        w.bustedHold = Math.max(0, w.bustedHold - dt * 2);
      }
    } else {
      w.bustedHold = Math.max(0, w.bustedHold - dt * 2);
    }
  }
  // Wanted decays when you lay low.
  if (w.wanted > 0) {
    w.crimeTimer += dt;
    const nearestCop = w.police.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.y - py)), Infinity);
    if (w.crimeTimer > CFG.WANTED_DECAY_SECONDS && nearestCop > 500) {
      w.wanted--;
      w.crimeTimer = 0;
      if (w.wanted === 0) setMessage(w, 'You lost the cops. Stay cool.', 3);
    }
  }
}

function updateMissions(w, hooks) {
  const p = w.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  if (w.mission === 1) {
    if (w.missionStage === 0 && Math.hypot(px - SPOTS.docksPackage.x, py - SPOTS.docksPackage.y) < 44) {
      w.packageHeld = true;
      w.missionStage = 1;
      setMessage(w, 'Package secured. Deliver it to the pawn shop.', 4);
      if (hooks) hooks.sfx?.('pickup');
    } else if (w.missionStage === 1 && Math.hypot(px - SPOTS.pawnShop.x, py - SPOTS.pawnShop.y) < 54) {
      payMission(w, CFG.MISSION_PAY[0], hooks);
      w.mission = 2;
      w.missionStage = 0;
      setMessage(w, 'The Pickup done — $8,000. Sal sends his regards. Next: Hot Wheels.', 5);
    }
  } else if (w.mission === 2) {
    if (w.cometStolen && p.car && p.car.kind === 'comet' && Math.hypot(px - SPOTS.chopShop.x, py - SPOTS.chopShop.y) < 64) {
      payMission(w, CFG.MISSION_PAY[1], hooks);
      w.mission = 3;
      setMessage(w, 'Hot Wheels done — $14,000. One job left: The Big Score.', 5);
    }
  } else if (w.mission === 3) {
    for (const bag of w.bags) {
      if (!bag.taken && Math.hypot(px - bag.x, py - bag.y) < 40) {
        bag.taken = true;
        w.bagsCollected++;
        if (hooks) hooks.sfx?.('pickup');
        setMessage(w, `Cash bag ${w.bagsCollected}/5. ${5 - w.bagsCollected} to go.`, 3);
      }
    }
    if (w.bagsCollected >= 5 && Math.hypot(px - SPOTS.hideout.x, py - SPOTS.hideout.y) < 60) {
      payMission(w, CFG.MISSION_PAY[2], hooks);
      w.state = 'won';
      w.stateTimer = 0;
      setMessage(w, 'Debt paid. Solmar is yours, Jax.', 6);
      if (hooks) hooks.sfx?.('win');
    }
  }
  // Ammo pickups.
  for (const box of w.ammoBoxes) {
    if (!box.taken && Math.hypot(px - box.x, py - box.y) < 36) {
      box.taken = true;
      p.ammo += CFG.AMMO_PICKUP;
      setMessage(w, `+${CFG.AMMO_PICKUP} pistol ammo.`, 3);
      if (hooks) hooks.sfx?.('pickup');
    }
  }
}

function doPunch(w, hooks) {
  const p = w.player;
  if (p.car) return;
  const fx = p.x + Math.cos(p.angle) * 30;
  const fy = p.y + Math.sin(p.angle) * 30;
  let hit = false;
  for (const ped of w.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - fx, ped.y - fy) < CFG.PUNCH_RANGE) {
      ped.down = 3;
      ped.flee = 5;
      w.stats.pedsDown++;
      addWanted(w, 1, hooks);
      spawnParticles(w, ped.x, ped.y, '#f2c14e', 8);
      if (Math.random() < 0.4) {
        p.money += 20;
        setMessage(w, 'You roughed him up and took $20.', 3);
      } else {
        setMessage(w, 'You decked a pedestrian! Witnesses called it in.', 3);
      }
      hit = true;
      break;
    }
  }
  if (hooks) hooks.sfx?.('punch');
  if (!hit) spawnParticles(w, fx, fy, '#ffffff', 3, 60);
}

function doShoot(w, input, hooks) {
  const p = w.player;
  if (p.car || p.ammo <= 0) return;
  p.ammo--;
  w.stats.shotsFired++;
  const ax = input.aimX ?? p.x + Math.cos(p.angle) * 100;
  const ay = input.aimY ?? p.y + Math.sin(p.angle) * 100;
  const ang = Math.atan2(ay - p.y, ax - p.x);
  p.angle = ang;
  if (hooks) hooks.sfx?.('shoot');
  const range = CFG.PISTOL_RANGE;
  const tx = p.x + Math.cos(ang) * range;
  const ty = p.y + Math.sin(ang) * range;
  spawnParticles(w, p.x + Math.cos(ang) * 22, p.y + Math.sin(ang) * 22, '#ffd76a', 4, 220);
  // Nearest target near the firing line.
  let best = null;
  let bestD = Infinity;
  const consider = (x, y, kind, ref) => {
    const dx = x - p.x;
    const dy = y - p.y;
    const along = dx * Math.cos(ang) + dy * Math.sin(ang);
    if (along < 10 || along > range) return;
    const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
    if (perp < 26 && along < bestD) {
      bestD = along;
      best = { kind, ref, x, y };
    }
  };
  for (const ped of w.peds) if (ped.down <= 0) consider(ped.x, ped.y, 'ped', ped);
  for (const cop of w.police) consider(cop.x, cop.y, 'cop', cop);
  for (const car of w.cars) {
    if (car === p.car || car.wrecked) continue;
    consider(car.x, car.y, 'car', car);
  }
  if (best) {
    spawnParticles(w, best.x, best.y, '#e07856', 10);
    if (best.kind === 'ped') {
      best.ref.down = 5;
      best.ref.flee = 6;
      w.stats.pedsDown++;
      addWanted(w, 2, hooks);
      setMessage(w, 'You shot a pedestrian! The whole city heard that.', 3);
    } else if (best.kind === 'cop') {
      best.ref.hp -= CFG.PISTOL_DAMAGE;
      addWanted(w, 1, hooks);
      if (best.ref.hp <= 0) {
        w.police = w.police.filter((c) => c !== best.ref);
        addWanted(w, 1, hooks);
        setMessage(w, 'You took out a cruiser!', 3);
      }
    } else {
      best.ref.hp -= CFG.PISTOL_DAMAGE;
      if (best.ref.hp <= 0) best.ref.wrecked = true;
    }
  }
  void tx;
  void ty;
}

// One simulation tick. input: {up,down,left,right,run,act,punch,shoot,aimX,aimY}.
export function stepWorld(w, input, dt, hooks) {
  if (w.frozen) return;
  dt = Math.min(dt, 0.05);
  if (w.state === 'won') {
    w.stateTimer += dt;
    return;
  }
  w.time += dt;
  if (w.messageTimer > 0) w.messageTimer -= dt;
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);

  if (w.state === 'busted' || w.state === 'wasted') {
    w.stateTimer += dt;
    return;
  }

  const p = w.player;

  if (input.act) {
    if (p.car) exitCar(w, hooks);
    else {
      const car = nearestCar(w, p.x, p.y, 62);
      if (car) enterCar(w, car, hooks);
    }
  }

  if (p.car) {
    const car = p.car;
    const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const forward = Math.cos(car.angle);
    const right = Math.sin(car.angle);
    const speedAlong = car.speed;
    if (input.up) car.speed += CFG.CAR_ACCEL * dt;
    if (input.down) {
      if (car.speed > 20) car.speed -= CFG.CAR_BRAKE * dt;
      else car.speed -= CFG.CAR_ACCEL * 0.6 * dt;
    }
    if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * CFG.CAR_DRAG * 120 * dt;
    if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
    car.speed = Math.max(-CFG.CAR_REVERSE_MAX, Math.min(CFG.CAR_MAX_SPEED, car.speed));
    const steer = steerInput * CFG.CAR_STEER * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
    car.angle += steer * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    car.x = nx;
    car.y = ny;
    collideWorld(car, 20, w);
    const moved = Math.hypot(car.x - before.x, car.y - before.y);
    const want = Math.hypot(nx - before.x, ny - before.y);
    if (want > 1 && moved < want * 0.5 && Math.abs(car.speed) > 60) {
      // Scraped a building.
      car.speed *= 0.55;
      if (hooks) hooks.sfx?.('crash');
      spawnParticles(w, car.x, car.y, '#f2c14e', 5);
    }
    void forward;
    void right;
    void speedAlong;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    // Car-car bumps.
    for (const other of w.cars) {
      if (other === car || other.wrecked) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uy = (car.y - other.y) / d;
        car.x += ux * push;
        car.y += uy * push;
        if (other.kind === 'traffic') {
          other.x -= ux * push;
          other.y -= uy * push;
        }
        if (Math.abs(car.speed) > 90 && w.time - (car._bumpAt || -9) > 0.6) {
          car._bumpAt = w.time;
          p.carHp -= 6;
          if (hooks) hooks.sfx?.('crash');
          spawnParticles(w, car.x, car.y, '#f2c14e', 6);
          if (p.carHp <= 0) {
            car.wrecked = true;
            car.speed = 0;
            setMessage(w, 'Your car is wrecked! Bail out!', 4);
            exitCar(w, hooks);
            p.carHp = 100;
          }
        }
      }
    }
  } else {
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const speed = input.run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
      p.x += (mx / len) * speed * dt;
      p.y += (my / len) * speed * dt;
      p.angle = Math.atan2(my, mx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    collideWorld(p, CFG.PLAYER_RADIUS, w);
    if (input.punch) doPunch(w, hooks);
    if (input.shoot) doShoot(w, input, hooks);
  }

  updateTraffic(w, dt);
  updatePeds(w, dt, hooks);
  updatePolice(w, dt, hooks);
  updateMissions(w, hooks);

  // Slow health regen while nobody is looking for you.
  if (w.wanted === 0 && p.health < CFG.PLAYER_HEALTH) {
    p.health = Math.min(CFG.PLAYER_HEALTH, p.health + 2 * dt);
  }
  if (p.health <= 0) {
    w.state = 'wasted';
    w.stateTimer = 0;
    p.money = Math.max(0, p.money - 1000);
    if (hooks) hooks.sfx?.('busted');
  }
}

// Put the player back on their feet after busted / wasted.
export function respawnPlayer(w) {
  const p = w.player;
  if (p.car) {
    p.car.speed = 0;
    p.car = null;
  }
  p.x = w.state === 'wasted' ? SPOTS.hospital.x : SPOTS.hideout.x;
  p.y = w.state === 'wasted' ? SPOTS.hospital.y : SPOTS.hideout.y + 60;
  p.health = CFG.PLAYER_HEALTH;
  p.carHp = 100;
  w.wanted = 0;
  w.crimeTimer = 0;
  w.police = [];
  w.bustedHold = 0;
  w.state = 'playing';
  w.stateTimer = 0;
  setMessage(w, w.state === 'playing' ? 'Back on your feet. Sal is still waiting.' : '', 4);
}

export function serializeWorld(w) {
  return {
    seed: w.seed,
    time: w.time,
    money: w.player.money,
    health: w.player.health,
    ammo: w.player.ammo,
    debtPaid: w.debtPaid,
    mission: w.mission,
    missionStage: w.missionStage,
    packageHeld: w.packageHeld,
    cometStolen: w.cometStolen,
    bagsCollected: w.bagsCollected,
    bagsTaken: w.bags.map((b) => b.taken),
    playerX: w.player.x,
    playerY: w.player.y,
    wanted: w.wanted,
    stats: w.stats,
  };
}

export function applySave(w, save) {
  if (!save || typeof save !== 'object') return false;
  w.time = save.time || 0;
  w.player.money = save.money ?? CFG.START_MONEY;
  w.player.health = save.health ?? CFG.PLAYER_HEALTH;
  w.player.ammo = save.ammo ?? CFG.PISTOL_AMMO_START;
  w.debtPaid = save.debtPaid || 0;
  w.mission = save.mission || 1;
  w.missionStage = save.missionStage || 0;
  w.packageHeld = !!save.packageHeld;
  w.cometStolen = !!save.cometStolen;
  w.bagsCollected = save.bagsCollected || 0;
  if (Array.isArray(save.bagsTaken)) {
    w.bags.forEach((b, i) => {
      b.taken = !!save.bagsTaken[i];
    });
  }
  w.player.x = save.playerX ?? w.player.x;
  w.player.y = save.playerY ?? w.player.y;
  w.wanted = save.wanted || 0;
  if (save.stats) w.stats = { ...w.stats, ...save.stats };
  w.state = 'playing';
  return true;
}
