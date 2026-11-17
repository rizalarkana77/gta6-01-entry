// SOLMAR HEAT — frozen screenshot scenes for `?shot=`.
// Each shot builds a deterministic world from the seed and arranges it so
// one rendered frame tells the story: title, driving, a police chase, a
// mission moment, the victory screen.

import { createWorld, step, carById, PLACES } from './world.js';
import { blankInput } from './input.js';
import { CONFIG } from './config.js';

function driveSteps(world, n, input) {
  const inp = input || { ...blankInput(), up: true };
  for (let i = 0; i < n; i++) step(world, inp, 1 / 60);
}

// Put the player in a car and roll it downtown for a few seconds.
function putPlayerInCar(world, carKind) {
  const car = world.cars.find((c) => c.kind === carKind) || world.cars[0];
  car.speed = 0;
  world.player.carId = car.id;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.angle = car.angle;
  return car;
}

export function buildShot(name, seed) {
  const world = createWorld(seed);
  if (name === 'start') {
    return { world, mode: 'title' };
  }
  if (name === 'play') {
    const car = putPlayerInCar(world, 'parked');
    car.x = 660;
    car.y = 660;
    car.angle = 0;
    world.player.x = 660;
    world.player.y = 660;
    world.player.angle = 0;
    world.message = { text: 'Job 1: The Pickup — head to the docks', until: 9999 };
    driveSteps(world, 100, { ...blankInput(), up: true });
    return { world, mode: 'playing' };
  }
  if (name === 'chase') {
    const car = putPlayerInCar(world, 'parked');
    car.x = 820; // vertical road 5: drive south on the road, not through blocks
    car.y = 500;
    car.angle = Math.PI / 2;
    world.player.x = 820;
    world.player.y = 500;
    world.player.angle = Math.PI / 2;
    world.wanted.stars = 3;
    world.wanted.heat = 100;
    world.wanted.lastCrime = 0;
    world.message = { text: 'The cops are on you!', until: 9999 };
    driveSteps(world, 60, { ...blankInput(), up: true });
    // Two police cars right on the player's tail.
    for (let k = 0; k < 2; k++) {
      const id = Math.max(0, ...world.cars.map((c) => c.id)) + 1;
      world.cars.push({
        id,
        kind: 'police',
        x: 820 - k * 60,
        y: 500 - 90 - k * 40,
        angle: Math.PI / 2,
        speed: 320,
        targetSpeed: 0,
        color: '#20242c',
        axis: 'v',
        road: 0,
        dir: 1,
        lane: 1,
        disabled: false,
        ramCooldown: 0,
      });
    }
    step(world, { ...blankInput(), up: true }, 1 / 60);
    return { world, mode: 'playing' };
  }
  if (name === 'mission') {
    world.missionIndex = 2;
    world.missionStage = 'collect';
    world.player.bagsCollected = 2;
    world.bags[0].taken = true;
    world.bags[1].taken = true;
    const bag = world.bags[2];
    world.player.x = bag.x - 40;
    world.player.y = bag.y + 10;
    world.player.angle = 0;
    world.wanted.stars = 2;
    world.wanted.heat = 100;
    world.wanted.lastCrime = 0;
    step(world, blankInput(), 1 / 60);
    // Set the message after the step: stepping spawns police, which would
    // overwrite it with their own "cops are on you" line.
    world.message = { text: 'Cash bag 3/5', until: 9999 };
    return { world, mode: 'playing' };
  }
  if (name === 'end') {
    world.missionIndex = 3;
    world.missionStage = 'done';
    world.debt = 0;
    world.player.money = CONFIG.DEBT_TOTAL;
    world.won = true;
    world.stats.missionsDone = 3;
    world.stats.timePlayed = 742;
    world.stats.carsStolen = 2;
    world.stats.shotsFired = 18;
    world.stats.hits = 11;
    return { world, mode: 'won' };
  }
  return { world, mode: 'title' };
}

export { carById, PLACES };
