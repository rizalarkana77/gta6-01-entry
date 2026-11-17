// SOLMAR HEAT — screenshot scenes. One job: freeze the game into the exact
// states `?shot=` asks for, so screenshots show the real game at its best.
import { CFG, SPOTS } from './config.js';
import { createWorld, stepWorld } from './world.js';

// A quiet input object: nothing pressed.
function idleInput() {
  return { up: false, down: false, left: false, right: false, run: false, act: false, punch: false, shoot: false, aimX: 0, aimY: 0 };
}

const hooks = { sfx: () => {} };

// Put the player in a car and drive it for a bit, so the scene has motion.
function driveFor(w, seconds, steer) {
  const input = idleInput();
  input.up = true;
  if (steer === 'left') input.left = true;
  if (steer === 'right') input.right = true;
  for (let i = 0; i < Math.floor(seconds * 60); i++) stepWorld(w, input, 1 / 60, hooks);
}

// Every shot starts from the same seed so the city is identical each time.
export function setupShot(name, seed) {
  const w = createWorld(seed);
  const input = idleInput();
  if (name === 'start') {
    w.frozen = true;
    return { world: w, screen: 'title' };
  }
  if (name === 'play') {
    // Downtown, behind the wheel, mission 1 live on the HUD.
    const car = w.cars.find((c) => c.kind === 'parked');
    w.player.x = car.x - 40;
    w.player.y = car.y;
    input.act = true;
    stepWorld(w, input, 1 / 60, hooks);
    driveFor(w, 1.6, 'right');
    w.frozen = true;
    return { world: w, screen: 'play' };
  }
  if (name === 'chase') {
    // Three stars, two cruisers on the tail, mid-pursuit.
    const car = w.cars.find((c) => c.kind === 'parked');
    w.player.x = car.x - 40;
    w.player.y = car.y;
    input.act = true;
    stepWorld(w, input, 1 / 60, hooks);
    w.wanted = 3;
    w.message = 'The cops are on you!';
    w.messageTimer = 99;
    for (let i = 0; i < 4 * 60; i++) {
      const drive = idleInput();
      drive.up = true;
      drive.right = i % 120 < 60;
      stepWorld(w, drive, 1 / 60, hooks);
    }
    w.frozen = true;
    return { world: w, screen: 'play' };
  }
  if (name === 'mission') {
    // On foot at the third cash bag, two stars, mission 3 in progress.
    w.mission = 3;
    w.bags[0].taken = true;
    w.bags[1].taken = true;
    w.bagsCollected = 2;
    w.wanted = 2;
    w.player.x = SPOTS.cashBags[2].x - 60;
    w.player.y = SPOTS.cashBags[2].y + 30;
    w.player.angle = Math.atan2(SPOTS.cashBags[2].y - w.player.y, SPOTS.cashBags[2].x - w.player.x);
    w.message = 'Cash bag 3/5 — grab it and keep moving.';
    w.messageTimer = 99;
    w.frozen = true;
    return { world: w, screen: 'play' };
  }
  if (name === 'end') {
    // Victory screen after the debt is paid.
    w.debtPaid = CFG.DEBT_TOTAL;
    w.player.money = 2850 + CFG.DEBT_TOTAL;
    w.stats.missionsDone = 3;
    w.stats.carsStolen = 7;
    w.time = 742;
    w.state = 'won';
    w.frozen = true;
    return { world: w, screen: 'end' };
  }
  w.frozen = true;
  return { world: w, screen: 'title' };
}
