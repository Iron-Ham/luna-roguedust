import type { AsteroidId, BossId, BoonId, ElementId, EnemyId, HeatId, MetaId, NodeKind, ShipId, WeaponId } from './types';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  element: ElementId;
  color: string;
  cadence: number;
  damage: number;
  speed: number;
  range: number;
  spread: number[];
  description: string;
}

export interface ElementDefinition {
  id: ElementId;
  name: string;
  color: string;
  short: string;
}

export interface AsteroidDefinition {
  id: AsteroidId;
  name: string;
  color: string;
  radius: number;
  hull: number;
  weakTo: ElementId[];
  reward: number;
}
export interface ShipDefinition {
  id: ShipId;
  name: string;
  tagline: string;
  maxHull: number;
  speed: number;
  fireRate: number;
  projectileDamage: number;
  abilityCooldown: number;
  abilityName: string;
  abilityDescription: string;
  color: string;
  cost: number;
  prerequisite: string;
}

export interface BoonDefinition {
  id: BoonId;
  name: string;
  short: string;
  description: string;
  color: string;
  discovery: string;
}

export interface MetaDefinition {
  id: MetaId;
  name: string;
  description: string;
  costs: number[];
  valueAtLevel: (level: number) => string;
  nextValue: (level: number) => string;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  color: string;
  shape: 'diamond' | 'orb' | 'triangle' | 'mine' | 'hex' | 'split' | 'wedge' | 'harvest' | 'rift' | 'shield';
  radius: number;
  hull: number;
  speed: number;
  damage: number;
  reward: number;
  weakTo: ElementId[];
  description: string;
}

export interface BossDefinition {
  id: BossId;
  name: string;
  sector: number;
  reward: number;
  maxHull: number;
  phases: string[];
  telegraph: string;
}

export interface SectorDefinition {
  number: number;
  id: string;
  name: string;
  boss: BossId;
  roster: EnemyId[];
  unlock: string;
  baseThreat: number;
}

export interface RouteDefinition {
  kind: NodeKind;
  name: string;
  risk: string;
  reward: string;
  description: string;
  color: string;
}

export const ELEMENTS: readonly ElementDefinition[] = [
  { id: 'kinetic', name: 'KINETIC', color: '#f2e9ff', short: 'RAW IMPACT' },
  { id: 'plasma', name: 'PLASMA', color: '#ff8a5c', short: 'THERMAL BURN' },
  { id: 'cryo', name: 'CRYO', color: '#70e7ff', short: 'FREEZE VECTOR' },
  { id: 'void', name: 'VOID', color: '#bd9aff', short: 'NULL PRESSURE' },
];

export const WEAPONS: readonly WeaponDefinition[] = [
  { id: 'pulse', name: 'PULSE CANNON', element: 'kinetic', color: '#f2e9ff', cadence: 0.13, damage: 14, speed: 1.1, range: 2.7, spread: [0], description: 'Reliable surface-skimming rounds.' },
  { id: 'scatter', name: 'PLASMA SCATTER', element: 'plasma', color: '#ff8a5c', cadence: 0.34, damage: 9, speed: 0.92, range: 1.9, spread: [-0.2, -0.1, 0, 0.1, 0.2], description: 'Five hot shells that punish clustered targets.' },
  { id: 'rail', name: 'CRYO RAIL', element: 'cryo', color: '#70e7ff', cadence: 0.52, damage: 48, speed: 1.55, range: 3.5, spread: [0], description: 'A long-range piercing lance with a freeze edge.' },
  { id: 'nova', name: 'VOID NOVA', element: 'void', color: '#bd9aff', cadence: 0.72, damage: 82, speed: 0.78, range: 2.2, spread: [0], description: 'Slow singularity rounds that detonate on the globe.' },
];

