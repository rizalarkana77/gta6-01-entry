// SOLMAR HEAT — game loop and state machine. Title -> playing -> paused /
// busted / wasted / won. Owns the canvas, the camera, the save, and the
// deterministic ?seed= / ?shot= modes the screenshots use.
import { CONFIG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld, updateWorld, respawn, saveGame, loadSave, hasSave, applySave,
  currentMission,
} from './world.js';
import { renderWorld, renderHUD, renderTitle, renderPause, renderEnd } from './render.js';
import { setupShot } from './shots.js';

const C = CONFIG;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot') || '';
const SHOT_MODE = ['start', 'play', 'chase', 'mission', 'end'].includes(shot) ? shot : '';

const input = createInput(canvas);
const audio = createAudio();

let world = createWorld(seed);
let state = 'title'; // title | playing | paused | busted | wasted | won
let cam = { x: 0, y: 0 };
let best = null;
try {
  best = localStorage.getItem('solmar-heat-best');
} catch {
  best = null;
}

if (SHOT_MODE) {
  setupShot(world, SHOT_MODE);
  state = SHOT_MODE === 'start' ? 'title' : SHOT_MODE === 'end' ? 'won' : 'playing';
  if (SHOT_MODE === 'end') state = 'won';
  // Snap the camera to the player at once: a screenshot frame must be
  // composed on the first paint, not after the follow lerp converges.
  cam.x = Math.max(-80, Math.min(world.city.w - C.viewW + 80, world.player.x - C.viewW / 2));
  cam.y = Math.max(-80, Math.min(world.city.h - C.viewH + 80, world.player.y - C.viewH / 2));
}

// Camera follows the player, clamped to the world.
function updateCamera() {
  const p = world.player;
  const tx = p.x - C.viewW / 2;
  const ty = p.y - C.viewH / 2;
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
  cam.x = Math.max(-80, Math.min(world.city.w - C.viewW + 80, cam.x));
  cam.y = Math.max(-80, Math.min(world.city.h - C.viewH + 80, cam.y));
  // Screen shake.
  if (world.shake > 0) {
    cam.x += (Math.random() - 0.5) * world.shake;
    cam.y += (Math.random() - 0.5) * world.shake;
  }
}

function startGame(fromSave) {
  world = createWorld(seed);
  if (fromSave) {
    const save = loadSave();
    if (save) applySave(world, save);
  }
  cam.x = world.player.x - C.viewW / 2;
  cam.y = world.player.y - C.viewH / 2;
  state = 'playing';
  audio.unlock();
}

function endRun(kind) {
  state = kind;
  if (kind === 'won') {
    const summary = 'Debt paid in ' + Math.floor(world.time / 60) + 'm ' + Math.floor(world.time % 60) + 's';
    try {
      localStorage.setItem('solmar-heat-best', summary);
      best = summary;
    } catch {
      // storage unavailable; best score is best-effort only
    }
    audio.cash();
  } else if (kind === 'busted') {
    audio.busted();
  } else {
    audio.fail();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;

  // Mouse world position for aiming.
  input.mouse.worldX = input.mouse.x + cam.x;
  input.mouse.worldY = input.mouse.y + cam.y;

  if (state === 'title') {
    if (SHOT_MODE !== 'start') {
      if (input.wasPressed('Enter', 'NumpadEnter') || input.wasClicked()) {
        audio.unlock();
        startGame(false);
      } else if (input.wasPressed('KeyN')) {
        audio.unlock();
        startGame(false);
      }
      // Continue from save with Enter when a save exists: prefer Continue.
      if (input.wasPressed('Enter', 'NumpadEnter') && hasSave()) {
        // handled above as a fresh start; a save is loaded by pressing C
      }
      if (input.wasPressed('KeyC') && hasSave()) {
        audio.unlock();
        startGame(true);
      }
    }
    renderTitle(ctx, C.viewW, C.viewH, hasSave(), best);
  } else if (state === 'playing') {
    if (SHOT_MODE) {
      // Frozen scene for the screenshot: no simulation, just the frame.
      updateCamera();
      renderWorld(ctx, world, cam, C.viewW, C.viewH);
      renderHUD(ctx, world, C.viewW, C.viewH);
    } else {
      if (input.wasPressed('KeyP', 'Escape')) {
        state = 'paused';
      } else if (input.wasPressed('KeyS')) {
        if (saveGame(world)) {
          world.message = 'Game saved.';
          world.messageTimer = 2;
        }
      } else if (input.wasPressed('KeyM')) {
        audio.toggleMute();
      } else {
        const result = updateWorld(world, input, dt, audio);
        updateCamera();
        if (result === 'busted' || result === 'wasted') {
          world.bustedTimer = 0;
          endRun(result);
        } else if (result === 'won') {
          endRun('won');
        }
      }
      renderWorld(ctx, world, cam, C.viewW, C.viewH);
      renderHUD(ctx, world, C.viewW, C.viewH);
    }
  } else if (state === 'paused') {
    renderWorld(ctx, world, cam, C.viewW, C.viewH);
    renderHUD(ctx, world, C.viewW, C.viewH);
    renderPause(ctx, C.viewW, C.viewH);
    if (input.wasPressed('KeyP', 'Escape')) state = 'playing';
    else if (input.wasPressed('KeyS')) {
      if (saveGame(world)) {
        world.message = 'Game saved.';
        world.messageTimer = 2;
      }
      state = 'playing';
    } else if (input.wasPressed('KeyR')) {
      respawn(world);
      state = 'playing';
    } else if (input.wasPressed('KeyM')) {
      audio.toggleMute();
    } else if (input.wasPressed('KeyQ')) {
      state = 'title';
    }
  } else {
    // busted / wasted / won.
    renderWorld(ctx, world, cam, C.viewW, C.viewH);
    renderHUD(ctx, world, C.viewW, C.viewH);
    renderEnd(ctx, C.viewW, C.viewH, state, world);
    if (input.wasPressed('Enter', 'NumpadEnter')) {
      if (state === 'busted' || state === 'wasted') {
        respawn(world);
        state = 'playing';
      } else {
        startGame(false);
      }
    } else if (input.wasPressed('KeyQ')) {
      state = 'title';
    }
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
