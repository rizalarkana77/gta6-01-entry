// SOLMAR HEAT — all drawing: the city, cars, people, police, bullets,
// particles, the HUD (health, money, wanted stars, minimap, objective) and
// every menu screen. Nothing here changes the world; it only paints it.
import { CONFIG } from './config.js';
import { MISSIONS, currentMission, currentStage, missionTarget } from './world.js';

const C = CONFIG;

function drawCar(ctx, x, y, angle, color, isPolice, isTarget, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24 + 3, -11 + 4, 48, 22);
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-24, -11, 48, 22, 6);
  ctx.fill();
  // Cabin.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -9, 18, 18, 4);
  ctx.fill();
  // Windshield + headlights.
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(12, -8, 4, 16);
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(22, -9, 2, 5);
  ctx.fillRect(22, 4, 2, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-24, -9, 2, 5);
  ctx.fillRect(-24, 4, 2, 5);
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -11, 10, 22);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-4, -6, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e6fd8';
    ctx.beginPath();
    ctx.arc(-4, 6, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (isTarget) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -13, 52, 26);
  }
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 26);
  }
}

function drawPed(ctx, x, y, angle, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down > 0) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89a';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  const bob = Math.sin(time * 10) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jax: yellow jacket, dark jeans.
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand when aiming.
  ctx.strokeStyle = '#2a2e38';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();
  ctx.restore();
}

export function renderWorld(ctx, world, cam, viewW, viewH) {
  const city = world.city;
  ctx.clearRect(0, 0, viewW, viewH);
  // Sky-tinted ground: grass everywhere, then city, beach, water.
  ctx.fillStyle = C.palette.grass;
  ctx.fillRect(0, 0, viewW, viewH);
  const ox = -cam.x;
  const oy = -cam.y;
  ctx.save();
  ctx.translate(ox, oy);
  // Beach + water on the east edge.
  ctx.fillStyle = C.palette.sand;
  ctx.fillRect(city.cityW, 0, 190, city.cityH);
  ctx.fillStyle = C.palette.water;
  ctx.fillRect(city.cityW + 190, 0, world.city.w - city.cityW - 190, city.cityH);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 8; i++) {
    const wy = ((world.time * 30 + i * 260) % city.cityH);
    ctx.fillRect(city.cityW + 196, wy, 60, 3);
  }
  // City ground: asphalt-coloured base under roads.
  ctx.fillStyle = '#55504a';
  ctx.fillRect(0, 0, city.cityW, city.cityH);
  // Sidewalks (block areas).
  for (let i = 0; i < C.blocksX; i++) {
    for (let j = 0; j < C.blocksY; j++) {
      const x0 = city.roadsX[i] + C.roadW / 2;
      const y0 = city.roadsY[j] + C.roadW / 2;
      const w = 220;
      const h = 220;
      ctx.fillStyle = C.palette.sidewalk;
      ctx.fillRect(x0, y0, w, h);
      // Park green.
      if (city.parks.has(i + ',' + j)) {
        ctx.fillStyle = '#6fa055';
        ctx.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      }
    }
  }
  // Roads.
  ctx.fillStyle = C.palette.road;
  for (const rx of city.roadsX) ctx.fillRect(rx - C.roadW / 2, 0, C.roadW, city.cityH);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - C.roadW / 2, city.cityW, C.roadW);
  // Road centre dashes.
  ctx.fillStyle = C.palette.roadLine;
  for (const rx of city.roadsX) {
    for (let y = 0; y < city.cityH; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of city.roadsY) {
    for (let x = 0; x < city.cityW; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(rx - C.roadW / 2 + 6, ry - 22 + k * 7, C.roadW - 12, 3);
      }
    }
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = '#5a7a3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fae5a';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Buildings with roof detail + height shadow.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(b.x + 10, b.y + 10, Math.max(8, b.w - 20), 8);
    if (b.hgt >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.2, b.w * 0.4, b.h * 0.5);
    }
  }
  // Named spots.
  const spots = city.spots;
  drawSpot(ctx, spots.hideout.x, spots.hideout.y, '#7fd8ff', 'HIDEOUT');
  drawSpot(ctx, spots.docks.x, spots.docks.y, '#ffd23e', 'DOCKS');
  drawSpot(ctx, spots.pawn.x, spots.pawn.y, '#e8a13e', 'PAWN');
  drawSpot(ctx, spots.chop.x, spots.chop.y, '#c96f4a', 'CHOP');
  // Mission target beacon.
  const target = missionTarget(world);
  if (target && world.missionIndex < MISSIONS.length) {
    const pulse = 1 + Math.sin(world.time * 5) * 0.25;
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Guide arrow from the player toward the target.
    const p = world.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d > 220) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const ax = p.x + Math.cos(a) * 70;
      const ay = p.y + Math.sin(a) * 70;
      ctx.fillStyle = '#ffd23e';
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Pickups.
  for (const pk of world.pickups) {
    if (pk.kind === 'bag') {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.roundRect(pk.x - 12, pk.y - 10, 24, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 5);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#1f9d4d';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#c9a13e';
      ctx.fillRect(pk.x - 8, pk.y - 5, 16, 10);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(pk.x - 10, pk.y - 10, 20, 20);
      ctx.fillStyle = '#d84a4a';
      ctx.fillRect(pk.x - 2, pk.y - 7, 4, 14);
      ctx.fillRect(pk.x - 7, pk.y - 2, 14, 4);
    }
  }
  // Cars (traffic + parked + target + police).
  for (const car of world.cars) {
    const isPolice = car.kind === 'police';
    const isTarget = car === world.targetCar && world.missionIndex === 1 && world.stageIndex === 0;
    const isPlayerCar = world.player.inCar === car;
    if (isPlayerCar) continue; // drawn with the player below
    drawCar(ctx, car.x, car.y, car.angle, car.color, isPolice, isTarget, isTarget ? 'COMET GT' : null);
  }
  // Player's car.
  if (world.player.inCar) {
    const car = world.player.inCar;
    drawCar(ctx, car.x, car.y, car.angle, car.color, false, car === world.targetCar, null);
  }
  // Pedestrians.
  for (const ped of world.peds) drawPed(ctx, ped.x, ped.y, ped.angle, ped.color, ped.down);
  // Bullets.
  ctx.fillStyle = '#ffe27a';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Player on foot.
  if (world.player.onFoot) drawPlayer(ctx, world.player, world.time);
  ctx.restore();
}

