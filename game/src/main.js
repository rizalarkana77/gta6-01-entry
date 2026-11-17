// SOLMAR HEAT — entry point. One job: own the game loop, the screen state
// machine, save/load, and the wiring between input, world, audio and render.
import { createWorld, stepWorld, serializeWorld, applySave, respawnPlayer } from './world.js';
import { createInput, attachInput, clearEdges } from './input.js';
import { createAudio } from './audio.js';
import { makeCamera, updateCamera, render } from './render.js';
import { setupShot } from './shots.js';

const SAVE_KEY = 'solmar-heat-save-v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');

const input = createInput();
attachInput(input, canvas);
const audio = createAudio();
const cam = makeCamera();

let world = createWorld(seed);
let screen = 'title'; // title | play | pause | end
let hasSave = false;
let last = performance.now();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
hasSave = !!loadSave();

function startGame(fromSave) {
  world = createWorld(seed);
  if (fromSave) {
    const save = loadSave();
    if (save) applySave(world, save);
  }
  screen = 'play';
  audio.startMusic();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Screenshot mode: freeze one scene and render it forever.
if (shot) {
  const scene = setupShot(shot, seed);
  world = scene.world;
  screen = scene.screen;
  hasSave = false;
  updateCamera(cam, world, window.innerWidth, window.innerHeight);
  render(ctx, world, cam, screen, window.innerWidth, window.innerHeight, hasSave);
  // Keep repainting (cheap, static) so a screenshot at any moment is right.
  setInterval(() => {
    render(ctx, world, cam, screen, window.innerWidth, window.innerHeight, hasSave);
  }, 500);
} else {
  requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (input.mute) audio.toggleMute();
  if (input.save && screen === 'play') {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(world)));
      world.message = 'Game saved.';
      world.messageTimer = 2;
      hasSave = true;
    } catch {
      world.message = 'Save failed — storage unavailable.';
      world.messageTimer = 2;
    }
  }

  if (screen === 'title') {
    if (input.anyKey) {
      const save = loadSave();
      const key = lastKey;
      if ((key === 'KeyC' || key === 'Enter') && save) startGame(true);
      else if (key === 'Enter') startGame(false);
    }
    if (input.act || input.shoot) startGame(false);
  } else if (screen === 'play') {
    if (input.pause) {
      screen = 'pause';
      audio.play('click');
    } else {
      // Mouse aim in world coordinates.
      const aimX = cam.x + input.mouseX;
      const aimY = cam.y + input.mouseY;
      stepWorld(world, { ...input, aimX, aimY }, dt, audio);
      if (world.state === 'busted' || world.state === 'wasted' || world.state === 'won') {
        screen = 'end';
      }
    }
  } else if (screen === 'pause') {
    if (input.pause) screen = 'play';
    if (input.save) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(world)));
        hasSave = true;
      } catch {}
    }
    if (lastKey === 'KeyR') startGame(false);
  } else if (screen === 'end') {
    if (world.stateTimer > 1 && input.anyKey) {
      if (world.state === 'won') startGame(false);
      else {
        respawnPlayer(world);
        screen = 'play';
      }
    }
  }

  updateCamera(cam, world, window.innerWidth, window.innerHeight);
  render(ctx, world, cam, screen, window.innerWidth, window.innerHeight, hasSave);
  clearEdges(input);
  requestAnimationFrame(frame);
}

// Track the last key pressed, for title/pause shortcuts.
let lastKey = '';
window.addEventListener('keydown', (e) => {
  lastKey = e.code;
});
