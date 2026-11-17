// SOLMAR HEAT — shell: canvas, game loop, state machine, save/load.
// The world (world.js) holds the rules; this file only wires input, audio,
// rendering and the browser together. `?seed=` replays a city, `?shot=`
// renders one frozen scene for screenshots.

import { CONFIG, clamp } from './config.js';
import { createWorld, step, saveGame, loadGame } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawEnd } from './render.js';
import { buildShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { w, h };
}
let view = fitCanvas();
window.addEventListener('resize', () => {
  view = fitCanvas();
});

const input = createInput(canvas);
const audio = createAudio();

let world = createWorld(seed);
let mode = 'title'; // title | playing | paused | busted | wasted | won
let hasSave = false;
try {
  hasSave = !!window.localStorage.getItem(CONFIG.SAVE_KEY);
} catch {
  hasSave = false;
}

// Camera follows the player, clamped to the world.
function cameraFor(worldState) {
  const p = worldState.player;
  const w = view.w;
  const h = view.h;
  return {
    x: clamp(p.x - w / 2, 0, Math.max(0, CONFIG.WORLD_W - w)),
    y: clamp(p.y - h / 2, 0, Math.max(0, CONFIG.WORLD_H - h)),
    w,
    h,
  };
}

function renderFrame() {
  ctx.clearRect(0, 0, view.w, view.h);
  if (mode === 'title') {
    drawTitle(ctx, world, view.w, view.h, hasSave);
    return;
  }
  const cam = cameraFor(world);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, world, cam, world.time);
  ctx.restore();
  drawHUD(ctx, world, view.w, view.h);
  if (mode === 'paused') drawPause(ctx, view.w, view.h);
  if (mode === 'busted') drawEnd(ctx, world, view.w, view.h, 'busted');
  if (mode === 'wasted') drawEnd(ctx, world, view.w, view.h, 'wasted');
  if (mode === 'won') drawEnd(ctx, world, view.w, view.h, 'won');
}

function doSave() {
  try {
    window.localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveGame(world)));
    hasSave = true;
    return true;
  } catch {
    return false;
  }
}

function doLoad() {
  try {
    const raw = window.localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return false;
    const loaded = loadGame(JSON.parse(raw));
    if (!loaded) return false;
    world = loaded;
    return true;
  } catch {
    return false;
  }
}

function startPlaying(fresh) {
  if (fresh) world = createWorld(seed);
  mode = 'playing';
  audio.unlock();
  audio.startMusic();
}

// Shot mode: render exactly one frozen frame, no loop, no audio.
if (shot) {
  const built = buildShot(shot, seed);
  world = built.world;
  mode = built.mode;
  renderFrame();
} else {
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const inp = input.snapshot();
    if (inp.mute) audio.setMuted(!audio.isMuted());

    if (mode === 'playing') {
      if (inp.pause) {
        mode = 'paused';
      } else {
        const cam = cameraFor(world);
        const events = step(
          world,
          { ...inp, aimX: cam.x + inp.mouseX, aimY: cam.y + inp.mouseY },
          dt,
        );
        for (const e of events) {
          if (e.type === 'shoot') audio.sfx.shoot();
          else if (e.type === 'punch' || e.type === 'hit') audio.sfx.punch();
          else if (e.type === 'pickup') audio.sfx.pickup();
          else if (e.type === 'cash' || e.type === 'mission') audio.sfx.cash();
          else if (e.type === 'crash') audio.sfx.crash();
          else if (e.type === 'door' || e.type === 'jack') audio.sfx.door();
          else if (e.type === 'busted') audio.sfx.busted();
          else if (e.type === 'wasted') audio.sfx.wasted();
          else if (e.type === 'win') audio.sfx.win();
        }
        audio.setEngine(world.player.carId ? Math.abs(world.player.speed || 0) / CONFIG.CAR_MAX_SPEED : 0);
        audio.setSiren(world.wanted.stars > 0);
        if (world.won) mode = 'won';
        else if (world.busted) mode = 'busted';
        else if (world.wasted) mode = 'wasted';
      }
    } else if (mode === 'paused') {
      if (inp.pause) mode = 'playing';
    }
    // title / busted / wasted / won advance through the keydown handler below.
    input.endFrame();
    renderFrame();
  }
  requestAnimationFrame(frame);
}

// Keys the input map does not own: Enter starts / restarts, S saves, C continues.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && mode === 'title') startPlaying(true);
  if (e.code === 'Enter' && (mode === 'busted' || mode === 'wasted' || mode === 'won')) startPlaying(true);
  if (e.code === 'KeyS' && (mode === 'playing' || mode === 'paused')) {
    if (doSave()) world.message = { text: 'Game saved.', until: world.time + 2 };
  }
  if (e.code === 'KeyC' && mode === 'title' && hasSave) {
    if (doLoad()) startPlaying(false);
  }
});
canvas.addEventListener('mousedown', () => {
  if (mode === 'title') startPlaying(true);
});
