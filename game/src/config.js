// SOLMAR HEAT — tuning constants. One job: every number the game balances on.
export const CFG = {
  // City grid: 9x9 blocks, roads between them.
  GRID: 9,
  BLOCK: 180,
  ROAD: 70,
  PITCH: 250, // BLOCK + ROAD
  get SIZE() { return this.GRID * this.PITCH + this.ROAD; }, // 2320

  // Player on foot
  WALK_SPEED: 175,
  RUN_SPEED: 265,
  PLAYER_RADIUS: 12,

  // Driving
  CAR_LENGTH: 48,
  CAR_WIDTH: 24,
  CAR_ACCEL: 300,
  CAR_MAX_SPEED: 430,
  CAR_REVERSE_MAX: 170,
  CAR_BRAKE: 520,
  CAR_STEER: 2.6,
  CAR_DRAG: 0.55,

  // Traffic and crowd
  TRAFFIC_CARS: 14,
  PARKED_CARS: 6,
  PEDESTRIANS: 26,
  TRAFFIC_SPEED: 120,
  PED_SPEED: 55,

  // Combat
  PUNCH_RANGE: 46,
  PUNCH_DAMAGE: 34,
  PISTOL_RANGE: 430,
  PISTOL_DAMAGE: 55,
  PISTOL_AMMO_START: 36,
  AMMO_PICKUP: 24,

  // Health and wanted
  PLAYER_HEALTH: 100,
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 18,
  POLICE_MAX: 4,
  POLICE_SPEED: 455,
  BUSTED_HOLD_SECONDS: 1.2,

  // Story: Jax Moreno owes Sal $50,000.
  DEBT_TOTAL: 50000,
  MISSION_PAY: [8000, 14000, 28000],
  START_MONEY: 250,

  // Colours — sun-soaked coastal city palette.
  COLORS: {
    grass: '#7fae62',
    park: '#69a24f',
    sidewalk: '#d8cbb2',
    road: '#3d4149',
    roadLine: '#e8d44f',
    sand: '#e8d29a',
    water: '#2f8fb5',
    waterDeep: '#1f6f96',
    buildingRoof: ['#e07856', '#e8a54b', '#5ba8a0', '#c96f8e', '#8a7fc0', '#d96b4f'],
    buildingWall: ['#f2e3c8', '#e8d3ae', '#dfe8e2', '#f0d0c0'],
  },
};

// Mission marker spots. Every one sits on a road, a sidewalk or the sand —
// never inside a building and never in the water — so the player can reach it.
export const SPOTS = {
  docksPackage: { x: 140, y: 2190, label: 'Package at the docks' },
  pawnShop: { x: 660, y: 1785, label: 'Pawn shop' },
  cometGt: { x: 1200, y: 785, label: 'Comet GT' },
  chopShop: { x: 1600, y: 1035, label: 'Chop shop' },
  cashBags: [
    { x: 285, y: 535 },
    { x: 1035, y: 285 },
    { x: 1785, y: 1285 },
    { x: 535, y: 2035 },
    { x: 1535, y: 785 },
  ],
  hideout: { x: 1100, y: 1035, label: 'Hideout' },
  hospital: { x: 410, y: 285, label: 'Clinic' },
};

export const MISSIONS = [
  {
    id: 1,
    name: 'The Pickup',
    pay: 8000,
    briefing: 'Sal wants his package from the docks. Grab it, take it to the pawn shop. No detours.',
    objective: (w) => (w.missionStage === 0 ? 'Pick up the package at the docks' : 'Deliver the package to the pawn shop'),
  },
  {
    id: 2,
    name: 'Hot Wheels',
    pay: 14000,
    briefing: 'A Comet GT is parked downtown. Steal it and bring it to the chop shop. Try not to scratch it.',
    objective: () => 'Steal the Comet GT and deliver it to the chop shop',
  },
  {
    id: 3,
    name: 'The Big Score',
    pay: 28000,
    briefing: 'Five cash bags stashed around Solmar. Collect them all, then get back to the hideout.',
    objective: (w) => `Collect the cash bags (${w.bagsCollected}/5), then return to the hideout`,
  },
];
