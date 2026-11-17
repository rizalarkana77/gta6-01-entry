// SOLMAR HEAT — rendering. One job: draw the world, the HUD, the minimap and
// every screen, from a world object and a camera. No simulation here.
import { CFG, SPOTS, MISSIONS } from './config.js';
import { roadCenter, blockOrigin, isInWater, currentObjective, currentTarget, debtLeft } from './world.js';

export function makeCamera() {
  return { x: 0, y: 0, w: 1280, h: 720 };
}

export function updateCamera(cam, w, viewW, viewH) {
  cam.w = viewW;
  cam.h = viewH;
  const px = w.player.car ? w.player.car.x : w.player.x;
  const py = w.player.car ? w.player.car.y : w.player.y;
  cam.x = Math.max(0, Math.min(CFG.SIZE - viewW, px - viewW / 2));
  cam.y = Math.max(0, Math.min(CFG.SIZE - viewH, py - viewH / 2));
}

function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CFG.CAR_LENGTH;
  const Wd = CFG.CAR_WIDTH;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -L / 2 + 10, -Wd / 2 + 4, 12, Wd - 8, 3);
  ctx.fill();
  roundRect(ctx, L / 2 - 20, -Wd / 2 + 4, 12, Wd - 8, 3);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 8, 3, 5);
  ctx.fillStyle = '#d94f3d';
  ctx.fillRect(-L / 2, -Wd / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2, Wd / 2 - 8, 3, 5);
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -L / 2 - 2, -Wd / 2 - 2, L + 4, Wd + 4, 8);
    ctx.stroke();
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

