// SOLMAR HEAT — canvas renderer. Draws the city, the actors, the HUD with
// its minimap, and the title / pause / busted / wasted / victory screens.
// Pure drawing: it reads the world, never mutates it.

import { CONFIG, roadCenter, clamp } from './config.js';
import { currentTarget, carById, PLACES } from './world.js';

const SKY_TOP = '#ff9a5c';
const ASPHALT = '#3a3f4a';
const ROAD_LINE = '#d8c95a';
const SIDEWALK = '#9a938a';
const GRASS = '#5da24a';
const PLAZA = '#b8a98a';
const SAND = '#e8d29a';
const WATER = '#2f7fc2';

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const body = car.color;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-19, -9, 38, 20);
  ctx.fillStyle = body;
  roundRect(ctx, -18, -10, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -6, -8, 12, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(10, -8, 3, 16);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-18, -10, 36, 4);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(-14, -11, 6, 4);
    ctx.fillStyle = '#3d7dd9';
    ctx.fillRect(-6, -11, 6, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (car.kind === 'comet') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GT', 0, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(6, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCity(ctx, world, cam) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  // Water + sand on the east edge.
  ctx.fillStyle = WATER;
  ctx.fillRect(Math.max(vx, CONFIG.WATER_X), vy, vw, vh);
  ctx.fillStyle = SAND;
  ctx.fillRect(Math.max(vx, CONFIG.BEACH_X), vy, Math.min(vw, CONFIG.WATER_X - Math.max(vx, CONFIG.BEACH_X)), vh);
  // Ground under the city.
  ctx.fillStyle = '#7d7468';
  ctx.fillRect(vx, vy, Math.min(vw, CONFIG.BEACH_X - vx), vh);
  // Blocks: parks, plazas, buildings with sidewalks.
  for (const b of world.blocks) {
    const bx = CONFIG.ROAD + b.col * CONFIG.PITCH;
    const by = CONFIG.ROAD + b.row * CONFIG.PITCH;
    if (bx > vx + vw || by > vy + vh || bx + CONFIG.BLOCK < vx || by + CONFIG.BLOCK < vy) continue;
    ctx.fillStyle = SIDEWALK;
    ctx.fillRect(bx, by, CONFIG.BLOCK, CONFIG.BLOCK);
    if (b.type === 'park') {
      ctx.fillStyle = GRASS;
      ctx.fillRect(bx + 6, by + 6, CONFIG.BLOCK - 12, CONFIG.BLOCK - 12);
      ctx.fillStyle = '#3f7d33';
      ctx.beginPath();
      ctx.arc(bx + 32, by + 36, 12, 0, Math.PI * 2);
      ctx.arc(bx + 84, by + 80, 14, 0, Math.PI * 2);
      ctx.arc(bx + 78, by + 28, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'plaza') {
      ctx.fillStyle = PLAZA;
      ctx.fillRect(bx + 6, by + 6, CONFIG.BLOCK - 12, CONFIG.BLOCK - 12);
      ctx.fillStyle = '#2f7fc2';
      ctx.beginPath();
      ctx.arc(bx + 60, by + 60, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.building) {
      const r = b.building;
      ctx.fillStyle = b.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(r.x, r.y, r.w, 6);
      ctx.fillStyle = 'rgba(20,30,50,0.7)';
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 4; wx++) {
          ctx.fillRect(r.x + 10 + wx * 20, r.y + 14 + wy * 26, 10, 12);
        }
      }
    }
  }
  // Roads + centre dashes.
  ctx.fillStyle = ASPHALT;
  for (let i = 0; i <= 9; i++) {
    ctx.fillRect(roadCenter(i) - CONFIG.ROAD / 2, vy, CONFIG.ROAD, vh);
    ctx.fillRect(vx, roadCenter(i) - CONFIG.ROAD / 2, vw, CONFIG.ROAD);
  }
  ctx.fillStyle = ROAD_LINE;
  for (let i = 0; i <= 9; i++) {
    for (let d = 40; d < CONFIG.WORLD_H; d += 64) {
      if (d % CONFIG.PITCH < CONFIG.ROAD) continue;
      ctx.fillRect(roadCenter(i) - 2, d, 4, 26);
      ctx.fillRect(d, roadCenter(i) - 2, 26, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const cx = roadCenter(i);
      const cy = roadCenter(j);
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(cx - 16 + k * 7, cy - 20, 4, 10);
        ctx.fillRect(cx - 16 + k * 7, cy + 10, 4, 10);
      }
    }
  }
}

