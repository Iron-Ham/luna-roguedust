export const LOGICAL_WIDTH = 1600;
export const LOGICAL_HEIGHT = 900;
export const FIXED_DT = 1 / 60;

export type Screen =
  | 'title'
  | 'hangar'
  | 'core'
  | 'shipyard'
  | 'archive'
  | 'settings'
  | 'route'
  | 'salvage'
  | 'boon'
  | 'market'
  | 'pause'
  | 'report'
  | 'threat'
  | 'game';

export type RunPhase = 'idle' | 'route' | 'combat' | 'boss' | 'boon' | 'salvage' | 'market' | 'dead' | 'victory' | 'paused';
export type ShipId = 'vanguard' | 'bulwark' | 'needle' | 'mirage' | 'nova';
export type EnemyId =
  | 'shardling'
  | 'swarmer'
  | 'seeker'
  | 'mine'
  | 'lancer'
  | 'splitter'
  | 'prism'
  | 'harvester'
  | 'riftling'
  | 'sentinel';
export type BossId = 'grinder' | 'rail-warden' | 'bloom-mother' | 'prism-leviathan' | 'null-crown';
export type NodeKind = 'sweep' | 'salvage' | 'elite' | 'rift' | 'market';
export type SalvageChoice = 'patch' | 'cache' | 'charge';
export type BoonId =
  | 'overclock'
  | 'echo-chamber'
  | 'magnetar'
  | 'afterimage'
  | 'prism-rounds'
  | 'drone-pact'
  | 'rift-step'
  | 'null-shell';
export type MetaId = 'hull-matrix' | 'vector-coils' | 'capacitor-bank' | 'salvage-lens' | 'phase-lattice' | 'resonance-core';
export type HeatId = 'overclocked' | 'crowded' | 'short-fuse' | 'scarcity' | 'fractured';
export type Quality = 'high' | 'balanced' | 'low';
export type AudioMode = 'sector' | 'boss' | 'quiet';
export type RunEndReason = 'destroyed' | 'victory' | 'abandoned';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SettingsData {
  music: number;
  sfx: number;
  master: number;
  reducedMotion: boolean;
  quality: Quality;
  audioUnavailable: boolean;
}

export interface MetaLevels {
  'hull-matrix': number;
  'vector-coils': number;
  'capacitor-bank': number;
  'salvage-lens': number;
  'phase-lattice': number;
  'resonance-core': number;
}

export interface RunSummary {
  reason: RunEndReason;
  dust: number;
  sector: number;
  kills: number;
  boons: BoonId[];
  ship: ShipId;
  boss?: BossId;
  newlyUnlocked: string[];
}

export interface SaveData {
  schemaVersion: 1;
  dust: number;
  selectedShip: ShipId;
  unlockedShips: ShipId[];
  meta: MetaLevels;
  discovered: string[];
  defeatedBosses: BossId[];
  transmissions: string[];
  feats: string[];
  totalKills: number;
  highestSector: number;
  threatUnlocked: boolean;
  threatModifiers: HeatId[];
  settings: SettingsData;
  lastRun: RunSummary | null;
  recoveryNotice?: string;
}

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aimTargetX: number;
  aimTargetY: number;
  firing: boolean;
  abilityPressed: boolean;
  dashPressed: boolean;
  pausePressed: boolean;
  pointerActive: boolean;
}

export interface PlayerState {
  position: Vec2;
  velocity: Vec2;
  aim: number;
  hull: number;
  maxHull: number;
  energy: number;
  maxEnergy: number;
  dashCooldown: number;
  dashDuration: number;
  invulnerable: number;
  grace: number;
  abilityCooldown: number;
  abilityDuration: number;
  afterburner: number;
  decoy: number;
  charging: number;
  lastDashAngle: number;
}

export interface RenderEnemy {
  id: EnemyId;
  x: number;
  y: number;
  radius: number;
  hull: number;
  maxHull: number;
  angle: number;
  telegraph: number;
  elite: boolean;
  flash: number;
}

export interface RenderProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  friendly: boolean;
  radius: number;
  life: number;
  color: string;
}

export interface RenderPickup {
  x: number;
  y: number;
  amount: number;
  kind: 'dust' | 'energy' | 'heal';
  life: number;
}

export interface RenderParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface RenderBoss {
  id: BossId;
  x: number;
  y: number;
  radius: number;
  hull: number;
  maxHull: number;
  phase: number;
  telegraph: number;
  pattern: number;
  name: string;
}

export interface RenderState {
  phase: RunPhase;
  ship: ShipId;
  sector: number;
  sectorName: string;
  nodeIndex: number;
  nodeTotal: number;
  runDust: number;
  heat: number;
  score: number;
  elapsed: number;
  player: PlayerState;
  boons: BoonId[];
  enemies: RenderEnemy[];
  projectiles: RenderProjectile[];
  pickups: RenderPickup[];
  particles: RenderParticle[];
  boss: RenderBoss | null;
  status: string;
  activeRoute: NodeKind | null;
  routeChoices: NodeKind[];
  shake: number;
  reducedMotion: boolean;
  quality: Quality;
}

export type GameEvent =
  | { type: 'shot'; intensity: number }
  | { type: 'dash'; intensity: number }
  | { type: 'ability'; intensity: number }
  | { type: 'hit'; intensity: number }
  | { type: 'pickup'; intensity: number }
  | { type: 'enemyDefeated'; enemy: EnemyId; x: number; y: number; dust: number }
  | { type: 'bossPhase'; boss: BossId; phase: number }
  | { type: 'bossDefeated'; boss: BossId; reward: number }
  | { type: 'feat'; id: string }
  | { type: 'routeReady'; choices: NodeKind[] }
  | { type: 'boonReady'; choices: BoonId[] }
  | { type: 'salvageReady' }
  | { type: 'marketReady'; choices: BoonId[] }
  | { type: 'runEnded'; summary: RunSummary }
  | { type: 'message'; text: string };

export interface GameCallbacks {
  onEvent: (event: GameEvent) => void;
}

export interface LaunchOptions {
  ship: ShipId;
  heat: HeatId[];
  seed: number;
}

export interface GameIntent {
  type:
    | 'launch'
    | 'select-screen'
    | 'choose-route'
    | 'choose-salvage'
    | 'choose-boon'
    | 'purchase-market'
    | 'leave-market'
    | 'buy-meta'
    | 'select-ship'
    | 'toggle-heat'
    | 'pause'
    | 'resume'
    | 'restart'
    | 'reset-save'
    | 'setting';
  screen?: Screen;
  kind?: NodeKind;
  choice?: SalvageChoice;
  boon?: BoonId;
  meta?: MetaId;
  ship?: ShipId;
  heat?: HeatId;
  key?: keyof SettingsData;
  value?: boolean | number | Quality;
}

export interface GameView {
  save: SaveData;
  render: RenderState;
}