function drawSpot(ctx, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 52);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 26, y - 26, 52, 52);
}

// ---- HUD ----

export function renderHUD(ctx, world, viewW, viewH) {
  const p = world.player;
  const pad = 16;
  // Top-left: health, money, debt, ammo.
  ctx.fillStyle = 'rgba(10,14,22,0.72)';
  ctx.beginPath();
  ctx.roundRect(pad, pad, 250, 108, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('JAX MORENO', pad + 12, pad + 22);
  // Health bar.
  ctx.fillStyle = '#3a2020';
  ctx.fillRect(pad + 12, pad + 32, 150, 12);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ef4444';
  ctx.fillRect(pad + 12, pad + 32, Math.max(0, 150 * (p.health / C.playerHealth)), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(Math.ceil(p.health) + ' HP', pad + 170, pad + 43);
  ctx.fillText('$' + p.money.toLocaleString(), pad + 12, pad + 66);
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('DEBT $' + Math.max(0, C.debtTotal - world.debtPaid).toLocaleString(), pad + 12, pad + 86);
  ctx.fillStyle = '#fff';
  ctx.fillText('AMMO ' + p.ammo + (p.inCar ? '   •   IN CAR' : '   •   ON FOOT'), pad + 12, pad + 104);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,22,0.72)';
  ctx.beginPath();
  ctx.roundRect(viewW - pad - 230, pad, 230, 46, 10);
  ctx.fill();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < C.maxWanted; i++) {
    ctx.fillStyle = i < world.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', viewW - pad - 200 + i * 40, pad + 33);
  }
  // Bottom-left: mission objective.
  if (world.missionIndex < MISSIONS.length) {
    const m = currentMission(world);
    const s = currentStage(world);
    ctx.fillStyle = 'rgba(10,14,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(pad, viewH - pad - 64, 430, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.name.toUpperCase() + '  •  $' + m.reward.toLocaleString(), pad + 12, viewH - pad - 42);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    let stageText = s.text;
    if (s.kind === 'collect') stageText = 'Collect the 5 CASH BAGS (' + world.bagsCollected + '/5)';
    ctx.fillText(stageText, pad + 12, viewH - pad - 20);
  } else {
    ctx.fillStyle = 'rgba(10,14,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(pad, viewH - pad - 64, 430, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEBT PAID — Solmar is yours, Jax.', pad + 12, viewH - pad - 28);
  }
  // Centre message.
  if (world.messageTimer > 0 && world.message) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    const w = ctx.measureText(world.message).width + 36;
    ctx.beginPath();
    ctx.roundRect(viewW / 2 - w / 2, 84, w, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(world.message, viewW / 2, 110);
  }
  // Speed (in a car).
  if (p.inCar) {
    ctx.fillStyle = 'rgba(10,14,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(viewW - pad - 120, viewH - pad - 54, 120, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.18) + '', viewW - pad - 60, viewH - pad - 26);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('km/h', viewW - pad - 60, viewH - pad - 12);
  }
  renderMinimap(ctx, world, viewW, viewH);
}

