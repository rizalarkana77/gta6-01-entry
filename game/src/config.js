// SOLMAR HEAT — tuning constants for the whole game.
// One place holds every number that shapes how the city feels, so balancing
// is a matter of editing this file, never hunting through the logic.

export const TILE = 48;

// City layout: a 9x9 grid of blocks separated by roads.
export const GRID = 9;
export const BLOCK = 176; // side of one city block, in pixels
export const ROAD = 64; // width of one road, in pixels
export const PITCH = BLOCK + ROAD; // distance between neighbouring road centres
export const CITY = GRID * PITCH + ROAD; // roads area: 2224 px on a side
export const BEACH_W = 170; // sand strip on the east edge
export const WATER_X = CITY + BEACH_W; // water starts here
export const WORLD_W = WATER_X + 130; // world width incl. water
export const WORLD_H = CITY;

// A road centre line, i = 0..9 (roads run along both edges of the grid).
export const roadCentre = (i) => i * PITCH + ROAD / 2;

// Player on foot.
export const WALK_SPEED = 175;
export const RUN_SPEED = 275;
export const PLAYER_R = 13;
export const PLAYER_MAX_HEALTH = 100;

// Cars.
export const CAR_MAX_SPEED = 560;
export const CAR_MAX_REVERSE = 190;
export const CAR_ACCEL = 540;
export const CAR_BRAKE = 900;
export const CAR_TURN = 2.7; // radians per second at full speed
export const CAR_R = 18;

// Traffic and pedestrians.
export const TRAFFIC_CARS = 14;
export const PED_COUNT = 26;
export const PARKED_CARS = 6;
export const TRAFFIC_SPEED_MIN = 95;
export const TRAFFIC_SPEED_MAX = 150;

// Combat.
export const PUNCH_RANGE = 58;
export const PUNCH_DAMAGE = 30;
export const PUNCH_COOLDOWN = 0.38;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 340;
export const PISTOL_COOLDOWN = 0.22;
export const START_AMMO = 24;
export const AMMO_PICKUP = 12;
export const MEDKIT_HEAL = 25;

// Wanted level.
export const WANTED_MAX = 5;
export const WANTED_DECAY_QUIET = 10; // seconds without crime before decay starts
export const WANTED_DECAY_STEP = 6; // seconds per star lost while laying low
export const POLICE_MAX = 4;
export const POLICE_SPEED = 600;
export const POLICE_HP = 120;
export const POLICE_RAM_DAMAGE = 14;

// Story: Jax Moreno owes Sal $50,000.
export const DEBT_TOTAL = 50000;
export const MISSION_REWARDS = [8000, 14000, 28000];
export const MISSION_NAMES = ['The Pickup', 'Hot Wheels', 'The Big Score'];
export const CASH_BAGS = 5;

// Pickups scattered around the city.
export const AMMO_BOXES = 6;
export const MEDKITS = 4;

// Save slot.
export const SAVE_KEY = 'solmar-heat-save-v1';

// Palette.
export const COLORS = {
  water: '#1d6f8e',
  waterDeep: '#155a75',
  sand: '#e8cf96',
  grass: '#5da24a',
  parkGrass: '#4c8f3e',
  road: '#3a3a40',
  roadEdge: '#2c2c31',
  lane: '#e8d44d',
  sidewalk: '#9a9a92',
  buildingRoof: ['#b0563a', '#7a6a8f', '#4a7a9e', '#9e8a4a', '#8f4a5e', '#5e8f6a'],
  buildingEdge: '#2e2a26',
  dockWood: '#8a6a42',
  player: '#f2c14e',
  playerJacket: '#d94f3d',
  police: '#2b4fd8',
  policeLight: '#ff3b30',
  comet: '#e83e8c',
};
