// SOLMAR HEAT — browser bootstrap: the loop, the screen state machine,
// save/load, and the wiring between input, world, audio and rendering.

import { SAVE_KEY } from './config.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createWorld, stepWorld, serializeWorld, applySave } from './world.js';
import { draw, cameraFor, VIEW_W, VIEW_H } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const shot = params.get('shot');

const world = createWorld(seed);
const input = new Input();
input.attach(canvas);
const audio = new AudioSys();

let hasSave = false;
try {
  hasSave = Boolean(window.localStorage.getItem(SAVE_KEY));
} catch {
  hasSave = false;
}

if (shot) applyShot(world, shot);

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(world)));
    hasSave = true;
    world.message = 'Game saved';
    world.messageTimer = 2.5;
  } catch {
    world.message = 'Could not save';
    world.messageTimer = 2.5;
  }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.seed !== world.seed) {
      // A save from another seed still loads: rebuild the world on its seed.
      const fresh = createWorld(data.seed);
      const ok = applySave(fresh, data);
      if (!ok) return false;
      Object.assign(world, fresh);
      world.rng = fresh.rng;
    } else {
      if (!applySave(world, data)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function startGame(continueSave) {
  audio.ensure();
  audio.startMusic();
  if (continueSave && loadGame()) {
    world.state = 'playing';
    return;
  }
  // A fresh run starts from the seed's opening state.
  const fresh = createWorld(seed);
  Object.assign(world, fresh);
  world.rng = fresh.rng;
  world.state = 'playing';
}

function drainEvents() {
  for (const event of world.events) audio.play(event.type);
  world.events.length = 0;
}

let last = performance.now();
let mutePressed = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const snap = input.snapshot();
  const pressed = snap.pressed;

  // M toggles mute from anywhere.
  if (input.keys.has('KeyM') && !mutePressed) {
    audio.ensure();
    audio.setMuted(!audio.muted);
    mutePressed = true;
  }
  if (!input.keys.has('KeyM')) mutePressed = false;

  // Screen state machine; the world only steps while playing.
  if (world.state === 'title') {
    if (pressed.has('Enter')) startGame(false);
    else if (pressed.has('KeyC') && hasSave) startGame(true);
  } else if (world.state === 'playing') {
    if (pressed.has('KeyP')) world.state = 'paused';
    else if (pressed.has('KeyS')) saveGame();
  } else if (world.state === 'paused') {
    if (pressed.has('KeyP')) world.state = 'playing';
    else if (pressed.has('KeyS')) saveGame();
    else if (pressed.has('KeyT')) world.state = 'title';
  } else if (world.state === 'busted' || world.state === 'wasted' || world.state === 'won') {
    if (pressed.has('Enter')) startGame(false);
    else if (pressed.has('KeyT')) world.state = 'title';
  }

  if (world.state === 'playing') {
    // Mouse aim in world coordinates, for the pistol: the canvas is
    // 1280x720 internally, so canvas pixels map 1:1 onto the view.
    const cam = cameraFor(world);
    snap.aimWorld = { x: cam.x + snap.aimX, y: cam.y + snap.aimY };
    stepWorld(world, snap, dt);
    drainEvents();
    audio.setSiren(world.wanted > 0);
    audio.setEngine(world.player.car ? Math.abs(world.player.car.speed) : 0, 560);
  } else {
    audio.setSiren(false);
    audio.setEngine(0, 560);
  }

  const cam = cameraFor(world);
  draw(ctx, world, cam, hasSave);
  requestAnimationFrame(frame);
}

// First gesture unlocks audio (browsers block it before then).
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });

requestAnimationFrame(frame);