function renderMinimap(ctx, world, viewW, viewH) {
  const size = C.minimapSize;
  const x0 = viewW - 16 - size;
  const y0 = viewH - 16 - size - 64;
  const sx = size / world.city.w;
  const sy = size / world.city.h;
  ctx.fillStyle = 'rgba(10,14,22,0.78)';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#2e3b2e';
  ctx.fillRect(x0, y0, size, size);
  // Water + beach.
  ctx.fillStyle = '#3f8fb5';
  ctx.fillRect(x0 + world.city.cityW * sx, y0, size, size);
  // Roads.
  ctx.fillStyle = '#555a63';
  for (const rx of world.city.roadsX) ctx.fillRect(x0 + (rx - C.roadW / 2) * sx, y0, C.roadW * sx, size);
  for (const ry of world.city.roadsY) ctx.fillRect(x0, y0 + (ry - C.roadW / 2) * sy, size, C.roadW * sy);
  // Target marker.
  const t = missionTarget(world);
  if (t && world.missionIndex < MISSIONS.length) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police (blue dots).
  ctx.fillStyle = '#4a90ff';
  for (const cop of world.police) {
    ctx.beginPath();
    ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player (yellow dot with direction).
  const p = world.player;
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', x0, y0 - 12);
}

// ---- Screens ----

function panel(ctx, viewW, viewH, w, h) {
  const x = (viewW - w) / 2;
  const y = (viewH - h) / 2;
  ctx.fillStyle = 'rgba(8,10,18,0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  ctx.stroke();
  return { x, y, w, h };
}

export function renderTitle(ctx, viewW, viewH, hasSave, best) {
  // Sunset backdrop: gradient + skyline silhouette.
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#2b1e4a');
  g.addColorStop(0.55, '#c65a3e');
  g.addColorStop(1, '#e8a13e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#1a1430';
  for (let i = 0; i < 26; i++) {
    const bx = i * 52;
    const bh = 90 + ((i * 37) % 150);
    ctx.fillRect(bx, viewH - bh - 120, 44, bh + 120);
  }
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(viewW - 220, 150, 62, 0, Math.PI * 2);
  ctx.fill();
  const box = panel(ctx, viewW, viewH, 640, 480);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.fillText('SOLMAR HEAT', viewW / 2, box.y + 84);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in a sun-soaked city.', viewW / 2, box.y + 118);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#c9d4e8';
  const lines = [
    'Jax Moreno owes Sal $50,000. Three jobs will pay it off —',
    'if the Solmar police don\'t catch him first.',
    '',
    'WASD / arrows — walk & drive    •    E — steal / exit a car',
    'Mouse — aim    •    Click — shoot    •    Space — punch',
    'Shift — run    •    P — pause    •    S — save    •    M — mute',
    '',
    'Steal cars, dodge the law, finish all three jobs.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, viewW / 2, box.y + 156 + i * 24));
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(hasSave ? 'ENTER — Continue (save found)    •    N — New game' : 'ENTER or CLICK — Start', viewW / 2, box.y + 420);
  if (best) {
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Best: ' + best, viewW / 2, box.y + 452);
  }
}

export function renderPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  const box = panel(ctx, viewW, viewH, 460, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', viewW / 2, box.y + 70);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'P — resume',
    'S — save game',
    'R — restart from hideout',
    'M — mute / unmute',
    'Q — quit to title',
  ];
  lines.forEach((l, i) => ctx.fillText(l, viewW / 2, box.y + 120 + i * 28));
}

export function renderEnd(ctx, viewW, viewH, kind, world) {
  ctx.fillStyle = kind === 'won' ? 'rgba(20,60,30,0.72)' : 'rgba(60,10,10,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  const box = panel(ctx, viewW, viewH, 560, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'won' ? '#4ade80' : '#ff6b6b';
  ctx.font = 'bold 52px system-ui, sans-serif';
  const title = kind === 'won' ? 'DEBT PAID!' : kind === 'busted' ? 'BUSTED!' : 'WASTED!';
  ctx.fillText(title, viewW / 2, box.y + 80);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  const sub = kind === 'won'
    ? 'Jax paid Sal every cent. Solmar is his now.'
    : kind === 'busted'
      ? 'The Solmar police hauled Jax in. $1,000 bail, back to the hideout.'
      : 'Jax went down. The city keeps moving without him.';
  ctx.fillText(sub, viewW / 2, box.y + 118);
  const p = world.player;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#c9d4e8';
  const rows = [
    'Money earned: $' + p.money.toLocaleString(),
    'Debt paid: $' + world.debtPaid.toLocaleString() + ' / $' + C.debtTotal.toLocaleString(),
    'Cars stolen: ' + world.stats.carsStolen + '   •   Shots fired: ' + world.stats.shotsFired,
    'Time in Solmar: ' + Math.floor(world.time / 60) + 'm ' + Math.floor(world.time % 60) + 's',
  ];
  rows.forEach((r, i) => ctx.fillText(r, viewW / 2, box.y + 168 + i * 26));
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('ENTER — Play again      •      Q — Title', viewW / 2, box.y + 320);
}