export const ASTEROIDS: readonly AsteroidDefinition[] = [
  { id: 'ferrite', name: 'FERRITE', color: '#ff9b4a', radius: 24, hull: 60, weakTo: ['kinetic'], reward: 40 },
  { id: 'ice', name: 'ICEWORLD', color: '#70e7ff', radius: 28, hull: 76, weakTo: ['plasma'], reward: 55 },
  { id: 'crystal', name: 'CRYSTAL', color: '#f0d36a', radius: 20, hull: 52, weakTo: ['cryo'], reward: 70 },
  { id: 'voidstone', name: 'VOIDSTONE', color: '#bd9aff', radius: 30, hull: 98, weakTo: ['void'], reward: 90 },
];
export const SHIPS: readonly ShipDefinition[] = [
  {
    id: 'vanguard',
    name: 'VANGUARD',
    tagline: 'Balanced pulse cannon / reliable repulsor',
    maxHull: 100,
    speed: 1,
    fireRate: 0.13,
    projectileDamage: 12,
    abilityCooldown: 6,
    abilityName: 'REPULSOR',
    abilityDescription: 'Burst nearby threats away and deal heavy radial damage.',
    color: '#d5ff4b',
    cost: 0,
    prerequisite: 'AVAILABLE FROM START',
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    tagline: 'Wide arc cannon / frontal shield',
    maxHull: 150,
    speed: 0.78,
    fireRate: 0.2,
    projectileDamage: 16,
    abilityCooldown: 7,
    abilityName: 'AEGIS',
    abilityDescription: 'Project a 2.5 second frontal shield that blocks hostile shots.',
    color: '#ff9b4a',
    cost: 700,
    prerequisite: '700 DUST + GRINDER DEFEATED',
  },
  {
    id: 'needle',
    name: 'NEEDLE',
    tagline: 'Twin shard fan / afterburner burst',
    maxHull: 72,
    speed: 1.32,
    fireRate: 0.18,
    projectileDamage: 8,
    abilityCooldown: 6,
    abilityName: 'AFTERBURN',
    abilityDescription: 'Boost speed and damage for 1.2 seconds.',
    color: '#70e7ff',
    cost: 900,
    prerequisite: '900 DUST + 100 TOTAL KILLS',
  },
  {
    id: 'mirage',
    name: 'MIRAGE',
    tagline: 'Precision beam / decoy phase',
    maxHull: 88,
    speed: 1.1,
    fireRate: 0.22,
    projectileDamage: 25,
    abilityCooldown: 6,
    abilityName: 'DECOY',
    abilityDescription: 'Spawn a decoy for 2.5 seconds and gain 0.45 seconds phase safety.',
    color: '#e8c7ff',
    cost: 1400,
    prerequisite: '1,400 DUST + RAIL WARDEN DEFEATED',
  },
  {
    id: 'nova',
    name: 'NOVA',
    tagline: 'Charge singularity / gravity well',
    maxHull: 110,
    speed: 0.92,
    fireRate: 0.3,
    projectileDamage: 36,
    abilityCooldown: 9,
    abilityName: 'GRAVITY WELL',
    abilityDescription: 'Create a 1.8 second gravity well that drags and damages threats.',
    color: '#f58dca',
    cost: 2500,
    prerequisite: '2,500 DUST + NULL CROWN DEFEATED',
  },
];

export const BOONS: readonly BoonDefinition[] = [
  {
    id: 'overclock',
    name: 'OVERCLOCK',
    short: 'CADENCE ++ / IMPACT --',
    description: '+18% fire cadence, -10% projectile damage.',
    color: '#d5ff4b',
    discovery: 'AVAILABLE FROM START',
  },
  {
    id: 'echo-chamber',
    name: 'ECHO CHAMBER',
    short: 'REPEATED FIRE',
    description: '20% chance for each fired projectile to repeat after 0.08 seconds.',
    color: '#f0d36a',
    discovery: 'CLEAN CIRCUIT FEAT',
  },
  {
    id: 'magnetar',
    name: 'MAGNETAR',
    short: 'PULL + PAYOUT',
    description: 'Pull pickups from 160 px and increase Dust payouts by 15%.',
    color: '#70e7ff',
    discovery: 'AVAILABLE FROM START',
  },
  {
    id: 'afterimage',
    name: 'AFTERIMAGE',
    short: 'DASH TRAIL',
    description: 'Dash leaves a 0.7 second damage trail.',
    color: '#ff6f86',
    discovery: 'BLOOM MOTHER DEFEATED',
  },
  {
    id: 'prism-rounds',
    name: 'PRISM ROUNDS',
    short: 'HIT SPLIT',
    description: 'Projectile hits split into two weaker angled shards.',
    color: '#cbb3ff',
    discovery: 'GRINDER DEFEATED',
  },
  {
    id: 'drone-pact',
    name: 'DRONE PACT',
    short: 'ORBITAL FIRE',
    description: 'One orbiting drone fires a shot every 1.3 seconds.',
    color: '#b2ff9b',
    discovery: 'RAIL WARDEN DEFEATED',
  },
  {
    id: 'rift-step',
    name: 'RIFT STEP',
    short: 'LONGER BLINK',
    description: 'Dash travels 35% farther and blinks through enemies; cooldown +12%.',
    color: '#ff9b4a',
    discovery: 'GRINDER DEFEATED',
  },
  {
    id: 'null-shell',
    name: 'NULL SHELL',
    short: 'ABILITY FEEDBACK',
    description: 'Ability kills restore 0.5s dash cooldown; ability damage -12%.',
    color: '#e8c7ff',
    discovery: 'NO-BURN VICTORY OR BLOOM MOTHER',
  },
];