function drawWorld(ctx, w, cam) {
  // Ground: warm grass everywhere, then beach and sea to the south.
  ctx.fillStyle = CFG.COLORS.grass;
  ctx.fillRect(0, 0, cam.w, cam.h);
  const sandY = blockOrigin(CFG.GRID - 1);
  const waterY = CFG.SIZE - CFG.ROAD;
  ctx.fillStyle = CFG.COLORS.sand;
  ctx.fillRect(-cam.x, sandY - cam.y, CFG.SIZE, waterY - sandY);
  const grad = ctx.createLinearGradient(0, waterY - cam.y, 0, CFG.SIZE - cam.y);
  grad.addColorStop(0, CFG.COLORS.water);
  grad.addColorStop(1, CFG.COLORS.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(-cam.x, waterY - cam.y, CFG.SIZE, CFG.ROAD);
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wy = waterY + 12 + i * 18 - cam.y;
    ctx.beginPath();
    for (let x = -cam.x; x < CFG.SIZE - cam.x; x += 40) {
      const yy = wy + Math.sin((x + w.time * 40 + i * 90) * 0.02) * 3;
      if (x === -cam.x) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Roads: asphalt bands with centre dashes.
  ctx.fillStyle = CFG.COLORS.road;
  for (let i = 0; i <= CFG.GRID; i++) {
    ctx.fillRect(roadCenter(i) - CFG.ROAD / 2 - cam.x, -cam.y, CFG.ROAD, CFG.SIZE);
    ctx.fillRect(-cam.x, roadCenter(i) - CFG.ROAD / 2 - cam.y, CFG.SIZE, CFG.ROAD);
  }
  ctx.fillStyle = CFG.COLORS.roadLine;
  for (let i = 0; i <= CFG.GRID; i++) {
    const c = roadCenter(i);
    for (let d = 0; d < CFG.SIZE; d += 60) {
      ctx.fillRect(c - 2 - cam.x, d - cam.y, 4, 28);
      ctx.fillRect(d - cam.x, c - 2 - cam.y, 28, 4);
    }
  }

  // Blocks: sidewalk slabs, parks, buildings.
  for (let c = 0; c < CFG.GRID; c++) {
    for (let r = 0; r < CFG.GRID - 1; r++) {
      ctx.fillStyle = CFG.COLORS.sidewalk;
      ctx.fillRect(blockOrigin(c) - cam.x, blockOrigin(r) - cam.y, CFG.BLOCK, CFG.BLOCK);
    }
  }
  for (const park of w.parks) {
    ctx.fillStyle = CFG.COLORS.park;
    ctx.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(park.x + 6 - cam.x, park.y + 6 - cam.y, park.w - 12, park.h - 12);
  }
  for (const b of w.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 4 - cam.x, b.y + 5 - cam.y, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6 - cam.x, b.y + 6 - cam.y, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 14 + i * 34 - cam.x, b.y + 14 + j * 34 - cam.y, 14, 10);
      }
    }
  }
  // Trees and palms.
  for (const t of w.trees) {
    if (t.palm) {
      ctx.strokeStyle = '#8a6a3f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x - cam.x, t.y - cam.y);
      ctx.lineTo(t.x + 4 - cam.x, t.y - 12 - cam.y);
      ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      ctx.beginPath();
      ctx.arc(t.x + 4 - cam.x, t.y - 14 - cam.y, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2f7d3a';
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a75a';
      ctx.beginPath();
      ctx.arc(t.x - 3 - cam.x, t.y - 3 - cam.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mission target marker: pulsing diamond.
  const target = currentTarget(w);
  if (target && w.state === 'playing') {
    const pulse = 1 + Math.sin(w.time * 5) * 0.15;
    ctx.save();
    ctx.translate(target.x - cam.x, target.y - cam.y);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(target.x - cam.x, target.y - cam.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cash bags and ammo boxes.
  for (const bag of w.bags) {
    if (bag.taken) continue;
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.arc(bag.x - cam.x, bag.y - cam.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', bag.x - cam.x, bag.y - cam.y + 1);
  }
  for (const box of w.ammoBoxes) {
    if (box.taken) continue;
    ctx.fillStyle = '#e8c33a';
    ctx.fillRect(box.x - 10 - cam.x, box.y - 8 - cam.y, 20, 16);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMMO', box.x - cam.x, box.y - cam.y);
  }

  // Cars, police, pedestrians, player.
  for (const car of w.cars) {
    if (car.wrecked) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawCar(ctx, { ...car, color: '#555' }, false);
      ctx.restore();
      continue;
    }
    drawCar(ctx, car, w.player.car === car);
  }
  for (const cop of w.police) {
    drawCar(ctx, { ...cop, color: '#1c2733' }, false);
    const on = Math.sin(cop.light) > 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(cop.x - 8 - cam.x, cop.y - 8 - cam.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(cop.x + 8 - cam.x, cop.y - 8 - cam.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ped of w.peds) {
    ctx.save();
    ctx.translate(ped.x - cam.x, ped.y - cam.y);
    if (ped.down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const p = w.player;
  if (!p.car) {
    ctx.save();
    ctx.translate(p.x - cam.x, p.y - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Particles.
  for (const pt of w.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Aim line when on foot with ammo.
  if (!p.car && p.ammo > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 60 - cam.x, p.y + Math.sin(p.angle) * 60 - cam.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  void isInWater;
}

function drawMinimap(ctx, w, x, y, size) {
  const scale = size / CFG.SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 8);
  ctx.stroke();
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = CFG.COLORS.sand;
  ctx.fillRect(x, y + (CFG.SIZE - CFG.ROAD - (CFG.GRID - 1) * CFG.PITCH) * scale, size, size * 0.09);
  ctx.fillStyle = CFG.COLORS.water;
  ctx.fillRect(x, y + size * 0.97, size, size * 0.03);
  ctx.strokeStyle = '#3d4149';
  ctx.lineWidth = 2;
  for (let i = 0; i <= CFG.GRID; i++) {
    const c = roadCenter(i) * scale;
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + c, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + c);
    ctx.lineTo(x + size, y + c);
    ctx.stroke();
  }
  const target = currentTarget(w);
  if (target && w.state === 'playing') {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x + target.x * scale, y + target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff3b30';
  for (const cop of w.police) {
    ctx.beginPath();
    ctx.arc(x + cop.x * scale, y + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = w.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b6cb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, w, viewW, viewH) {
  const p = w.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health, money, debt, ammo.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, 12, 250, 108, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('JAX MORENO', 24, 34);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 42, 180, 12);
  ctx.fillStyle = p.health > 40 ? '#4caf50' : '#e53935';
  ctx.fillRect(24, 42, 180 * (p.health / CFG.PLAYER_HEALTH), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 24, 76);
  ctx.fillStyle = '#ffb3ab';
  ctx.fillText(`Debt left: $${debtLeft(w).toLocaleString('en-US')}`, 24, 96);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(`Ammo: ${p.ammo}  •  Mission ${w.mission}/3: ${MISSIONS[w.mission - 1].name}`, 24, 114);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, viewW - 212, 12, 200, 44, 10);
  ctx.fill();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  let stars = '';
  for (let i = 0; i < CFG.WANTED_MAX; i++) stars += i < w.wanted ? '★' : '☆';
  ctx.fillStyle = w.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.45)';
  ctx.fillText(stars, viewW - 112, 42);
  ctx.textAlign = 'left';

  // Bottom-left: objective + message.
  ctx.font = 'bold 15px sans-serif';
  const obj = currentObjective(w);
  const objW = ctx.measureText(obj).width;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 12, viewH - 76, Math.max(280, objW + 28), 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('◆ ' + obj, 24, viewH - 56);
  if (w.messageTimer > 0 && w.message) {
    ctx.font = '14px sans-serif';
    const mw = ctx.measureText(w.message).width;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 12, viewH - 40, mw + 28, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(w.message, 24, viewH - 21);
  }

  // Bottom-right: minimap + speed.
  drawMinimap(ctx, w, viewW - 196, viewH - 196, 170);
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, viewW - 196, viewH - 40, 182, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${kmh} km/h   •   Car ${Math.max(0, Math.round(p.carHp))}%`, viewW - 186, viewH - 21);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('P pause • S save • M mute', 14, viewH - 84 > 130 ? viewH - 84 : 130);
}

function drawTitle(ctx, w, viewW, viewH, hasSave) {
  ctx.fillStyle = 'rgba(8,10,24,0.82)';
  ctx.fillRect(0, 0, viewW, viewH);
  const cx = viewW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9e3d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR HEAT', cx, viewH * 0.26);
  ctx.fillStyle = '#ffd23e';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime game in Solmar City', cx, viewH * 0.26 + 36);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  const story = [
    'Jax Moreno owes Sal $50,000 — and Sal does not do extensions.',
    'Three jobs stand between Jax and a clean slate:',
    'The Pickup • Hot Wheels • The Big Score.',
    '',
    'WASD / arrows — move & drive      E — steal / exit car',
    'Space — punch      Mouse aim + click — shoot',
    'Shift — run      P — pause      S — save      M — mute',
  ];
  story.forEach((line, i) => ctx.fillText(line, cx, viewH * 0.42 + i * 26));
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(hasSave ? 'Press ENTER to play — or C to continue your save' : 'Press ENTER to play', cx, viewH * 0.42 + story.length * 26 + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px sans-serif';
  ctx.fillText('A wholly original game. No Rockstar names, art or music.', cx, viewH - 28);
  ctx.textAlign = 'left';
}

function drawPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,10,24,0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('P to resume  •  S to save  •  R to restart', viewW / 2, viewH / 2 + 30);
  ctx.textAlign = 'left';
}

function drawEndScreen(ctx, w, viewW, viewH) {
  const won = w.state === 'won';
  const title = won ? 'DEBT PAID!' : w.state === 'busted' ? 'BUSTED!' : 'WASTED!';
  const sub = won
    ? 'Jax paid Sal every cent. Solmar City is his now.'
    : w.state === 'busted'
      ? 'The cops dragged you in. Sal is still waiting — minus $500.'
      : 'Jax is down. The clinic patched him up — minus $1,000.';
  ctx.fillStyle = won ? 'rgba(20,60,30,0.85)' : 'rgba(40,8,10,0.85)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#7CFC98' : '#ff6b5e';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, viewW / 2, viewH * 0.32);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, viewW / 2, viewH * 0.32 + 36);
  const mins = Math.floor(w.time / 60);
  const secs = Math.floor(w.time % 60);
  const lines = [
    `Money: $${w.player.money.toLocaleString('en-US')}`,
    `Debt paid: $${w.debtPaid.toLocaleString('en-US')} / $50,000`,
    `Missions done: ${w.stats.missionsDone} / 3`,
    `Cars stolen: ${w.stats.carsStolen}   •   Time: ${mins}:${String(secs).padStart(2, '0')}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.48 + i * 28));
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(won ? 'Press ENTER to play again' : 'Press ENTER to get back out there', viewW / 2, viewH * 0.48 + lines.length * 28 + 26);
  ctx.textAlign = 'left';
}

// Full frame: world + HUD + whichever screen is active.
export function render(ctx, w, cam, screen, viewW, viewH, hasSave) {
  ctx.clearRect(0, 0, viewW, viewH);
  drawWorld(ctx, w, cam);
  if (screen === 'play') drawHud(ctx, w, viewW, viewH);
  if (screen === 'title') drawTitle(ctx, w, viewW, viewH, hasSave);
  if (screen === 'pause') {
    drawHud(ctx, w, viewW, viewH);
    drawPause(ctx, viewW, viewH);
  }
  if (screen === 'end') drawEndScreen(ctx, w, viewW, viewH);
}
