// SOLMAR HEAT — canvas rendering: the city, the cars and people in it, the
// HUD, the minimap, and the title / pause / ending screens. Drawing only;
// every decision about what exists lives in world.js.

import {
  GRID, BLOCK, ROAD, PITCH, CITY, BEACH_W, WATER_X, WORLD_W, WORLD_H,
  roadCentre, CAR_R, PLAYER_R, PLAYER_MAX_HEALTH, COLORS,
} from './config.js';
import { PLACES, missionTarget, objectiveText } from './world.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

export function cameraFor(world) {
  const p = world.player;
  const x = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2));
  const y = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2));
  return { x, y };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -19, -11, 42, 26, 7);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -20, -12, 40, 24, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  rr(ctx, -6, -10, 13, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(18, -9, 2, 4);
  ctx.fillRect(18, 5, 2, 4);
  ctx.fillStyle = '#ff5a4a';
  ctx.fillRect(-21, -9, 2, 4);
  ctx.fillRect(-21, 5, 2, 4);
  if (opts.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -12, 5, 24);
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#2b6bff';
    ctx.beginPath();
    ctx.arc(-8, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2b6bff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(-8, 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.comet) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GT', 2, 3);
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.car) return; // the car drawing covers the driver
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.playerJacket;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(5, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when aiming with the mouse held.
  ctx.fillStyle = '#22242a';
  ctx.fillRect(8, -2, 10, 3);
  ctx.restore();
}

function drawCity(ctx, world, cam) {
  // Base: grass everywhere, so gaps between roads read as ground.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(cam.x - 4, cam.y - 4, VIEW_W + 8, VIEW_H + 8);

  // Water and beach on the east edge.
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(WATER_X + 60, cam.y - 4, VIEW_W, VIEW_H + 8);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(WATER_X, cam.y - 4, 60, VIEW_H + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(cam.y / 90) * 90; y < cam.y + VIEW_H; y += 90) {
    ctx.beginPath();
    ctx.moveTo(WATER_X + 8, y);
    ctx.quadraticCurveTo(WATER_X + 26, y + 14, WATER_X + 8, y + 28);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(CITY, cam.y - 4, BEACH_W, VIEW_H + 8);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 40; i++) {
    const sx = CITY + ((i * 67) % BEACH_W);
    const sy = cam.y + ((i * 113) % VIEW_H);
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parks and plazas.
  for (const park of world.parks) {
    ctx.fillStyle = COLORS.parkGrass;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  for (const plaza of world.plazas) {
    ctx.fillStyle = '#b0a894';
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(plaza.x + 6, plaza.y + 6, plaza.w - 12, plaza.h - 12);
  }
  for (const tree of world.trees) {
    ctx.fillStyle = '#3d7a34';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da24a';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads: asphalt bands, centre dashes, crosswalks at intersections.
  ctx.fillStyle = COLORS.road;
  for (let i = 0; i <= GRID; i++) {
    ctx.fillRect(roadCentre(i) - ROAD / 2, 0, ROAD, CITY);
    ctx.fillRect(0, roadCentre(i) - ROAD / 2, CITY, ROAD);
  }
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(roadCentre(i), 0);
    ctx.lineTo(roadCentre(i), CITY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, roadCentre(i));
    ctx.lineTo(CITY, roadCentre(i));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const cx = roadCentre(i);
      const cy = roadCentre(j);
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(cx - 20 + k * 9, cy - ROAD / 2 + 6, 5, 10);
        ctx.fillRect(cx - 20 + k * 9, cy + ROAD / 2 - 16, 5, 10);
        ctx.fillRect(cx - ROAD / 2 + 6, cy - 20 + k * 9, 10, 5);
        ctx.fillRect(cx + ROAD / 2 - 16, cy - 20 + k * 9, 10, 5);
      }
    }
  }

  // Sidewalks: pale border inside every block.
  ctx.strokeStyle = COLORS.sidewalk;
  ctx.lineWidth = 10;
  for (const block of world.blocks) {
    ctx.strokeRect(block.x + 5, block.y + 5, BLOCK - 10, BLOCK - 10);
  }

  // Buildings with windows.
  for (const b of world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = COLORS.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    for (let wx = 0; wx < 3; wx++) {
      for (let wy = 0; wy < 3; wy++) {
        ctx.fillRect(b.x + 10 + wx * 18, b.y + 10 + wy * 18, 9, 11);
      }
    }
  }

  // Docks: wooden piers.
  for (const pier of world.docks) {
    ctx.fillStyle = COLORS.dockWood;
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let x = pier.x + 12; x < pier.x + pier.w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, pier.y);
      ctx.lineTo(x, pier.y + pier.h);
      ctx.stroke();
    }
  }

  // Mission target marker: a pulsing diamond on the ground.
  const target = missionTarget(world);
  const pulse = 1 + Math.sin(world.time * 5) * 0.18;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.scale(pulse, pulse);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.fillStyle = '#ff5a3d';
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.label.toUpperCase(), target.x, target.y - 26);

  // Cash bags, ammo boxes, medkits.
  for (const bag of world.mission.bags) {
    if (bag.taken) continue;
    ctx.fillStyle = '#2fae4e';
    rr(ctx, bag.x - 10, bag.y - 8, 20, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', bag.x, bag.y + 4);
  }
  for (const box of world.ammoBoxes) {
    if (box.taken) continue;
    ctx.fillStyle = '#7a5a2e';
    ctx.fillRect(box.x - 9, box.y - 9, 18, 18);
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', box.x, box.y + 4);
  }
  for (const kit of world.medkits) {
    if (kit.taken) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(kit.x - 9, kit.y - 9, 18, 18);
    ctx.fillStyle = '#d93d3d';
    ctx.fillRect(kit.x - 6, kit.y - 2, 12, 4);
    ctx.fillRect(kit.x - 2, kit.y - 6, 4, 12);
  }

  // Cars and people.
  for (const car of world.parked) drawCar(ctx, car.x, car.y, car.angle, car.color);
  drawCar(ctx, world.comet.x, world.comet.y, world.comet.angle, world.comet.color, { comet: true });
  for (const car of world.traffic) drawCar(ctx, car.x, car.y, car.angle, car.color);
  for (const cop of world.police) drawCar(ctx, cop.x, cop.y, cop.angle, cop.color, { police: true });
  for (const ped of world.peds) drawPed(ctx, ped);
  if (world.player.car) {
    const car = world.player.car;
    drawCar(ctx, car.x, car.y, car.angle, car.color, {
      police: car.kind === 'police',
      comet: car.kind === 'comet',
    });
  }
  drawPlayer(ctx, world);

  // Particles and the gun tracer.
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (world.tracer) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(world.tracer.x1, world.tracer.y1);
    ctx.lineTo(world.tracer.x2, world.tracer.y2);
    ctx.stroke();
  }
}

