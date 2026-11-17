// SOLMAR HEAT — frozen screenshot scenes for ?shot=.
// Each scene puts the world into one exact, deterministic state so the
// screenshots in screenshots/ are reproducible from ?seed= alone.

import { roadCentre, CAR_MAX_SPEED } from './config.js';
import { PLACES } from './world.js';

// A car the player is already driving, placed on a downtown road.
function putPlayerInCar(world, x, y, angle, speed) {
  const car = world.parked[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
}

export function applyShot(world, name) {
  const p = world.player;
  switch (name) {
    case 'start':
      world.state = 'title';
      break;
    case 'play': {
      world.state = 'playing';
      putPlayerInCar(world, roadCentre(4) + 120, roadCentre(4), 0, CAR_MAX_SPEED * 0.6);
      world.mission.index = 0;
      world.mission.stage = 'deliver';
      world.message = 'Package secured — take it to the Pawn Shop';
      world.messageTimer = 999;
      break;
    }
    case 'chase': {
      world.state = 'playing';
      putPlayerInCar(world, roadCentre(5), roadCentre(3) + 60, Math.PI / 2, CAR_MAX_SPEED * 0.7);
      world.wanted = 3;
      world.crimeTimer = 0;
      // Two cruisers already on the player's tail.
      for (let i = 0; i < 2; i++) {
        world.police.push({
          kind: 'police',
          x: p.x - 160 - i * 90,
          y: p.y - 60 + i * 120,
          angle: 0,
          speed: 420,
          hp: 120,
          color: '#2b4fd8',
          dead: false,
        });
      }
      world.message = 'The cops are on you!';
      world.messageTimer = 999;
      break;
    }
    case 'mission': {
      world.state = 'playing';
      world.mission.index = 2;
      world.mission.stage = 'collect';
      world.mission.bags = [
        { x: roadCentre(4) + 40, y: roadCentre(4) + 30, taken: true },
        { x: roadCentre(6), y: roadCentre(2), taken: true },
        { x: roadCentre(4) + 90, y: roadCentre(4) - 10, taken: false },
        { x: roadCentre(7), y: roadCentre(6), taken: false },
        { x: roadCentre(2), y: roadCentre(7), taken: false },
      ];
      world.mission.bagsGot = 2;
      p.x = roadCentre(4) + 40;
      p.y = roadCentre(4) + 90;
      p.angle = -Math.PI / 2;
      p.car = null;
      world.wanted = 2;
      world.crimeTimer = 0;
      world.message = 'Cash bag 3/5';
      world.messageTimer = 999;
      break;
    }
    case 'end': {
      world.state = 'won';
      world.mission.index = 3;
      world.money = 50000;
      world.debt = 0;
      world.debtPaid = 50000;
      world.stats.missionsDone = 3;
      world.stats.carsStolen = 4;
      world.stats.shotsFired = 31;
      world.stats.pedsDown = 3;
      world.time = 742;
      break;
    }
    default:
      world.state = 'title';
      break;
  }
}
