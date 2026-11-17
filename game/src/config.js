// SOLMAR HEAT — tuning constants. One place for every number the game
// balances on, so a tweak never means hunting through the world code.
export const CONFIG = {
  // World: a sun-soaked coastal city on a grid.
  tile: 64, // px per city block unit
  blocksX: 9,
  blocksY: 9,
  roadW: 96, // road width in px
  // Player on foot.
  walkSpeed: 210,
  runSpeed: 300,
  playerRadius: 13,
  playerHealth: 100,
  // Cars.
  carAccel: 520,
  carMaxSpeed: 460,
  carReverseMax: 160,
  carTurn: 2.9,
  carBrake: 700,
  carDrag: 0.55,
  // Traffic and pedestrians.
  trafficCars: 14,
  pedestrians: 26,
  pedSpeed: 55,
  // Wanted / police.
  maxWanted: 5,
  wantedDecayTime: 14, // seconds with no crime and no police sight before a star drops
  policeCarsBase: 2,
  policeSpeed: 480,
  policeRamDamage: 8,
  // Combat.
  punchDamage: 12,
  punchRange: 46,
  punchCooldown: 0.35,
  gunDamage: 34,
  gunRange: 420,
  gunCooldown: 0.28,
  gunAmmoStart: 24,
  ammoPickup: 12,
  // Missions / story: Jax owes Sal $50,000.
  debtTotal: 50000,
  missionRewards: [8000, 14000, 28000],
  // Camera / view.
  viewW: 1280,
  viewH: 720,
  minimapSize: 168,
  // Colours: sun-soaked Solmar palette.
  palette: {
    grass: '#7fae5a',
    sand: '#e8d39a',
    road: '#3a3f4a',
    roadLine: '#e8c85a',
    sidewalk: '#9a938a',
    buildingRoof: ['#c96f4a', '#4a7fa5', '#a54a6b', '#5a8a6b', '#b08a3e', '#6b5aa5'],
    water: '#3f8fb5',
    player: '#ffd23e',
    police: '#2e6fd8',
  },
};