export const META: readonly MetaDefinition[] = [
  {
    id: 'hull-matrix',
    name: 'HULL MATRIX',
    description: 'Increase maximum hull.',
    costs: [75, 175, 350],
    valueAtLevel: (level) => `${100 + level * 10} HULL`,
    nextValue: (level) => `${100 + (level + 1) * 10} HULL`,
  },
  {
    id: 'vector-coils',
    name: 'VECTOR COILS',
    description: 'Increase movement speed.',
    costs: [100, 225, 500],
    valueAtLevel: (level) => `${Math.round((1 + level * 0.06) * 100)}% SPEED`,
    nextValue: (level) => `${Math.round((1 + (level + 1) * 0.06) * 100)}% SPEED`,
  },
  {
    id: 'capacitor-bank',
    name: 'CAPACITOR BANK',
    description: 'Increase primary fire cadence.',
    costs: [125, 300, 650],
    valueAtLevel: (level) => `${Math.round(level * 8)}% FIRE CADENCE`,
    nextValue: (level) => `${Math.round((level + 1) * 8)}% FIRE CADENCE`,
  },
  {
    id: 'salvage-lens',
    name: 'SALVAGE LENS',
    description: 'Increase run-end Dust payout.',
    costs: [150, 400],
    valueAtLevel: (level) => `${Math.round(level * 12)}% PAYOUT`,
    nextValue: (level) => `${Math.round((level + 1) * 12)}% PAYOUT`,
  },
  {
    id: 'phase-lattice',
    name: 'PHASE LATTICE',
    description: 'Reduce dash cooldown and extend phase safety.',
    costs: [200, 550],
    valueAtLevel: (level) => `${Math.round(level * 8)}% DASH / +${(level * 0.05).toFixed(2)}S I-FRAME`,
    nextValue: (level) => `${Math.round((level + 1) * 8)}% DASH / +${((level + 1) * 0.05).toFixed(2)}S I-FRAME`,
  },
  {
    id: 'resonance-core',
    name: 'RESONANCE CORE',
    description: 'Reduce ability cooldown and increase ability damage.',
    costs: [250, 700],
    valueAtLevel: (level) => `${Math.round(level * 10)}% CD / +${level * 8}% DMG`,
    nextValue: (level) => `${Math.round((level + 1) * 10)}% CD / +${(level + 1) * 8}% DMG`,
  },
];

