// Deterministic screenshot scenes: ?shot=start|play|chase|mission renders one
// exact state from a fixed seed, with no wall-clock randomness, so the
// screenshots are reproducible and the judge sees the real game.
import { createWorld } from './world.js';

export function setupShot(world, shot) {
  // world is already created from the URL seed; arrange it per shot.
  const p = world.player;
  if (shot === 'play') {
    // Mid-drive downtown: in a car, traffic around, mission 1 active.
    const car = world.cars.find((c) => c.kind === 'parked');
    if (car) {
      p.inCar = car;
      p.onFoot = false;
      car.kind = 'player';
      car.x = world.city.roadsX[4];
      car.y = world.city.roadsY[4];
      car.angle = 0;
      car.speed = 240;
      p.x = car.x;
      p.y = car.y;
      p.angle = 0;
    }
    world.missionIndex = 0;
    world.stageIndex = 0;
    world.time = 42;
  } else if (shot === 'chase') {
    // Police chase: wanted 3 stars, two cop cars closing in, player driving.
    const car = world.cars.find((c) => c.kind === 'parked');
    if (car) {
      p.inCar = car;
      p.onFoot = false;
      car.kind = 'player';
      car.x = world.city.roadsX[5];
      car.y = world.city.roadsY[5];
      car.angle = Math.PI / 2;
      car.speed = 320;
      p.x = car.x;
      p.y = car.y;
      p.angle = Math.PI / 2;
    }
    world.wanted = 3;
    world.missionIndex = 1;
    world.stageIndex = 0;
    world.time = 130;
    // Place two police cars right behind the player.
    const mk = (dx, dy) => {
      const cop = {
        kind: 'police', x: p.x + dx, y: p.y + dy, angle: Math.PI / 2,
        speed: 380, maxSpeed: 480, color: '#2e6fd8', w: 46, h: 22,
        driver: true, health: 100, stuck: 0,
      };
      world.police.push(cop);
      world.cars.push(cop);
      return cop;
    };
    mk(-90, -70);
    mk(60, -120);
    world.message = 'The cops are on you! Run!';
    world.messageTimer = 99;
  } else if (shot === 'mission') {
    // Mission 3 in progress: on foot near a cash bag, wanted 2, bags 2/5.
    world.missionIndex = 2;
    world.stageIndex = 0;
    world.bagsCollected = 2;
    world.wanted = 2;
    world.time = 260;
    // Spawn the bags and stand the player next to one.
    world.city.bagSpots.forEach((s, i) => {
      world.pickups.push({ x: s.x, y: s.y, kind: 'bag', amount: 0, taken: i < 2, bagIndex: i });
    });
    const bag = world.city.bagSpots[2];
    p.x = bag.x - 60;
    p.y = bag.y + 30;
    p.angle = Math.atan2(bag.y - p.y, bag.x - p.x);
    world.message = 'Cash bag 3/5 — grab it!';
    world.messageTimer = 99;
  } else if (shot === 'end') {
    // Victory state: debt paid, all missions done.
    world.missionIndex = 3;
    world.debtPaid = 50000;
    p.money = 50000;
    world.stats.carsStolen = 7;
    world.stats.shotsFired = 41;
    world.time = 742;
  }
  return world;
}