function drawMarkers(ctx, world, time) {
  const p = world.player;
  // Mission target: pulsing diamond + a beacon column.
  const t = currentTarget(world);
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(255,210,60,0.18)';
  ctx.fillRect(-16, -70, 32, 70);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd23c';
  ctx.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
  ctx.restore();
  // Story places: small labelled discs at the hideout, pawn shop, chop shop.
  const places = [
    { x: PLACES.hideout.x, y: PLACES.hideout.y, letter: 'H', color: '#4fbf6a' },
    { x: PLACES.pawnShop.x, y: PLACES.pawnShop.y, letter: '$', color: '#e0b13c' },
    { x: PLACES.chopShop.x, y: PLACES.chopShop.y, letter: 'C', color: '#8e5fc0' },
  ];
  for (const pl of places) {
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pl.letter, 0, 0);
    ctx.restore();
  }
  // Cash bags.
  for (const bag of world.bags) {
    if (bag.taken) continue;
    ctx.save();
    ctx.translate(bag.x, bag.y);
    ctx.fillStyle = '#2b7d3a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    ctx.restore();
  }
  // Pickups.
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.fillStyle = pk.kind === 'ammo' ? '#3d7dd9' : pk.kind === 'health' ? '#e05a5a' : '#4fbf6a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : '$', 0, 0);
    ctx.restore();
  }
  // Docks: wooden pier on the beach.
  ctx.fillStyle = '#8a6a4e';
  ctx.fillRect(1496, 640, 56, 120);
  ctx.fillStyle = '#6e5238';
  for (let k = 0; k < 6; k++) ctx.fillRect(1496, 644 + k * 20, 56, 3);
  void p;
}

export function drawWorld(ctx, world, cam, time) {
  drawCity(ctx, world, cam);
  drawMarkers(ctx, world, time);
  for (const ped of world.peds) drawPed(ctx, ped);
  const sorted = [...world.cars].sort((a, b) => a.y - b.y);
  for (const car of sorted) drawCar(ctx, car);
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = world.player;
  if (!p.carId) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22252c';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath();
    ctx.arc(7, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JAX', 0, -14);
    ctx.restore();
  }
}

// ---- HUD ----

function drawStars(ctx, stars, x, y) {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < CONFIG.MAX_WANTED; i++) {
    ctx.fillStyle = i < stars ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
}

export function drawHUD(ctx, world, viewW, viewH) {
  const p = world.player;
  // Top-left: health, money, debt, ammo.
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,18,0.62)';
  roundRect(ctx, 12, 12, 300, 96, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 26, 32);
  ctx.fillStyle = '#ff8a7a';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Debt: $${world.debt.toLocaleString('en-US')}`, 26, 54);
  ctx.fillStyle = '#9fe08a';
  ctx.fillText(`Ammo: ${p.ammo}`, 150, 54);
  ctx.fillStyle = '#333';
  roundRect(ctx, 26, 70, 180, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#4fbf6a' : '#d94f3d';
  roundRect(ctx, 26, 70, Math.max(0, 180 * (p.health / CONFIG.PLAYER_MAX_HEALTH)), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 214, 76);
  // Wanted stars, top-right.
  drawStars(ctx, world.wanted.stars, viewW - 170, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  const mission = MISSION_DEFS_LABEL(world);
  ctx.fillText(mission, viewW - 20, 58);
  // Objective line under the stars.
  const t = currentTarget(world);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#ffd23c';
  ctx.fillText(t.label, viewW - 20, 80);
  // Speed, bottom-right.
  if (p.carId) {
    const car = carById(world, p.carId);
    const mph = car ? Math.round(Math.abs(car.speed) * 0.14) : 0;
    ctx.fillStyle = 'rgba(10,12,18,0.62)';
    roundRect(ctx, viewW - 130, viewH - 52, 116, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${mph} mph`, viewW - 72, viewH - 32);
  }
  // Centre message.
  if (world.message && world.time < world.message.until) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(world.message.text).width;
    ctx.fillStyle = 'rgba(10,12,18,0.65)';
    roundRect(ctx, viewW / 2 - w / 2 - 16, 108, w + 32, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(world.message.text, viewW / 2, 126);
  }
  // Minimap, bottom-left.
  drawMinimap(ctx, world, 14, viewH - CONFIG.MINIMAP_SIZE - 14);
  ctx.restore();
}