export const ENEMIES: readonly EnemyDefinition[] = [
  { id: 'shardling', name: 'SHARDLING', color: '#ff8a5c', shape: 'diamond', radius: 15, hull: 24, speed: 74, damage: 12, reward: 2, weakTo: ['kinetic'], description: 'A direct vector threat. Break its approach.' },
  { id: 'swarmer', name: 'SWARMER', color: '#ffcd61', shape: 'orb', radius: 10, hull: 12, speed: 116, damage: 8, reward: 1, weakTo: ['plasma'], description: 'Fast, fragile, and dangerous in clusters.' },
  { id: 'seeker', name: 'SEEKER', color: '#ff667d', shape: 'triangle', radius: 17, hull: 30, speed: 66, damage: 16, reward: 3, weakTo: ['cryo'], description: 'Steers toward your current position.' },
  { id: 'mine', name: 'MINE', color: '#ff7d45', shape: 'mine', radius: 18, hull: 18, speed: 0, damage: 24, reward: 3, weakTo: ['void'], description: 'Stationary hazard with a wide contact radius.' },
  { id: 'lancer', name: 'LANCER', color: '#ff5c5c', shape: 'hex', radius: 18, hull: 44, speed: 54, damage: 28, reward: 4, weakTo: ['cryo'], description: 'Red line telegraph precedes a committed charge.' },
  { id: 'splitter', name: 'SPLITTER', color: '#ce72ff', shape: 'split', radius: 22, hull: 66, speed: 44, damage: 20, reward: 5, weakTo: ['plasma'], description: 'Divides into smaller threats when destroyed.' },
  { id: 'prism', name: 'PRISM', color: '#70e7ff', shape: 'wedge', radius: 21, hull: 58, speed: 32, damage: 22, reward: 6, weakTo: ['void'], description: 'Reflects shots inside its visible wedge.' },
  { id: 'harvester', name: 'HARVESTER', color: '#a6ff65', shape: 'harvest', radius: 23, hull: 78, speed: 38, damage: 18, reward: 8, weakTo: ['kinetic'], description: 'Steals nearby Dust until destroyed.' },
  { id: 'riftling', name: 'RIFTLING', color: '#bd9aff', shape: 'rift', radius: 16, hull: 48, speed: 56, damage: 18, reward: 7, weakTo: ['plasma'], description: 'Blinks between marked points.' },
  { id: 'sentinel', name: 'SENTINEL', color: '#f2c7ff', shape: 'shield', radius: 25, hull: 110, speed: 24, damage: 30, reward: 10, weakTo: ['cryo'], description: 'Rotates a shield aperture that blocks frontal shots.' },
];

export const BOSSES: readonly BossDefinition[] = [
  { id: 'grinder', name: 'GRINDER', sector: 1, reward: 180, maxHull: 900, phases: ['RADIAL FRAGMENTS', 'EDGE MINES', 'CENTER PULSE'], telegraph: 'Rotating arm hit zones and a bright pulse ring.' },
  { id: 'rail-warden', name: 'RAIL WARDEN', sector: 2, reward: 240, maxHull: 1250, phases: ['RAIL SWEEP', 'CROSSING RAILS', 'SEEKER ESCORTS'], telegraph: 'A bright line holds for 0.9 seconds before the rail fires.' },
  { id: 'bloom-mother', name: 'BLOOM MOTHER', sector: 3, reward: 300, maxHull: 1600, phases: ['SWARM LAUNCH', 'EGG EXPOSURE', 'ACID BLOOM'], telegraph: 'Eggs are visible shields; acid pools persist briefly.' },
  { id: 'prism-leviathan', name: 'PRISM LEVIATHAN', sector: 4, reward: 360, maxHull: 2050, phases: ['WEDGE LASERS', 'MIRROR LANES', 'ROTATED SENTINELS'], telegraph: 'Three wedges leave readable safe gaps.' },
  { id: 'null-crown', name: 'NULL CROWN', sector: 5, reward: 450, maxHull: 2600, phases: ['GRAVITY RINGS', 'DASH ECHO', 'FRACTURED CORE'], telegraph: 'Slow gravity wells and rotating lanes expose overload windows.' },
];

export const SECTORS: readonly SectorDefinition[] = [
  { number: 1, id: 'rust-expanse', name: 'RUST EXPANSE', boss: 'grinder', roster: ['shardling', 'swarmer', 'seeker', 'mine'], unlock: 'FRESH SAVE', baseThreat: 1 },
  { number: 2, id: 'ion-gardens', name: 'ION GARDENS', boss: 'rail-warden', roster: ['shardling', 'swarmer', 'seeker', 'mine', 'lancer', 'splitter'], unlock: 'GRINDER DEFEATED', baseThreat: 1.25 },
  { number: 3, id: 'blooming-void', name: 'BLOOMING VOID', boss: 'bloom-mother', roster: ['seeker', 'lancer', 'splitter', 'prism', 'harvester'], unlock: 'RAIL WARDEN DEFEATED', baseThreat: 1.5 },
  { number: 4, id: 'glass-trench', name: 'GLASS TRENCH', boss: 'prism-leviathan', roster: ['lancer', 'splitter', 'prism', 'harvester', 'riftling', 'sentinel'], unlock: 'BLOOM MOTHER DEFEATED', baseThreat: 1.8 },
  { number: 5, id: 'null-crown', name: 'NULL CROWN', boss: 'null-crown', roster: ['splitter', 'prism', 'harvester', 'riftling', 'sentinel'], unlock: 'PRISM LEVIATHAN DEFEATED', baseThreat: 2.1 },
];