function drawStars(ctx, wanted, x, y) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 28, y);
  }
}

function drawMinimap(ctx, world) {
  const size = 190;
  const x0 = VIEW_W - size - 14;
  const y0 = 14;
  const scale = size / WORLD_W;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  rr(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0 + WATER_X * scale, y0, size, size);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x0 + CITY * scale, y0, BEACH_W * scale, size);
  ctx.fillStyle = '#5a5a60';
  for (let i = 0; i <= GRID; i++) {
    ctx.fillRect(x0 + (roadCentre(i) - ROAD / 2) * scale, y0, ROAD * scale, size);
    ctx.fillRect(x0, y0 + (roadCentre(i) - ROAD / 2) * scale, size, ROAD * scale);
  }
  const target = missionTarget(world);
  const pulse = 1 + Math.sin(world.time * 5) * 0.4;
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 4 * pulse, 0, Math.PI * 2);
  ctx.fill();
  for (const cop of world.police) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + world.player.x * scale, y0 + world.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, world) {
  const p = world.player;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  rr(ctx, 12, 12, 250, 86, 8);
  ctx.fill();
  // Health bar.
  ctx.fillStyle = '#22242a';
  ctx.fillRect(24, 24, 150, 14);
  ctx.fillStyle = p.health > 50 ? '#3ddc5a' : p.health > 25 ? '#ffb13d' : '#ff3b30';
  ctx.fillRect(24, 24, 150 * Math.max(0, p.health / PLAYER_MAX_HEALTH), 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 180, 36);
  ctx.font = '16px sans-serif';
  ctx.fillText(`$${world.money.toLocaleString('en-US')}`, 24, 62);
  ctx.fillStyle = '#ff8a7a';
  ctx.fillText(`Debt $${world.debt.toLocaleString('en-US')}`, 24, 84);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`AMMO ${world.ammo}`, 24, VIEW_H - 44);
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${kmh} km/h`, 24, VIEW_H - 16);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ON FOOT — E: steal car', 24, VIEW_H - 16);
  }

  // Wanted stars, centred at the top.
  drawStars(ctx, world.wanted, VIEW_W / 2 - 70, 40);
  if (world.wanted > 0) {
    ctx.fillStyle = '#ff8a7a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE COPS ARE ON YOU', VIEW_W / 2, 62);
  }

  // Current objective.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const obj = objectiveText(world);
  ctx.font = '15px sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  rr(ctx, VIEW_W / 2 - ow / 2, 74, ow, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW_W / 2, 93);

  drawMinimap(ctx, world);

  // Centre message.
  if (world.message) {
    ctx.font = 'bold 20px sans-serif';
    const mw = ctx.measureText(world.message).width + 36;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    rr(ctx, VIEW_W / 2 - mw / 2, VIEW_H - 118, mw, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW_W / 2, VIEW_H - 92);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('P pause · S save · M sound · E car · Space punch · Click shoot', VIEW_W - 14, VIEW_H - 12);
}

function drawTitle(ctx, world, hasSave) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#2a1a4e');
  grad.addColorStop(0.55, '#c94f3d');
  grad.addColorStop(1, '#f2a54e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Skyline silhouette.
  ctx.fillStyle = '#1c1230';
  let x = 0;
  const heights = [120, 200, 150, 260, 180, 300, 210, 160, 240, 190, 280, 140];
  for (let i = 0; i < heights.length; i++) {
    const w = VIEW_W / heights.length;
    ctx.fillRect(x, VIEW_H - 190 - heights[i] * 0.55, w - 6, heights[i] * 0.55 + 190);
    x += w;
  }
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(VIEW_W - 220, 130, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(242,193,78,0.25)';
  ctx.beginPath();
  ctx.arc(VIEW_W - 220, 130, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('A top-down open-world crime game — Solmar City', VIEW_W / 2, 232);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('Jax Moreno owes Sal $50,000. Three jobs. One way out. Pay it back — or don\'t come back.', VIEW_W / 2, 300);
  ctx.fillText('1. The Pickup ($8,000)    2. Hot Wheels ($14,000)    3. The Big Score ($28,000)', VIEW_W / 2, 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD move · Shift run · E steal / exit car · Space punch · Mouse aim + click shoot', VIEW_W / 2, 392);
  ctx.fillText('P pause · S save · M mute', VIEW_W / 2, 418);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(hasSave ? 'ENTER — Start   ·   C — Continue saved game' : 'ENTER — Start the story', VIEW_W / 2, 480);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. No Rockstar names, art, music or maps.', VIEW_W / 2, VIEW_H - 30);
}

function drawOverlay(ctx, title, lines, accent = '#ffd23d') {
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 250);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 320 + i * 32));
}

function statsLines(world) {
  const s = world.stats;
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  return [
    `Time ${mins}:${String(secs).padStart(2, '0')}   ·   Money earned $${world.debtPaid.toLocaleString('en-US')}`,
    `Cars stolen ${s.carsStolen}   ·   Shots fired ${s.shotsFired}   ·   People down ${s.pedsDown}   ·   Jobs done ${s.missionsDone}/3`,
    'ENTER — play again   ·   T — back to title',
  ];
}

export function draw(ctx, world, cam, hasSave) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (world.state === 'title') {
    drawTitle(ctx, world, hasSave);
    return;
  }
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, world, cam);
  ctx.restore();
  drawHUD(ctx, world);
  if (world.state === 'paused') {
    drawOverlay(ctx, 'PAUSED', ['Take a breath, Jax. Solmar waits.', 'P — resume   ·   S — save   ·   T — title']);
  } else if (world.state === 'busted') {
    drawOverlay(ctx, 'BUSTED', [...statsLines(world).slice(0, 2), 'Sal is not going to like this.', 'ENTER — try again   ·   T — title'], '#7ab8ff');
  } else if (world.state === 'wasted') {
    drawOverlay(ctx, 'WASTED', [...statsLines(world).slice(0, 2), 'Solmar keeps moving without you.', 'ENTER — try again   ·   T — title'], '#ff5a4a');
  } else if (world.state === 'won') {
    drawOverlay(ctx, 'DEBT PAID', [
      'All three jobs done. Sal is paid. Solmar City is yours, Jax.',
      ...statsLines(world).slice(0, 2),
      'ENTER — play again   ·   T — title',
    ], '#3ddc5a');
  }
}