function MISSION_DEFS_LABEL(world) {
  const names = ['Job 1: The Pickup', 'Job 2: Hot Wheels', 'Job 3: The Big Score', 'Debt paid'];
  return names[Math.min(world.missionIndex, 3)];
}

function drawMinimap(ctx, world, x, y) {
  const s = CONFIG.MINIMAP_SIZE;
  const scale = s / CONFIG.WORLD_W;
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  ctx.fillRect(x - 4, y - 4, s + 8, s + 8);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = WATER;
  ctx.fillRect(x + CONFIG.WATER_X * scale, y, (CONFIG.WORLD_W - CONFIG.WATER_X) * scale, s);
  ctx.fillStyle = SAND;
  ctx.fillRect(x + CONFIG.BEACH_X * scale, y, (CONFIG.WATER_X - CONFIG.BEACH_X) * scale, s);
  ctx.fillStyle = ASPHALT;
  for (let i = 0; i <= 9; i++) {
    ctx.fillRect(x + (roadCenter(i) - 20) * scale, y, 40 * scale, s);
    ctx.fillRect(x, y + (roadCenter(i) - 20) * scale, s, 40 * scale);
  }
  const t = currentTarget(world);
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.arc(x + t.x * scale, y + t.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = '#3d7dd9';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = world.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---- screens ----

function screenBase(ctx, viewW, viewH, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd23c';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(title, viewW / 2, viewH / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, viewW / 2, viewH / 2 - 52 + i * 30);
  });
  ctx.restore();
}

export function drawTitle(ctx, world, viewW, viewH, hasSave) {
  // Sunset skyline backdrop.
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#2b1a4e');
  g.addColorStop(0.55, '#c94f6d');
  g.addColorStop(0.8, '#ff9a5c');
  g.addColorStop(1, '#ffd23c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#1a1430';
  const skyline = [0.42, 0.3, 0.5, 0.36, 0.28, 0.46, 0.34, 0.52, 0.3, 0.44];
  skyline.forEach((h, i) => {
    const bw = viewW / skyline.length;
    ctx.fillRect(i * bw + 6, viewH * (1 - h) - 120, bw - 12, viewH * h + 120);
  });
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.arc(viewW * 0.78, viewH * 0.26, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(8,10,16,0.55)';
  ctx.fillRect(0, viewH - 210, viewW, 210);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR HEAT', viewW / 2, 130);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in Solmar City', viewW / 2, 168);
  ctx.font = '16px sans-serif';
  ctx.fillText('Jax Moreno owes Sal $50,000. Three jobs. Pay it off — or else.', viewW / 2, viewH - 168);
  ctx.fillText('WASD / arrows — move & drive   •   E — steal / exit car', viewW / 2, viewH - 138);
  ctx.fillText('Space — punch   •   Mouse aim + click — shoot   •   P — pause   •   S — save   •   M — mute', viewW / 2, viewH - 112);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(hasSave ? 'Press ENTER to play — or C to continue your save' : 'Press ENTER to play', viewW / 2, viewH - 66);
}

export function drawPause(ctx, viewW, viewH) {
  screenBase(ctx, viewW, viewH, 'PAUSED', ['P — resume', 'S — save game', 'Enter — resume'], '#fff');
}

export function drawEnd(ctx, world, viewW, viewH, kind) {
  const s = world.stats;
  const mins = Math.floor(s.timePlayed / 60);
  const secs = Math.floor(s.timePlayed % 60);
  const lines = [
    kind === 'won'
      ? 'The debt is paid. Solmar City is yours, Jax.'
      : kind === 'busted'
        ? 'The cops hauled you in. Sal is not going to wait.'
        : 'Jax went down in the streets of Solmar.',
    `Money earned: $${world.player.money.toLocaleString('en-US')}   •   Cars stolen: ${s.carsStolen}`,
    `Shots fired: ${s.shotsFired}   •   Hits: ${s.hits}   •   Time: ${mins}:${String(secs).padStart(2, '0')}`,
    'Press ENTER to play again',
  ];
  const title = kind === 'won' ? 'DEBT PAID!' : kind === 'busted' ? 'BUSTED' : 'WASTED';
  const accent = kind === 'won' ? '#4fbf6a' : '#d94f3d';
  screenBase(ctx, viewW, viewH, title, lines, accent);
}
