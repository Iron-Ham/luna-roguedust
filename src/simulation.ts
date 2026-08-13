import { ASTEROIDS, BOONS, getAsteroid, getBoss, getEnemy, getSector, getShip, getWeapon, SECTORS, WEAPONS } from './content';
import { advanceSurface, clamp, clampLatitude, projectGlobe, surfaceDirection, surfaceDistance, surfaceHeadingFromScreen, TAU, wrapAngle, wrapLongitude, Rng } from './math';
import type { AsteroidId, BoonId, BossId, ElementId, EnemyId, GameCallbacks, GameEvent, HeatId, InputSnapshot, NodeKind, PlayerState, RenderState, RunEndReason, RunMode, RunPhase, SalvageChoice, SaveData, ShipId, WeaponId } from './types';
import { FIXED_DT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

const ARENA_CENTER = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
const ARENA_RADIUS = 340;
const MAX_ENEMIES = 96;
const MAX_PROJECTILES = 480;
const MAX_PARTICLES = 1800;
const MAX_PICKUPS = 96;
const MAX_ASTEROIDS = 42;
const MAX_BOONS = 3;
const NODE_TOTAL = 3;
const SCORE_MILESTONES = [1000, 2500, 5000, 10000, 20000];
const LEVEL_SEQUENCE: readonly (readonly NodeKind[])[] = [
  ['sweep', 'salvage', 'elite'],
  ['sweep', 'rift', 'market'],
  ['elite', 'sweep', 'salvage'],
  ['rift', 'market', 'elite'],
  ['elite', 'rift', 'sweep'],
];

type GlobePoint = { longitude: number; latitude: number };
type Project = (longitude: number, latitude: number) => { x: number; y: number; depth: number };

interface EnemyEntity {
  id: EnemyId;
  longitude: number;
  latitude: number;
  radius: number;
  hull: number;
  maxHull: number;
  damage: number;
  speed: number;
  angle: number;
  telegraph: number;
  flash: number;
  patternTimer: number;
  chargeTimer: number;
  elite: boolean;
  stolen: number;
}

interface ProjectileEntity {
  longitude: number;
  latitude: number;
  heading: number;
  speed: number;
  range: number;
  travelled: number;
  radius: number;
  life: number;
  damage: number;
  friendly: boolean;
  color: string;
  element: ElementId;
  fromAbility: boolean;
}

interface AsteroidEntity {
  id: AsteroidId;
  longitude: number;
  latitude: number;
  radius: number;
  hull: number;
  maxHull: number;
  angle: number;
  weakTo: ElementId[];
}

interface PickupEntity {
  longitude: number;
  latitude: number;
  amount: number;
  kind: 'dust' | 'energy' | 'heal' | 'bomb' | 'shield' | 'life' | 'score';
  life: number;
  label?: string;
}

interface ParticleEntity {
  longitude: number;
  latitude: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface RewardEntity {
  longitude: number;
  latitude: number;
  health: number;
  maxHealth: number;
  label: string;
  color: string;
  kind: 'bomb' | 'shield' | 'life' | 'weapon';
}

interface CargoEntity {
  longitude: number;
  latitude: number;
  health: number;
  maxHealth: number;
  reward: 'bomb' | 'shield' | 'life';
  expires: number;
}

interface BossEntity {
  id: BossId;
  longitude: number;
  latitude: number;
  radius: number;
  hull: number;
  maxHull: number;
  phase: number;
  pattern: number;
  telegraph: number;
  attackTimer: number;
  attackPending: boolean;
  angle: number;
}

export class GameSimulation {
  private readonly save: SaveData;
  private readonly callbacks: GameCallbacks;
  private rng = new Rng(1);
  private phase: RunPhase = 'idle';
  private mode: RunMode = 'campaign';
  private sector = 1;
  private nodeIndex = 0;
  private activeRoute: NodeKind | null = null;
  private runDust = 0;
  private elapsed = 0;
  private waveElapsed = 0;
  private spawnTimer = 0;
  private cargoTimer = Number.POSITIVE_INFINITY;
  private cargoAvailable = false;
  private fireTimer = 0;
  private previousFiring = false;
  private droneTimer = 0;
  private score = 0;
  private kills = 0;
  private multiplier = 1;
  private multiplierTimer = 0;
  private status = 'SELECT A LEVEL';
  private heatIds: HeatId[] = [];
  private heatMultiplier = 1;
  private nodeDamaged = false;
  private usedDash = false;
  private pausedFrom: RunPhase = 'combat';
  private player: PlayerState;
  private ship: ShipId = 'vanguard';
  private weaponIndex = 0;
  private boons: BoonId[] = [];
  private pendingBoonChoices: BoonId[] = [];
  private reward: RewardEntity | null = null;
  private cargo: CargoEntity | null = null;
  private bombPulse = 0;
  private readonly enemies: EnemyEntity[] = [];
  private readonly asteroids: AsteroidEntity[] = [];
  private readonly projectiles: ProjectileEntity[] = [];
  private readonly pickups: PickupEntity[] = [];
  private readonly particles: ParticleEntity[] = [];
  private boss: BossEntity | null = null;
  private shake = 0;

  public constructor(save: SaveData, callbacks: GameCallbacks) {
    this.save = save;
    this.callbacks = callbacks;
    this.player = this.createPlayer('vanguard');
  }

  public startRun(ship: ShipId, heat: HeatId[], seed: number, mode: RunMode = 'campaign'): void {
    if (this.phase !== 'idle' && this.phase !== 'dead' && this.phase !== 'victory') return;
    this.ship = ship;
    this.mode = mode;
    this.heatIds = [...heat];
    this.heatMultiplier = 1 + heat.reduce((sum, id) => sum + (id === 'overclocked' ? 0.1 : id === 'crowded' ? 0.15 : id === 'short-fuse' ? 0.2 : id === 'scarcity' ? 0.2 : 0.3), 0);
    this.rng = new Rng(seed);
    this.phase = 'combat';
    this.sector = 1;
    this.nodeIndex = 0;
    this.runDust = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.spawnTimer = 0.35;
    this.cargoTimer = Number.POSITIVE_INFINITY;
    this.cargoAvailable = false;
    this.fireTimer = 0;
    this.previousFiring = false;
    this.droneTimer = 0;
    this.score = 0;
    this.kills = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.status = 'GLOBE SYSTEMS LIVE';
    this.nodeDamaged = false;
    this.usedDash = false;
    this.boons = [];
    this.pendingBoonChoices = [];
    this.reward = null;
    this.cargo = null;
    this.bombPulse = 0;
    this.enemies.length = 0;
    this.asteroids.length = 0;
    this.projectiles.length = 0;
    this.pickups.length = 0;
    this.particles.length = 0;
    this.boss = null;
    this.shake = 0;
    this.weaponIndex = 0;
    this.player = this.createPlayer(ship);
    this.startNode();
    this.emit({ type: 'levelStart', level: this.sector, name: this.levelName() });
    this.emit({ type: 'message', text: `${this.levelName()} // AUTHORED GLOBE ${this.nodeIndex + 1}/${NODE_TOTAL}` });
  }

  public step(snapshot: InputSnapshot, dt = FIXED_DT): void {
    if (this.phase === 'idle' || this.phase === 'route' || this.phase === 'salvage' || this.phase === 'boon' || this.phase === 'market' || this.phase === 'dead' || this.phase === 'victory') return;
    if (snapshot.pausePressed) {
      this.pause();
      return;
    }
    if (this.phase === 'paused') return;
    const delta = Math.min(0.05, Math.max(0, dt));
    this.elapsed += delta;
    this.shake = Math.max(0, this.shake - delta * 4);
    this.bombPulse = Math.max(0, this.bombPulse - delta * 2.5);
    this.multiplierTimer = Math.max(0, this.multiplierTimer - delta);
    if (this.multiplierTimer === 0) this.multiplier = Math.max(1, this.multiplier - delta * 0.7);
    this.updatePlayer(snapshot, delta);
    this.updateParticles(delta);
    this.updatePickups(delta);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    this.updateCargo(delta);
    if (this.phase === 'boss') this.updateBoss(delta);
    if (this.phase === 'combat' && !this.reward) this.updateDirector(delta);
    this.collectPickups();
    if (this.player.hull <= 0) this.finishRun('destroyed');
  }

  public pause(): void {
    if (this.phase === 'paused') {
      this.phase = this.pausedFrom;
      this.status = this.phase === 'boss' ? 'BOSS ENGAGED' : 'GLOBE SYSTEMS LIVE';
      this.emit({ type: 'message', text: 'SYSTEMS LIVE' });
      return;
    }
    if (this.phase !== 'combat' && this.phase !== 'boss' && this.phase !== 'reward') return;
    this.pausedFrom = this.phase;
    this.phase = 'paused';
    this.emit({ type: 'message', text: 'PAUSED — PRESS ESC TO RESUME' });
  }

  public chooseRoute(_kind: NodeKind): void {
    // Authored levels remove route roulette; retain the method for old UI intents.
  }

  public chooseSalvage(choice: SalvageChoice): void {
    if (this.phase !== 'salvage') return;
    if (choice === 'patch') {
      if (!this.heatIds.includes('scarcity')) this.player.hull = Math.min(this.player.maxHull, this.player.hull + 24);
      else this.emit({ type: 'message', text: 'SCARCITY: PATCH LOCKED' });
    }
    if (choice === 'cache') this.awardDust(60);
    if (choice === 'charge') this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 35);
    this.emit({ type: 'pickup', intensity: 1 });
    this.completeNode();
  }

  public chooseBoon(id: BoonId): void {
    if (this.phase !== 'boon' || !this.pendingBoonChoices.includes(id) || this.boons.length >= MAX_BOONS) return;
    this.boons.push(id);
    this.discoverBoon(id);
    this.emit({ type: 'pickup', intensity: 1.2 });
    this.completeNode();
  }

  public purchaseMarket(id: BoonId): void {
    if (this.phase !== 'market' || !this.pendingBoonChoices.includes(id) || this.runDust < 80 || this.boons.length >= MAX_BOONS) return;
    this.runDust -= 80;
    this.boons.push(id);
    this.discoverBoon(id);
    this.emit({ type: 'pickup', intensity: 1.2 });
    this.completeNode();
  }

  public leaveMarket(): void {
    if (this.phase !== 'market') return;
    this.completeNode();
  }

  public finishRun(reason: RunEndReason): void {
    if (this.phase === 'dead' || this.phase === 'victory' || this.phase === 'idle') return;
    this.phase = reason === 'victory' ? 'victory' : 'dead';
    const payout = 1 + this.save.meta['salvage-lens'] * 0.12;
    const recoveryFloor = Math.min(75, Math.floor(this.elapsed * 2.5));
    const earned = Math.max(15, recoveryFloor, Math.floor(this.runDust * payout));
    const summary = { reason, dust: earned, sector: this.sector, kills: this.kills, score: Math.floor(this.score), boons: [...this.boons], ship: this.ship, boss: this.boss?.id, mode: this.mode, newlyUnlocked: [] as string[] };
    this.status = reason === 'victory' ? 'RUN CLEAR // ENDLESS UNLOCKED' : 'HULL FAILURE — SCORE BANKED';
    this.emit({ type: 'runEnded', summary });
  }

  public getRenderState(): RenderState {
    const project = (longitude: number, latitude: number) => projectGlobe(longitude, latitude, this.player.longitude ?? 0, this.player.latitude ?? 0, ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS);
    const playerPoint = project(this.player.longitude ?? 0, this.player.latitude ?? 0);
    return {
      phase: this.phase,
      mode: this.mode,
      ship: this.ship,
      sector: this.sector,
      levelName: this.levelName(),
      sectorName: this.levelName(),
      nodeIndex: this.nodeIndex,
      nodeTotal: NODE_TOTAL,
      runDust: Math.floor(this.runDust),
      heat: Math.round(this.heatMultiplier * 100),
      score: Math.floor(this.score),
      multiplier: Math.round(this.multiplier * 100) / 100,
      levelProgress: clamp((this.nodeIndex + this.waveElapsed / Math.max(1, this.waveDuration())) / NODE_TOTAL, 0, 1),
      elapsed: this.elapsed,
      player: { ...this.player, position: { x: playerPoint.x, y: playerPoint.y }, velocity: { ...this.player.velocity } },
      boons: [...this.boons],
      enemies: this.enemies.map((enemy) => this.enemyRender(enemy, project)),
      asteroids: this.asteroids.map((asteroid) => {
        const point = project(asteroid.longitude, asteroid.latitude);
        return { id: asteroid.id, x: point.x, y: point.y, depth: point.depth, radius: asteroid.radius, hull: asteroid.hull, maxHull: asteroid.maxHull, element: asteroid.weakTo[0], weakTo: [...asteroid.weakTo], angle: asteroid.angle, color: getAsteroid(asteroid.id).color };
      }),
      projectiles: this.projectiles.map((projectile) => {
        const point = project(projectile.longitude, projectile.latitude);
        const trail = advanceSurface(projectile.longitude, projectile.latitude, projectile.heading, -0.035);
        const trailPoint = project(trail.longitude, trail.latitude);
        return { x: point.x, y: point.y, depth: point.depth, vx: (point.x - trailPoint.x) * 24, vy: (point.y - trailPoint.y) * 24, friendly: projectile.friendly, radius: projectile.radius, life: projectile.life, color: projectile.color, element: projectile.element, arc: projectile.travelled };
      }),
      pickups: this.pickups.map((pickup) => {
        const point = project(pickup.longitude, pickup.latitude);
        return { x: point.x, y: point.y, depth: point.depth, amount: pickup.amount, kind: pickup.kind, life: pickup.life, label: pickup.label };
      }),
      particles: this.particles.map((particle) => {
        const point = project(particle.longitude, particle.latitude);
        return { x: point.x, y: point.y, vx: particle.vx * 180, vy: -particle.vy * 180, life: particle.life, maxLife: particle.maxLife, size: particle.size, color: particle.color };
      }),
      boss: this.boss ? this.bossRender(this.boss, project) : null,
      reward: this.reward ? (() => { const point = project(this.reward!.longitude, this.reward!.latitude); return { x: point.x, y: point.y, depth: point.depth, health: this.reward!.health, maxHealth: this.reward!.maxHealth, label: this.reward!.label, color: this.reward!.color }; })() : null,
      cargo: this.cargo ? (() => { const point = project(this.cargo!.longitude, this.cargo!.latitude); return { x: point.x, y: point.y, depth: point.depth, health: this.cargo!.health, maxHealth: this.cargo!.maxHealth, label: `${this.cargo!.reward.toUpperCase()} CARGO`, reward: this.cargo!.reward }; })() : null,
      bombPulse: this.bombPulse,
      status: this.status,
      activeRoute: this.activeRoute,
      routeChoices: [],
      shake: this.shake,
      reducedMotion: this.save.settings.reducedMotion,
      quality: this.save.settings.quality,
    };
  }

  public getPhase(): RunPhase {
    return this.phase;
  }

  public getBoons(): readonly BoonId[] {
    return this.boons;
  }

  private createPlayer(shipId: ShipId): PlayerState {
    const ship = getShip(shipId);
    const hull = ship.maxHull + this.save.meta['hull-matrix'] * 10;
    return { position: { ...ARENA_CENTER }, velocity: { x: 0, y: 0 }, longitude: 0, latitude: 0, aim: -Math.PI / 2, hull, maxHull: hull, energy: 100, maxEnergy: 100, dashCooldown: 0, dashDuration: 0, invulnerable: 0, grace: 0, abilityCooldown: 0, abilityDuration: 0, afterburner: 0, decoy: 0, charging: 0, lastDashAngle: -Math.PI / 2, weapon: 'pulse', bombs: 2, shieldCharges: 0, lives: 0, score: 0, multiplier: 1, multiplierTimer: 0 };
  }

  private startNode(): void {
    this.activeRoute = this.nodeKind();
    this.reward = null;
    this.cargo = null;
    this.pendingBoonChoices = [];
    this.enemies.length = 0;
    this.asteroids.length = 0;
    this.projectiles.length = 0;
    this.waveElapsed = 0;
    this.spawnTimer = 0.35;
    this.cargoTimer = Number.POSITIVE_INFINITY;
    this.cargoAvailable = false;
    if (this.activeRoute === 'salvage') {
      this.phase = 'salvage';
      this.status = 'SALVAGE POCKET // TAKE YOUR CUT';
      this.emit({ type: 'salvageReady' });
      return;
    }
    if (this.activeRoute === 'market') {
      this.phase = 'market';
      this.pendingBoonChoices = this.marketChoices();
      this.status = 'BLACK MARKET // SPEND OR WALK';
      this.emit({ type: 'marketReady', choices: [...this.pendingBoonChoices] });
      return;
    }
    this.phase = 'combat';
    this.status = `${this.levelName()} // ${this.activeRoute.toUpperCase()} NODE ${this.nodeIndex + 1}/${NODE_TOTAL}`;
    this.spawnAsteroids();
    this.emit({ type: 'message', text: this.status });
  }

  private nodeKind(): NodeKind {
    if (this.mode === 'endless' && this.sector > SECTORS.length) return (['sweep', 'rift', 'elite'] as NodeKind[])[this.nodeIndex % 3];
    return LEVEL_SEQUENCE[Math.min(LEVEL_SEQUENCE.length - 1, this.sector - 1)][this.nodeIndex % NODE_TOTAL];
  }

  private completeNode(): void {
    if (!this.activeRoute) return;
    if (!this.nodeDamaged) this.emit({ type: 'feat', id: 'clean-circuit' });
    this.nodeIndex += 1;
    this.nodeDamaged = false;
    this.enemies.length = 0;
    this.asteroids.length = 0;
    this.projectiles.length = 0;
    this.reward = null;
    this.pendingBoonChoices = [];
    if (this.nodeIndex >= NODE_TOTAL) {
      this.startBoss();
      return;
    }
    this.startNode();
  }

  private startBoss(): void {
    const definition = getBoss(this.currentBossId());
    const scale = this.difficultyScale();
    this.phase = 'boss';
    this.activeRoute = null;
    this.boss = { id: definition.id, longitude: wrapLongitude((this.player.longitude ?? 0) + 0.58), latitude: clampLatitude((this.player.latitude ?? 0) + 0.22), radius: 86, hull: definition.maxHull * scale, maxHull: definition.maxHull * scale, phase: 1, pattern: 0, telegraph: 0, attackTimer: 2.2, attackPending: false, angle: 0 };
    this.status = `${definition.name} // GLOBE BOSS GATE`;
    this.emit({ type: 'message', text: `${definition.name} APPROACHING — READ THE SURFACE TELEGRAPH` });
  }

  private currentBossId(): BossId {
    if (this.mode === 'endless' && this.sector > SECTORS.length) return SECTORS[(this.sector - 1) % SECTORS.length].boss;
    return getSector(this.sector).boss;
  }

  private levelName(): string {
    if (this.mode === 'endless' && this.sector > SECTORS.length) return `ENDLESS GLOBE ${this.sector}`;
    return getSector(this.sector).name;
  }

  private difficultyScale(): number {
    const sectorScale = this.mode === 'endless' && this.sector > SECTORS.length ? 1 + (this.sector - SECTORS.length) * 0.14 : 1 + (this.sector - 1) * 0.12;
    return sectorScale * this.heatMultiplier;
  }

  private updatePlayer(input: InputSnapshot, dt: number): void {
    const player = this.player;
    const ship = getShip(this.ship);
    player.aim = input.pointerActive ? Math.atan2(input.aimTargetY - ARENA_CENTER.y, input.aimTargetX - ARENA_CENTER.x) : Math.atan2(input.aimY, input.aimX);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashDuration = Math.max(0, player.dashDuration - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.grace = Math.max(0, player.grace - dt);
    player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
    player.abilityDuration = Math.max(0, player.abilityDuration - dt);
    player.afterburner = Math.max(0, player.afterburner - dt);
    player.decoy = Math.max(0, player.decoy - dt);
    player.energy = Math.min(player.maxEnergy, player.energy + dt * 8);
    if (input.weaponNextPressed) this.cycleWeapon(1);
    if (input.weaponPrevPressed) this.cycleWeapon(-1);
    const screenX = input.moveX;
    const screenY = input.moveY;
    const moveMagnitude = clamp(Math.hypot(screenX, screenY), 0, 1);
    const movement = moveMagnitude > 0.1 ? surfaceHeadingFromScreen(screenX, screenY) : 0;
    const speed = 0.58 * ship.speed * (1 + this.save.meta['vector-coils'] * 0.06) * (player.afterburner > 0 ? 1.5 : 1);
    if (moveMagnitude > 0) {
      const next = advanceSurface(player.longitude ?? 0, player.latitude ?? 0, movement, speed * moveMagnitude * dt);
      player.longitude = next.longitude;
      player.latitude = next.latitude;
      player.velocity.x = screenX * speed * ARENA_RADIUS;
      player.velocity.y = screenY * speed * ARENA_RADIUS;
    } else {
      player.velocity.x = 0;
      player.velocity.y = 0;
    }
    if (input.dashPressed && player.dashCooldown <= 0) this.dash(input.moveX, input.moveY);
    if (input.abilityPressed && player.abilityCooldown <= 0 && player.energy >= 35) this.useAbility();
    if (input.bombPressed) this.useBomb();
    const weapon = getWeapon(this.currentWeapon());
    this.fireTimer -= dt;
    if (this.currentWeapon() === 'nova') {
      if (input.firing) player.charging = Math.min(1.2, player.charging + dt);
      else if (this.previousFiring && player.charging > 0) { this.firePrimary(player.charging); player.charging = 0; }
    } else if (input.firing && this.fireTimer <= 0) {
      this.fireTimer = weapon.cadence / (1 + this.save.meta['capacitor-bank'] * 0.08 + (this.hasBoon('overclock') ? 0.18 : 0));
      this.firePrimary();
    }
    this.previousFiring = input.firing;
    this.droneTimer -= dt;
    if (this.hasBoon('drone-pact') && this.droneTimer <= 0) {
      this.droneTimer = 1.3;
      this.spawnFriendlyProjectile(player.longitude ?? 0, player.latitude ?? 0, this.elapsed * 2.4, 14, 'kinetic', 1.1, 2.4, false);
    }
    if (player.dashDuration > 0 && this.hasBoon('afterimage')) this.spawnParticle(player.longitude ?? 0, player.latitude ?? 0, '#ff6f86', 2.8);
  }

  private dash(moveX: number, moveY: number): void {
    const heading = Math.abs(moveX) + Math.abs(moveY) > 0.1 ? Math.atan2(-moveY, moveX) : -this.player.aim;
    const next = advanceSurface(this.player.longitude ?? 0, this.player.latitude ?? 0, heading, 0.34 * (this.hasBoon('rift-step') ? 1.35 : 1));
    this.player.longitude = next.longitude;
    this.player.latitude = next.latitude;
    this.player.dashDuration = 0.25;
    this.player.invulnerable = 0.25 + this.save.meta['phase-lattice'] * 0.05;
    this.player.dashCooldown = 0.8 * (1 - this.save.meta['phase-lattice'] * 0.08) * (this.hasBoon('rift-step') ? 1.12 : 1) * (this.ship === 'needle' ? 0.8 : 1);
    this.player.lastDashAngle = heading;
    this.usedDash = true;
    this.emit({ type: 'dash', intensity: 1 });
  }

  private useAbility(): void {
    const player = this.player;
    const ship = getShip(this.ship);
    player.energy -= 35;
    player.abilityCooldown = ship.abilityCooldown * (1 - this.save.meta['resonance-core'] * 0.1);
    player.abilityDuration = ship.id === 'bulwark' ? 2.5 : ship.id === 'mirage' ? 2.5 : ship.id === 'nova' ? 1.8 : ship.id === 'needle' ? 1.2 : 0.35;
    if (ship.id === 'mirage') { player.decoy = 2.5; player.invulnerable = Math.max(player.invulnerable, 0.45); }
    if (ship.id === 'needle') player.afterburner = 1.2;
    const damage = 62 * (1 + this.save.meta['resonance-core'] * 0.08) * (this.hasBoon('null-shell') ? 0.88 : 1);
    for (const enemy of this.enemies) if (this.surfaceHit(enemy.longitude, enemy.latitude, player.longitude ?? 0, player.latitude ?? 0, 0.38)) this.damageEnemy(enemy, damage, 'void');
    if (this.boss && this.surfaceHit(this.boss.longitude, this.boss.latitude, player.longitude ?? 0, player.latitude ?? 0, 0.42)) this.boss.hull -= damage;
    this.emit({ type: 'ability', intensity: 1 });
  }

  private useBomb(): void {
    if ((this.player.bombs ?? 0) <= 0) return;
    this.player.bombs = (this.player.bombs ?? 0) - 1;
    this.bombPulse = 1;
    for (const enemy of this.enemies) this.damageEnemy(enemy, 120, 'void');
    for (const asteroid of this.asteroids) asteroid.hull -= 120;
    for (const projectile of this.projectiles) if (!projectile.friendly) projectile.life = 0;
    this.awardScore(250);
    this.emit({ type: 'bomb', intensity: 1.2 });
  }

  private firePrimary(charge = 1): void {
    const weapon = getWeapon(this.currentWeapon());
    const chargedScale = weapon.id === 'nova' ? 0.7 + charge * 0.9 : 1;
    const damage = weapon.damage * chargedScale * (this.hasBoon('overclock') ? 0.9 : 1) * (this.player.afterburner > 0 ? 1.35 : 1);
    for (const offset of weapon.spread) this.spawnFriendlyProjectile(this.player.longitude ?? 0, this.player.latitude ?? 0, -this.player.aim + offset, damage, weapon.element, weapon.speed, weapon.range, weapon.id === 'nova');
    if (this.hasBoon('echo-chamber') && this.rng.chance(0.2)) this.spawnFriendlyProjectile(this.player.longitude ?? 0, this.player.latitude ?? 0, -this.player.aim, damage, weapon.element, weapon.speed, weapon.range, false);
    this.emit({ type: 'shot', intensity: weapon.id === 'nova' ? charge : 0.6, weapon: weapon.id, element: weapon.element });
  }

  private cycleWeapon(direction: number): void {
    this.weaponIndex = (this.weaponIndex + direction + WEAPONS.length) % WEAPONS.length;
    const weapon = getWeapon(this.currentWeapon());
    this.player.weapon = weapon.id;
    this.emit({ type: 'weaponSwap', weapon: weapon.id, element: weapon.element });
    this.emit({ type: 'message', text: `${weapon.name} // ${weapon.element.toUpperCase()} SURFACE RANGE` });
  }

  private currentWeapon(): WeaponId {
    return WEAPONS[this.weaponIndex].id;
  }
  private updateDirector(dt: number): void {
    this.waveElapsed += dt;
    this.spawnTimer -= dt;
    const route = this.activeRoute;
    const interval = route === 'rift' ? 0.68 : route === 'elite' ? 0.82 : 1.05;
    if (this.spawnTimer <= 0 && this.waveElapsed < this.waveDuration()) {
      const baseCount = route === 'elite' ? 1 : route === 'rift' ? 2 : 1;
      const crowded = this.heatIds.includes('crowded') ? 1 : 0;
      for (let index = 0; index < baseCount + crowded; index += 1) this.spawnEnemy(route === 'elite' && this.waveElapsed > 7);
      this.spawnTimer = interval;
    }
    if (this.waveElapsed > this.waveDuration() && this.enemies.length === 0) this.spawnReward();
  }

  private waveDuration(): number {
    if (this.activeRoute === 'elite') return 17;
    if (this.activeRoute === 'rift') return 15;
    return 13;
  }

  private spawnEnemy(elite: boolean): void {
    if (this.enemies.length >= MAX_ENEMIES) return;
    const sector = getSector(Math.min(SECTORS.length, Math.max(1, this.sector)));
    const roster: EnemyId[] = this.mode === 'endless' && this.sector > SECTORS.length ? [...sector.roster, 'lancer', 'splitter', 'prism', 'harvester', 'riftling', 'sentinel'] : [...sector.roster];
    const id = this.rng.pick(roster);
    const definition = getEnemy(id);
    const point = this.randomSurfacePoint(0.38);
    const scale = this.difficultyScale() * (elite ? 2.15 : 1);
    this.enemies.push({
      id,
      longitude: point.longitude,
      latitude: point.latitude,
      radius: definition.radius + (elite ? 4 : 0),
      hull: definition.hull * scale,
      maxHull: definition.hull * scale,
      damage: definition.damage * (elite ? 1.15 : 1) * scale,
      speed: definition.speed * (1 + Math.max(0, this.sector - 1) * 0.045) * (this.heatIds.includes('overclocked') ? 1.18 : 1),
      angle: 0,
      telegraph: 0,
      flash: 0,
      patternTimer: this.rng.next() * 2,
      chargeTimer: 0,
      elite,
      stolen: 0,
    });
  }

  private spawnAsteroids(): void {
    const count = Math.min(MAX_ASTEROIDS, 4 + Math.floor(this.sector * 1.2));
    for (let index = 0; index < count; index += 1) {
      const definition = this.rng.pick(ASTEROIDS);
      const point = this.randomSurfacePoint(0.18);
      const scale = this.difficultyScale();
      this.asteroids.push({ id: definition.id, longitude: point.longitude, latitude: point.latitude, radius: definition.radius, hull: definition.hull * scale, maxHull: definition.hull * scale, angle: this.rng.next() * TAU, weakTo: [...definition.weakTo] });
    }
  }

  private updateEnemies(dt: number): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      const definition = getEnemy(enemy.id);
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.patternTimer -= dt;
      enemy.telegraph = Math.max(0, enemy.telegraph - dt);
      const direction = surfaceDirection(enemy.longitude, enemy.latitude, this.player.longitude ?? 0, this.player.latitude ?? 0);
      enemy.angle = Math.atan2(-direction.y, direction.x);
      let speed = enemy.speed / 430;
      if (enemy.id === 'mine') speed = 0;
      if (enemy.id === 'lancer' && enemy.patternTimer <= 0 && enemy.telegraph <= 0) {
        enemy.telegraph = this.heatIds.includes('short-fuse') ? 0.72 : 0.95;
        enemy.chargeTimer = 0.24;
        enemy.patternTimer = 3.3;
      }
      if (enemy.telegraph <= 0 && enemy.id !== 'mine') {
        if (enemy.id === 'lancer' && enemy.chargeTimer > 0) speed *= 3.6;
        const next = advanceSurface(enemy.longitude, enemy.latitude, Math.atan2(direction.y, direction.x), speed * dt);
        enemy.longitude = next.longitude;
        enemy.latitude = next.latitude;
      }
      enemy.chargeTimer = Math.max(0, enemy.chargeTimer - dt);
      if (enemy.id === 'prism' && enemy.patternTimer <= 0) {
        this.spawnHostile(enemy.longitude, enemy.latitude, enemy.angle, 1.1, 12, 'cryo');
        enemy.patternTimer = 2.3;
      }
      if (enemy.id === 'seeker' && enemy.patternTimer <= 0) {
        this.spawnHostile(enemy.longitude, enemy.latitude, enemy.angle, 1, 13, 'plasma');
        enemy.patternTimer = 3.1;
      }
      if (enemy.id === 'riftling' && enemy.patternTimer <= 0) {
        const point = this.randomSurfacePoint(0.3);
        enemy.longitude = point.longitude;
        enemy.latitude = point.latitude;
        enemy.patternTimer = 2.6;
        enemy.telegraph = 0.45;
      }
      if (enemy.id === 'sentinel' && enemy.patternTimer <= 0) {
        for (let shot = 0; shot < 3; shot += 1) this.spawnHostile(enemy.longitude, enemy.latitude, enemy.angle + (shot - 1) * 0.3, 1.05, 15, 'cryo');
        enemy.patternTimer = 2.8;
      }
      if (enemy.id === 'harvester') this.runDust = Math.max(0, this.runDust - dt * 1.4);
      if (this.surfaceHit(enemy.longitude, enemy.latitude, this.player.longitude ?? 0, this.player.latitude ?? 0, (enemy.radius + 18) / ARENA_RADIUS)) this.damagePlayer(enemy.damage);
      if (enemy.hull <= 0) this.defeatEnemy(index, definition.reward);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      if (!projectile) continue;
      projectile.life -= dt;
      const next = advanceSurface(projectile.longitude, projectile.latitude, projectile.heading, projectile.speed * dt);
      projectile.longitude = next.longitude;
      projectile.latitude = next.latitude;
      projectile.travelled += projectile.speed * dt;
      if (projectile.life <= 0 || projectile.travelled >= projectile.range) {
        this.removeAt(this.projectiles, index);
        continue;
      }
      if (!projectile.friendly) {
        if (this.surfaceHit(projectile.longitude, projectile.latitude, this.player.longitude ?? 0, this.player.latitude ?? 0, (projectile.radius + 17) / ARENA_RADIUS)) {
          this.damagePlayer(projectile.damage);
          this.removeAt(this.projectiles, index);
        }
        continue;
      }
      let hit = false;
      if (this.reward && this.surfaceHit(projectile.longitude, projectile.latitude, this.reward.longitude, this.reward.latitude, 0.12)) {
        this.reward.health -= projectile.damage;
        hit = true;
        if (this.reward.health <= 0) this.collectReward();
      } else if (this.cargo && this.surfaceHit(projectile.longitude, projectile.latitude, this.cargo.longitude, this.cargo.latitude, 0.11)) {
        this.cargo.health -= projectile.damage;
        hit = true;
        if (this.cargo.health <= 0) this.collectCargo();
      } else {
        for (const enemy of this.enemies) {
          if (!this.surfaceHit(projectile.longitude, projectile.latitude, enemy.longitude, enemy.latitude, (enemy.radius + projectile.radius) / ARENA_RADIUS)) continue;
          const projectileAngle = projectile.heading;
          if (enemy.id === 'prism' && Math.abs(wrapAngle(projectileAngle - enemy.angle)) < 0.78) {
            projectile.friendly = false;
            projectile.damage *= 0.8;
            projectile.color = '#70e7ff';
            projectile.heading = wrapAngle(projectile.heading + Math.PI);
            hit = false;
            break;
          }
          if (enemy.id === 'sentinel' && Math.abs(wrapAngle(projectileAngle - enemy.angle)) < 1.05) {
            hit = true;
            break;
          }
          this.damageEnemy(enemy, projectile.damage, projectile.element);
          if (this.hasBoon('prism-rounds')) {
            this.spawnFriendlyProjectile(projectile.longitude, projectile.latitude, projectile.heading + 0.42, projectile.damage * 0.24, projectile.element, projectile.speed, 1.2, false);
            this.spawnFriendlyProjectile(projectile.longitude, projectile.latitude, projectile.heading - 0.42, projectile.damage * 0.24, projectile.element, projectile.speed, 1.2, false);
          }
          hit = true;
          break;
        }
        if (!hit) {
          for (const asteroid of this.asteroids) {
            if (!this.surfaceHit(projectile.longitude, projectile.latitude, asteroid.longitude, asteroid.latitude, (asteroid.radius + projectile.radius) / ARENA_RADIUS)) continue;
            this.damageAsteroid(asteroid, projectile.damage, projectile.element);
            hit = true;
            break;
          }
        }
        if (!hit && this.boss && this.surfaceHit(projectile.longitude, projectile.latitude, this.boss.longitude, this.boss.latitude, (this.boss.radius + projectile.radius) / ARENA_RADIUS)) {
          this.boss.hull -= projectile.damage;
          hit = true;
        }
      }
      if (hit) this.removeAt(this.projectiles, index);
    }
  }

  private updatePickups(dt: number): void {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      pickup.life -= dt;
      if (pickup.life <= 0) this.removeAt(this.pickups, index);
    }
  }

  private updateParticles(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.longitude = wrapLongitude(particle.longitude + particle.vx * dt);
      particle.latitude = clampLatitude(particle.latitude + particle.vy * dt);
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      if (particle.life <= 0) this.removeAt(this.particles, index);
    }
  }

  private collectPickups(): void {
    const pullRadius = this.hasBoon('magnetar') ? 0.34 : 0.1;
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      const distance = surfaceDistance(pickup.longitude, pickup.latitude, this.player.longitude ?? 0, this.player.latitude ?? 0);
      if (distance < pullRadius && distance > 0.002) {
        const direction = surfaceDirection(pickup.longitude, pickup.latitude, this.player.longitude ?? 0, this.player.latitude ?? 0);
        const next = advanceSurface(pickup.longitude, pickup.latitude, Math.atan2(direction.y, direction.x), Math.min(distance, FIXED_DT * 1.8));
        pickup.longitude = next.longitude;
        pickup.latitude = next.latitude;
      }
      if (distance < 0.075) {
        if (pickup.kind === 'dust') this.awardDust(pickup.amount);
        if (pickup.kind === 'score') this.awardScore(pickup.amount);
        if (pickup.kind === 'energy') this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + pickup.amount);
        if (pickup.kind === 'heal') this.player.hull = Math.min(this.player.maxHull, this.player.hull + pickup.amount);
        if (pickup.kind === 'bomb') this.player.bombs = (this.player.bombs ?? 0) + pickup.amount;
        if (pickup.kind === 'shield') this.player.shieldCharges = (this.player.shieldCharges ?? 0) + pickup.amount;
        if (pickup.kind === 'life') this.player.lives = (this.player.lives ?? 0) + pickup.amount;
        this.emit({ type: 'pickup', intensity: 0.7 });
        this.removeAt(this.pickups, index);
      }
    }
  }

  private updateCargo(_dt: number): void {
    if (this.cargo && this.elapsed > this.cargo.expires) {
      this.cargo = null;
      this.cargoAvailable = false;
    }
    if (this.cargoAvailable && !this.cargo && this.phase === 'combat' && this.elapsed >= this.cargoTimer) {
      const reward = this.rng.chance(0.12) ? 'life' : this.rng.chance(0.25) ? 'shield' : 'bomb';
      const point = this.randomSurfacePoint(0.22);
      this.cargo = { longitude: point.longitude, latitude: point.latitude, health: 65, maxHealth: 65, reward, expires: this.elapsed + 12 };
      this.cargoAvailable = false;
      this.emit({ type: 'cargoEvent', reward });
    }
  }

  private spawnReward(): void {
    const point = this.randomSurfacePoint(0.18);
    const kind = this.rng.chance(0.3) ? 'weapon' : this.rng.chance(0.5) ? 'bomb' : 'shield';
    const label = kind === 'weapon' ? 'WEAPON CACHE' : kind === 'bomb' ? 'BOMB CACHE' : 'SHIELD CACHE';
    this.reward = { longitude: point.longitude, latitude: point.latitude, health: 105, maxHealth: 105, label, color: kind === 'weapon' ? '#bd9aff' : kind === 'bomb' ? '#f0d36a' : '#70e7ff', kind };
    this.phase = 'reward';
    this.status = `${label} // BREAK THE CRATE`;
    this.emit({ type: 'rewardReady', label });
    this.emit({ type: 'message', text: `${label} DEPLOYED // BREAK IT FOR THE BONUS` });
  }

  private collectReward(): void {
    if (!this.reward) return;
    const reward = this.reward.kind;
    if (reward === 'bomb') this.player.bombs = (this.player.bombs ?? 0) + 2;
    if (reward === 'shield') this.player.shieldCharges = (this.player.shieldCharges ?? 0) + 1;
    if (reward === 'weapon') this.cycleWeapon(1);
    this.awardDust(75);
    this.awardScore(180);
    this.emit({ type: 'pickup', intensity: 1.2 });
    this.phase = 'combat';
    this.completeNode();
  }

  private collectCargo(): void {
    if (!this.cargo) return;
    if (this.cargo.reward === 'bomb') this.player.bombs = (this.player.bombs ?? 0) + 1;
    if (this.cargo.reward === 'shield') this.player.shieldCharges = (this.player.shieldCharges ?? 0) + 1;
    if (this.cargo.reward === 'life') this.player.lives = (this.player.lives ?? 0) + 1;
    this.emit({ type: 'pickup', intensity: 1 });
    this.cargo = null;
    this.cargoAvailable = false;
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;
    const boss = this.boss;
    boss.angle += dt * 0.5;
    boss.attackTimer -= dt;
    boss.telegraph = Math.max(0, boss.telegraph - dt);
    const healthRatio = boss.hull / boss.maxHull;
    const nextPhase = healthRatio <= 0.33 ? 3 : healthRatio <= 0.66 ? 2 : 1;
    if (nextPhase > boss.phase) {
      boss.phase = nextPhase;
      this.emit({ type: 'bossPhase', boss: boss.id, phase: boss.phase });
      this.emit({ type: 'message', text: `${getBoss(boss.id).name} // PHASE ${boss.phase}` });
      this.shake = this.save.settings.reducedMotion ? 0 : 1;
    }
    if (boss.telegraph <= 0 && boss.attackTimer <= 0 && !boss.attackPending) {
      boss.telegraph = this.heatIds.includes('short-fuse') ? 0.65 : 0.9;
      boss.attackTimer = Math.max(1.25, 2.6 - boss.phase * 0.25);
      boss.attackPending = true;
      this.emit({ type: 'message', text: `${getBoss(boss.id).name} TELEGRAPH / FIND THE GLOBE GAP` });
    } else if (boss.attackPending && boss.telegraph <= 0) {
      boss.attackPending = false;
      this.fireBossPattern(boss);
    }
    if (boss.hull <= 0) this.defeatBoss();
  }

  private fireBossPattern(boss: BossEntity): void {
    const phase = boss.phase;
    boss.pattern += 1;
    if (boss.id === 'grinder') {
      this.fireRadial(boss.longitude, boss.latitude, 8 + phase * 2, 1.0 + phase * 0.1, 16 + phase * 3, 'plasma', boss.angle);
      if (phase >= 2) for (let index = 0; index < 3; index += 1) this.spawnEnemy(false);
      return;
    }
    if (boss.id === 'rail-warden') {
      const lanes = phase === 1 ? [0, Math.PI / 2] : [0.3, 1.8, 2.9];
      for (const lane of lanes) this.fireLane(boss, lane + boss.angle, 21 + phase * 2, 'plasma');
      if (phase >= 2) for (let index = 0; index < phase; index += 1) this.spawnEnemy(false);
      return;
    }
    if (boss.id === 'bloom-mother') {
      this.fireRadial(boss.longitude, boss.latitude, 7 + phase * 2, 0.9 + phase * 0.1, 15 + phase * 3, 'plasma', boss.angle);
      for (let index = 0; index < phase; index += 1) this.spawnEnemy(false);
      return;
    }
    if (boss.id === 'prism-leviathan') {
      for (let index = 0; index < 3; index += 1) this.fireLane(boss, boss.angle + index * (TAU / 3) + (phase >= 3 ? Math.PI / 3 : 0), 22, 'cryo');
      if (phase >= 2) this.fireRadial(boss.longitude, boss.latitude, 6, 1.1, 12, 'void', boss.angle + 0.4);
      if (phase >= 3) for (let index = 0; index < 2; index += 1) this.spawnEnemy(false);
      return;
    }
    this.fireRadial(boss.longitude, boss.latitude, 10 + phase * 2, 0.85 + phase * 0.12, 17 + phase * 2, 'void', boss.angle);
    if (phase >= 2) this.fireLane(boss, this.player.aim + (phase === 2 ? Math.PI / 2 : 0), 24, 'void');
    if (phase >= 3) for (let index = 0; index < 3; index += 1) this.spawnEnemy(false);
  }

  private defeatEnemy(index: number, reward: number): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.kills += 1;
    this.multiplier = Math.min(8, this.multiplier + 0.12);
    this.multiplierTimer = 2.4;
    const amount = Math.max(1, Math.round(reward * (enemy.elite ? 1.5 : 1)));
    this.spawnPickup(enemy.longitude, enemy.latitude, amount, 'dust');
    this.awardScore((20 + reward * 6) * (enemy.elite ? 2 : 1));
    for (let particle = 0; particle < (enemy.elite ? 9 : 4); particle += 1) this.spawnParticle(enemy.longitude, enemy.latitude, getEnemy(enemy.id).color, enemy.elite ? 4 : 2.5);
    if (enemy.id === 'splitter') for (let split = 0; split < 2; split += 1) this.spawnEnemy(false);
    this.emit({ type: 'enemyDefeated', enemy: enemy.id, x: ARENA_CENTER.x, y: ARENA_CENTER.y, dust: amount });
    this.removeAt(this.enemies, index);
  }

  private defeatBoss(): void {
    if (!this.boss) return;
    const defeated = this.boss.id;
    const reward = getBoss(defeated).reward;
    this.awardDust(reward);
    this.awardScore(reward * 10);
    this.emit({ type: 'bossDefeated', boss: defeated, reward });
    if (!this.usedDash) this.emit({ type: 'feat', id: 'no-burn-victory' });
    for (let particle = 0; particle < 42; particle += 1) this.spawnParticle(this.boss.longitude, this.boss.latitude, '#f2c7ff', 6);
    this.boss = null;
    if (this.sector >= SECTORS.length && this.mode === 'campaign') {
      this.save.endlessUnlocked = true;
      this.finishRun('victory');
      return;
    }
    this.sector += 1;
    this.nodeIndex = 0;
    this.enemies.length = 0;
    this.asteroids.length = 0;
    this.projectiles.length = 0;
    this.startNode();
  }

  private damagePlayer(amount: number): void {
    if (this.player.invulnerable > 0 || this.player.grace > 0 || this.player.abilityDuration > 0 && (this.ship === 'bulwark' || this.ship === 'mirage')) return;
    if ((this.player.shieldCharges ?? 0) > 0) {
      this.player.shieldCharges = (this.player.shieldCharges ?? 0) - 1;
      this.player.grace = 0.5;
      this.emit({ type: 'message', text: 'SHIELD CHARGE // IMPACT NULLIFIED' });
      return;
    }
    const adjustedDamage = this.phase === 'boss' && this.sector === 1 ? amount * 0.65 : amount;
    this.nodeDamaged = true;
    this.player.hull -= adjustedDamage;
    this.player.grace = 0.75;
    this.shake = this.save.settings.reducedMotion ? 0 : Math.min(1, adjustedDamage / 20);
    this.emit({ type: 'hit', intensity: Math.min(1.5, adjustedDamage / 20) });
    this.emit({ type: 'message', text: `HULL ${Math.max(0, Math.ceil(this.player.hull))} / GRACE WINDOW` });
  }

  private damageEnemy(enemy: EnemyEntity, damage: number, element: ElementId): void {
    const multiplier = getEnemy(enemy.id).weakTo.includes(element) ? 1.75 : 1;
    enemy.hull -= damage * multiplier;
    enemy.flash = 0.12;
    if (multiplier > 1) this.emit({ type: 'elementHit', element, multiplier });
  }

  private damageAsteroid(asteroid: AsteroidEntity, damage: number, element: ElementId): void {
    const multiplier = asteroid.weakTo.includes(element) ? 1.8 : 1;
    asteroid.hull -= damage * multiplier;
    if (multiplier > 1) this.emit({ type: 'elementHit', element, multiplier });
    if (asteroid.hull <= 0) {
      this.awardDust(getAsteroid(asteroid.id).reward);
      this.awardScore(55);
      this.removeAt(this.asteroids, this.asteroids.indexOf(asteroid));
    }
  }
  private spawnFriendlyProjectile(longitude: number, latitude: number, heading: number, damage: number, element: ElementId, speed: number, range: number, fromAbility: boolean): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const definition = getWeapon(this.currentWeapon());
    this.projectiles.push({ longitude, latitude, heading: wrapAngle(heading), speed, range, travelled: 0, radius: fromAbility ? 0.035 : 0.018, life: range / speed + 0.2, damage, friendly: true, color: definition.color, element, fromAbility });
  }

  private spawnHostile(longitude: number, latitude: number, heading: number, speed: number, damage: number, element: ElementId): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const color = element === 'plasma' ? '#ff667d' : element === 'cryo' ? '#70e7ff' : element === 'void' ? '#bd9aff' : '#ff9b4a';
    const range = 2.6;
    this.projectiles.push({ longitude, latitude, heading: wrapAngle(heading), speed, range, travelled: 0, radius: 0.024, life: range / speed + 0.2, damage, friendly: false, color, element, fromAbility: false });
  }

  private fireRadial(longitude: number, latitude: number, count: number, speed: number, damage: number, element: ElementId, offset: number): void {
    for (let index = 0; index < count; index += 1) this.spawnHostile(longitude, latitude, offset + index * (TAU / count), speed, damage, element);
  }

  private fireLane(boss: BossEntity, heading: number, damage: number, element: ElementId): void {
    this.spawnHostile(boss.longitude, boss.latitude, heading, 1.25, damage, element);
    this.spawnHostile(boss.longitude, boss.latitude, heading + 0.06, 1.25, damage, element);
  }

  private spawnPickup(longitude: number, latitude: number, amount: number, kind: PickupEntity['kind'], label?: string): void {
    if (this.pickups.length >= MAX_PICKUPS) return;
    this.pickups.push({ longitude, latitude, amount, kind, life: 18, label });
  }

  private spawnParticle(longitude: number, latitude: number, color: string, size: number): void {
    if (this.save.settings.quality === 'low' && this.particles.length > 450) return;
    if (this.save.settings.quality === 'balanced' && this.particles.length > 1000) return;
    if (this.particles.length >= MAX_PARTICLES) return;
    const angle = this.rng.next() * TAU;
    const speed = 0.04 + this.rng.next() * 0.18;
    this.particles.push({ longitude, latitude, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + this.rng.next() * 0.7, maxLife: 0.95, size: size * (0.6 + this.rng.next() * 0.8), color });
  }

  private awardDust(amount: number): void {
    this.runDust += amount * (this.hasBoon('magnetar') ? 1.15 : 1);
  }

  private awardScore(amount: number): void {
    this.score += amount;
    const next = SCORE_MILESTONES.find((milestone) => milestone <= this.score && !this.save.scoreMilestones.includes(milestone));
    if (next !== undefined) {
      this.save.scoreMilestones.push(next);
      const reward = 20 + Math.floor(next / 100);
      this.emit({ type: 'scoreMilestone', score: next, reward });
      this.emit({ type: 'message', text: `SCORE MILESTONE ${next.toLocaleString()} // +${reward} DUST` });
    }
  }

  private discoverBoon(id: BoonId): void {
    if (!this.save.discovered.includes(id)) this.save.discovered.push(id);
  }

  private hasBoon(id: BoonId): boolean {
    return this.boons.includes(id);
  }

  private boonChoices(): BoonId[] {
    const available = BOONS.filter((boon) => {
      if (this.boons.includes(boon.id)) return false;
      if (boon.id === 'echo-chamber') return this.save.discovered.includes('echo-chamber');
      if (boon.id === 'prism-rounds' || boon.id === 'rift-step') return this.save.defeatedBosses.includes('grinder');
      if (boon.id === 'drone-pact') return this.save.defeatedBosses.includes('rail-warden');
      if (boon.id === 'afterimage') return this.save.defeatedBosses.includes('bloom-mother');
      if (boon.id === 'null-shell') return this.save.discovered.includes('null-shell') || this.save.defeatedBosses.includes('bloom-mother');
      return true;
    }).map((boon) => boon.id);
    const choices: BoonId[] = [];
    while (choices.length < Math.min(2, available.length)) {
      const choice = this.rng.pick(available);
      if (!choices.includes(choice)) choices.push(choice);
    }
    return choices;
  }

  private marketChoices(): BoonId[] {
    return this.boonChoices().slice(0, 2);
  }

  private randomSurfacePoint(distance: number): GlobePoint {
    const angle = this.rng.next() * TAU;
    const radius = distance * (0.72 + this.rng.next() * 0.5);
    const latitude = clampLatitude((this.player.latitude ?? 0) + Math.sin(angle) * radius);
    const latitudeScale = Math.max(0.16, Math.cos(latitude));
    return { longitude: wrapLongitude((this.player.longitude ?? 0) + Math.cos(angle) * radius / latitudeScale), latitude };
  }

  private surfaceHit(longitudeA: number, latitudeA: number, longitudeB: number, latitudeB: number, radius: number): boolean {
    return surfaceDistance(longitudeA, latitudeA, longitudeB, latitudeB) <= radius;
  }

  private enemyRender(enemy: EnemyEntity, project: Project): RenderState['enemies'][number] {
    const point = project(enemy.longitude, enemy.latitude);
    return { id: enemy.id, x: point.x, y: point.y, depth: point.depth, radius: enemy.radius, hull: enemy.hull, maxHull: enemy.maxHull, angle: enemy.angle, telegraph: enemy.telegraph, elite: enemy.elite, flash: enemy.flash, element: getEnemy(enemy.id).weakTo[0], weakTo: [...getEnemy(enemy.id).weakTo] };
  }

  private bossRender(boss: BossEntity, project: Project): NonNullable<RenderState['boss']> {
    const point = project(boss.longitude, boss.latitude);
    return { id: boss.id, x: point.x, y: point.y, depth: point.depth, radius: boss.radius, hull: boss.hull, maxHull: boss.maxHull, phase: boss.phase, telegraph: boss.telegraph, pattern: boss.pattern, name: getBoss(boss.id).name };
  }

  private removeAt<T>(items: T[], index: number): void {
    if (index >= 0 && index < items.length) items.splice(index, 1);
  }

  private emit(event: GameEvent): void {
    this.callbacks.onEvent(event);
  }
}