export const ROUTES: readonly RouteDefinition[] = [
  { kind: 'sweep', name: 'SWEEP', risk: 'STEADY', reward: '+20–70 DUST', description: 'A paced combat wave. Learn the sector rhythm.', color: '#d5ff4b' },
  { kind: 'salvage', name: 'SALVAGE', risk: 'SAFE', reward: 'PATCH / CACHE / CHARGE', description: 'A quiet pocket. Take what the ring leaves behind.', color: '#70e7ff' },
  { kind: 'elite', name: 'ELITE', risk: 'HIGH', reward: '+80–140 DUST / BOON', description: 'A denser wave with an elite target and two boon choices.', color: '#ff9b4a' },
  { kind: 'rift', name: 'RIFT', risk: 'HAZARDOUS', reward: '+110 DUST / BOON', description: 'A fracture full of pressure and impossible returns.', color: '#bd9aff' },
  { kind: 'market', name: 'MARKET', risk: 'VARIABLE', reward: 'TEMPORARY BOON', description: 'Spend run Dust on a single advantage, or keep your reserve.', color: '#f2c7ff' },
];

export const HEATS: readonly { id: HeatId; name: string; effect: string; payout: number }[] = [
  { id: 'overclocked', name: 'OVERCLOCKED', effect: 'ENEMIES +18% SPEED', payout: 0.1 },
  { id: 'crowded', name: 'CROWDED', effect: '+20% SPAWN COUNT', payout: 0.15 },
  { id: 'short-fuse', name: 'SHORT FUSE', effect: 'TELEGRAPHS -20%', payout: 0.2 },
  { id: 'scarcity', name: 'SCARCITY', effect: 'SALVAGE CANNOT HEAL', payout: 0.2 },
  { id: 'fractured', name: 'FRACTURED', effect: 'BOSSES GAIN A PATTERN', payout: 0.3 },
];

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0];
}

export function getElement(id: ElementId): ElementDefinition {
  return ELEMENTS.find((element) => element.id === id) ?? ELEMENTS[0];
}

export function getAsteroid(id: AsteroidId): AsteroidDefinition {
  return ASTEROIDS.find((asteroid) => asteroid.id === id) ?? ASTEROIDS[0];
}
export const TRANSMISSIONS: readonly { id: string; title: string; body: string; condition: string }[] = [
  { id: 'transmission-1', title: 'STATIC / 01', body: 'The ring remembers every impact. It keeps the shape of the pilot who survives them.', condition: 'DEFEAT GRINDER' },
  { id: 'transmission-2', title: 'STATIC / 02', body: 'Rails do not point toward safety. They point toward whatever you refuse to abandon.', condition: 'DEFEAT RAIL WARDEN' },
  { id: 'transmission-3', title: 'STATIC / 03', body: 'The bloom is not growing. It is listening for the frequency beneath your hull.', condition: 'DEFEAT BLOOM MOTHER' },
  { id: 'transmission-4', title: 'STATIC / 04', body: 'Every mirror is a route. Every route has a cost. Choose which reflection gets to live.', condition: 'DEFEAT PRISM LEVIATHAN' },
  { id: 'transmission-5', title: 'STATIC / 05', body: 'There is no crown at the center. Only a silence that learned your name.', condition: 'DEFEAT NULL CROWN' },
  { id: 'transmission-6', title: 'STATIC / 06', body: 'You brought the Dust home. Now make the fracture answer.', condition: 'FIRST NULL CROWN CLEAR' },
];

export function getShip(id: ShipId): ShipDefinition {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}

export function getBoon(id: BoonId): BoonDefinition {
  return BOONS.find((boon) => boon.id === id) ?? BOONS[0];
}

export function getEnemy(id: EnemyId): EnemyDefinition {
  return ENEMIES.find((enemy) => enemy.id === id) ?? ENEMIES[0];
}

export function getBoss(id: BossId): BossDefinition {
  return BOSSES.find((boss) => boss.id === id) ?? BOSSES[0];
}

export function getSector(number: number): SectorDefinition {
  return SECTORS[Math.max(0, Math.min(SECTORS.length - 1, number - 1))];
}

export function getRoute(kind: NodeKind): RouteDefinition {
  return ROUTES.find((route) => route.kind === kind) ?? ROUTES[0];
}
