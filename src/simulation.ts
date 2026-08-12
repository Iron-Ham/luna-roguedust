import { BOONS, getBoss, getEnemy, getSector, getShip, getRoute, ROUTES } from './content';
import { approach, circleOverlap, moveTowardCircle, normalize, Rng, TAU, wrapAngle } from './math';
import type {
  BoonId,
  BossId,
  EnemyId,
  GameCallbacks,
  GameEvent,
  HeatId,
  InputSnapshot,
  NodeKind,
  PlayerState,
  RenderState,
  RunEndReason,
  RunPhase,
  SalvageChoice,
  SaveData,
  ShipId,
} from './types';
import { FIXED_DT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

const ARENA_CENTER = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
const ARENA_RADIUS = 390;
const MAX_ENEMIES = 96;
const MAX_PROJECTILES = 480;
const MAX_PARTICLES = 1800;
const MAX_PICKUPS = 96;
const MAX_BOONS = 3;

interface EnemyEntity {
  id: EnemyId;
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  damage: number;
  friendly: boolean;
  color: string;
  fromAbility: boolean;
}

interface PickupEntity {
  x: number;
  y: number;
  amount: number;
  kind: 'dust' | 'energy' | 'heal';
  life: number;
}

interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface BossEntity {
  id: BossId;
  x: number;
  y: number;
  radius: number;
  hull: number;
  maxHull: number;
  phase: number;
  pattern: number;
  telegraph: number;
  attackTimer: number;
  attackPending: boolean;
  angle: number;
  pylons: number;
}
export class GameSimulation {
  private readonly save: SaveData;
  private readonly callbacks: GameCallbacks;
  private rng = new Rng(1);
  private phase: RunPhase = 'idle';
  private sector = 1;
  private nodeIndex = 0;
  private readonly nodeTotal = 3;
  private activeRoute: NodeKind | null = null;
  private routeChoices: NodeKind[] = [];
  private runDust = 0;
  private elapsed = 0;
  private waveElapsed = 0;
  private spawnTimer = 0;
  private fireTimer = 0;
  private previousFiring = false;
  private droneTimer = 0;
  private score = 0;
  private waveNumber = 0;
  private status = 'SELECT A ROUTE';
  private heatIds: HeatId[] = [];
  private heatMultiplier = 1;
  private nodeDamaged = false;
  private usedDash = false;
  private pausedFrom: RunPhase = 'combat';
  private player: PlayerState;
  private ship: ShipId = 'vanguard';
  private boons: BoonId[] = [];
  private pendingBoonChoices: BoonId[] = [];
  private readonly enemies: EnemyEntity[] = [];
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

  public startRun(ship: ShipId, heat: HeatId[], seed: number): void {
    if (this.phase !== 'idle' && this.phase !== 'dead' && this.phase !== 'victory') return;
    this.ship = ship;
    this.heatIds = [...heat];
    this.heatMultiplier = 1 + heat.reduce((sum, id) => sum + (id === 'overclocked' ? 0.1 : id === 'crowded' ? 0.15 : id === 'short-fuse' ? 0.2 : id === 'scarcity' ? 0.2 : 0.3), 0);
    this.rng = new Rng(seed);
    this.phase = 'route';
    this.sector = 1;
    this.nodeIndex = 0;
    this.activeRoute = null;
    this.routeChoices = [];
    this.runDust = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.spawnTimer = 0;
    this.fireTimer = 0;
    this.previousFiring = false;
    this.score = 0;
    this.waveNumber = 0;
    this.status = 'SELECT A ROUTE';
    this.nodeDamaged = false;
    this.usedDash = false;
    this.boons = [];
    this.pendingBoonChoices = [];
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.pickups.length = 0;
    this.particles.length = 0;
    this.boss = null;
    this.shake = 0;
    this.player = this.createPlayer(ship);
    this.prepareRoute();
    this.emit({ type: 'message', text: `${getSector(this.sector).name} / EXPEDITION STARTED` });
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
    this.updatePlayer(snapshot, delta);
    this.updateParticles(delta);
    this.updatePickups(delta);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    if (this.phase === 'boss') this.updateBoss(delta);
    if (this.phase === 'combat') this.updateDirector(delta);
    if (this.phase === 'combat' || this.phase === 'boss') this.collectPickups();
    if (this.player.hull <= 0) this.finishRun('destroyed');
  }

  public pause(): void {
    if (this.phase === 'paused') {
      this.phase = this.pausedFrom;
      this.status = this.phase === 'boss' ? 'BOSS ENGAGED' : 'IN THE FRACTURE';
      this.emit({ type: 'message', text: 'SYSTEMS LIVE' });
      return;
    }
    if (this.phase !== 'combat' && this.phase !== 'boss') return;
    this.pausedFrom = this.phase;
    this.phase = 'paused';
    this.emit({ type: 'message', text: 'PAUSED — PRESS ESC TO RESUME' });
  }

  public chooseRoute(kind: NodeKind): void {
    if (this.phase !== 'route' || !this.routeChoices.includes(kind)) return;
    this.activeRoute = kind;
    this.routeChoices = [];
    this.nodeDamaged = false;
    const route = getRoute(kind);
    this.status = `${route.name} / ${route.description}`;
    if (kind === 'salvage') {
      this.phase = 'salvage';
      this.emit({ type: 'salvageReady' });
      return;
    }
    if (kind === 'market') {
      this.phase = 'market';
      this.pendingBoonChoices = this.marketChoices();
      this.emit({ type: 'marketReady', choices: [...this.pendingBoonChoices] });
      return;
    }
    this.phase = 'combat';
    this.waveElapsed = 0;
    this.spawnTimer = 0.25;
    this.waveNumber = 0;
    this.emit({ type: 'message', text: `${route.name} ACTIVE — CLEAR THE FRACTURE` });
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
    const summary = {
      reason,
      dust: earned,
      sector: this.sector,
      kills: this.score,
      boons: [...this.boons],
      ship: this.ship,
      boss: this.boss?.id,
      newlyUnlocked: [] as string[],
    };
    this.status = reason === 'victory' ? 'THE RING IS QUIET' : 'HULL FAILURE — DUST RECOVERED';
    this.emit({ type: 'runEnded', summary });
  }

  public getRenderState(): RenderState {
    const sector = getSector(this.sector);
    return {
      phase: this.phase,
      ship: this.ship,
      sector: this.sector,
      sectorName: sector.name,
      nodeIndex: this.nodeIndex,
      nodeTotal: this.nodeTotal,
      runDust: Math.floor(this.runDust),
      heat: Math.round(this.heatMultiplier * 100),
      score: this.score,
      elapsed: this.elapsed,
      player: { ...this.player, position: { ...this.player.position }, velocity: { ...this.player.velocity } },
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
        hull: enemy.hull,
        maxHull: enemy.maxHull,
        angle: enemy.angle,
        telegraph: enemy.telegraph,
        elite: enemy.elite,
        flash: enemy.flash,
      })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      pickups: this.pickups.map((pickup) => ({ ...pickup })),
      particles: this.particles.map((particle) => ({ ...particle })),
      boss: this.boss ? {
        id: this.boss.id,
        x: this.boss.x,
        y: this.boss.y,
        radius: this.boss.radius,
        hull: this.boss.hull,
        maxHull: this.boss.maxHull,
        phase: this.boss.phase,
        telegraph: this.boss.telegraph,
        pattern: this.boss.pattern,
        name: getBoss(this.boss.id).name,
      } : null,
      status: this.status,
      activeRoute: this.activeRoute,
      routeChoices: [...this.routeChoices],
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
    return {
      position: { ...ARENA_CENTER },
      velocity: { x: 0, y: 0 },
      aim: -Math.PI / 2,
      hull,
      maxHull: hull,
      energy: 100,
      maxEnergy: 100,
      dashCooldown: 0,
      dashDuration: 0,
      invulnerable: 0,
      grace: 0,
      abilityCooldown: 0,
      abilityDuration: 0,
      afterburner: 0,
      decoy: 0,
      charging: 0,
      lastDashAngle: -Math.PI / 2,
    };
  }

  private prepareRoute(): void {
    this.phase = 'route';
    this.activeRoute = null;
    this.routeChoices = [];
    const guaranteed = ROUTES[(this.nodeIndex + this.sector - 1) % ROUTES.length].kind;
    this.routeChoices.push(guaranteed);
    while (this.routeChoices.length < 3) {
      const candidate = this.rng.pick(ROUTES).kind;
      if (!this.routeChoices.includes(candidate)) this.routeChoices.push(candidate);
    }
    this.status = 'SELECT A ROUTE';
    this.emit({ type: 'routeReady', choices: [...this.routeChoices] });
  }

  private completeNode(): void {
    if (!this.activeRoute) return;
    if (!this.nodeDamaged) this.emit({ type: 'feat', id: 'clean-circuit' });
    this.nodeIndex += 1;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.activeRoute = null;
    this.pendingBoonChoices = [];
    this.waveElapsed = 0;
    if (this.nodeIndex >= this.nodeTotal) {
      this.startBoss();
      return;
    }
    this.prepareRoute();
  }

  private startBoss(): void {
    const definition = getBoss(getSector(this.sector).boss);
    this.phase = 'boss';
    this.boss = {
      id: definition.id,
      x: ARENA_CENTER.x,
      y: ARENA_CENTER.y - 180,
      radius: 92,
      hull: definition.maxHull,
      maxHull: definition.maxHull,
      phase: 1,
      pattern: 0,
      telegraph: 0,
      attackTimer: 2.2,
      attackPending: false,
      angle: 0,
      pylons: definition.id === 'rail-warden' ? 4 : 0,
    };
    this.activeRoute = null;
    this.status = `${definition.name} / BOSS GATE OPEN`;
    this.emit({ type: 'message', text: `${definition.name} APPROACHING — WATCH THE TELEGRAPH` });
  }

  private updatePlayer(input: InputSnapshot, dt: number): void {
    const player = this.player;
    const ship = getShip(this.ship);
    player.aim = input.pointerActive ? Math.atan2(input.aimTargetY - player.position.y, input.aimTargetX - player.position.x) : Math.atan2(input.aimY, input.aimX);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.grace = Math.max(0, player.grace - dt);
    player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
    player.abilityDuration = Math.max(0, player.abilityDuration - dt);
    player.afterburner = Math.max(0, player.afterburner - dt);
    player.energy = Math.min(player.maxEnergy, player.energy + dt * 8);

    const movement = normalize(input.moveX, input.moveY, 0, 0);
    const metaSpeed = 1 + this.save.meta['vector-coils'] * 0.06;
    const speedMultiplier = ship.speed * metaSpeed * (player.afterburner > 0 ? 1.5 : 1);
    const targetSpeed = 250 * speedMultiplier;
    player.velocity.x = approach(player.velocity.x, movement.x * targetSpeed, dt * 1400);
    player.velocity.y = approach(player.velocity.y, movement.y * targetSpeed, dt * 1400);
    player.position.x += player.velocity.x * dt;
    player.position.y += player.velocity.y * dt;
    const constrained = moveTowardCircle(player.position.x, player.position.y, ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS, 26);
    player.position.x = constrained.x;
    player.position.y = constrained.y;

    if (input.dashPressed && player.dashCooldown <= 0) this.dash(movement.x, movement.y);
    if (input.abilityPressed && player.abilityCooldown <= 0 && player.energy >= 35) this.useAbility();
    const fireCadence = ship.fireRate / (1 + this.save.meta['capacitor-bank'] * 0.08 + (this.hasBoon('overclock') ? 0.18 : 0));
    this.fireTimer -= dt;
    if (ship.id === 'nova') {
      if (input.firing) {
        player.charging = Math.min(1.2, player.charging + dt);
      } else if (this.previousFiring && player.charging > 0) {
        this.firePrimary(player.charging);
        player.charging = 0;
      }
      this.previousFiring = input.firing;
    } else {
      if (input.firing && this.fireTimer <= 0) {
        this.fireTimer = fireCadence;
        this.firePrimary();
      }
      this.previousFiring = input.firing;
    }
    this.droneTimer -= dt;
    if (this.hasBoon('drone-pact') && this.droneTimer <= 0) {
      this.droneTimer = 1.3;
      const angle = this.elapsed * 2.4;
      this.spawnFriendlyProjectile(player.position.x + Math.cos(angle) * 34, player.position.y + Math.sin(angle) * 34, angle, 14, '#b2ff9b', false);
    }
    if (player.dashDuration > 0 && this.hasBoon('afterimage')) {
      this.spawnParticle(player.position.x, player.position.y, '#ff6f86', 2.8);
      for (const enemy of this.enemies) {
        if (circleOverlap(player.position.x, player.position.y, 48, enemy.x, enemy.y, enemy.radius)) enemy.hull -= 34 * dt;
      }
    }
  }

  private dash(moveX: number, moveY: number): void {
    const player = this.player;
    let direction = normalize(moveX, moveY, Math.cos(player.aim), Math.sin(player.aim));
    if (Math.abs(moveX) + Math.abs(moveY) < 0.1) direction = { x: Math.cos(player.aim), y: Math.sin(player.aim) };
    const distance = 170 * (this.hasBoon('rift-step') ? 1.35 : 1);
    player.position.x += direction.x * distance;
    player.position.y += direction.y * distance;
    const constrained = moveTowardCircle(player.position.x, player.position.y, ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS, 26);
    player.position.x = constrained.x;
    player.position.y = constrained.y;
    player.dashDuration = 0.25;
    player.invulnerable = 0.25 + this.save.meta['phase-lattice'] * 0.05;
    player.dashCooldown = 0.8 * (1 - this.save.meta['phase-lattice'] * 0.08) * (this.hasBoon('rift-step') ? 1.12 : 1) * (this.ship === 'needle' ? 0.8 : 1);
    player.lastDashAngle = Math.atan2(direction.y, direction.x);
    this.usedDash = true;
    this.emit({ type: 'dash', intensity: 1 });
    this.emit({ type: 'message', text: 'DASH / PHASE SAFE' });
    for (let i = 0; i < 8; i += 1) this.spawnParticle(player.position.x, player.position.y, '#d5ff4b', 3.8);
  }

  private useAbility(): void {
    const player = this.player;
    const ship = getShip(this.ship);
    player.energy -= 35;
    player.abilityCooldown = ship.abilityCooldown * (1 - this.save.meta['resonance-core'] * 0.1);
    player.abilityDuration = ship.id === 'bulwark' ? 2.5 : ship.id === 'mirage' ? 2.5 : ship.id === 'nova' ? 1.8 : ship.id === 'needle' ? 1.2 : 0.35;
    if (ship.id === 'mirage') {
      player.decoy = 2.5;
      player.invulnerable = Math.max(player.invulnerable, 0.45);
    }
    if (ship.id === 'needle') player.afterburner = 1.2;
    const damage = 62 * (1 + this.save.meta['resonance-core'] * 0.08) * (this.hasBoon('null-shell') ? 0.88 : 1);
    const radius = ship.id === 'nova' ? 180 : 145;
    for (const enemy of this.enemies) {
      if (circleOverlap(player.position.x, player.position.y, radius, enemy.x, enemy.y, enemy.radius)) {
        enemy.hull -= damage;
        enemy.flash = 0.15;
        if (enemy.hull <= 0 && this.hasBoon('null-shell')) player.dashCooldown = Math.max(0, player.dashCooldown - 0.5);
      }
    }
    for (let i = 0; i < 22; i += 1) this.spawnParticle(player.position.x, player.position.y, ship.color, 4.5);
    this.emit({ type: 'ability', intensity: 1 });
    this.emit({ type: 'message', text: `${ship.abilityName} / ${Math.ceil(player.abilityCooldown * 10) / 10}S COOLDOWN` });
  }

  private firePrimary(charge = 1): void {
    const ship = getShip(this.ship);
    const chargedScale = ship.id === 'nova' ? 0.7 + charge * 0.9 : 1;
    const damage = ship.projectileDamage * chargedScale * (this.hasBoon('overclock') ? 0.9 : 1) * (this.player.afterburner > 0 ? 1.35 : 1);
    const spread = ship.id === 'bulwark' ? [-0.22, 0, 0.22] : ship.id === 'needle' ? [-0.13, 0.13] : [0];
    for (const offset of spread) {
      this.spawnFriendlyProjectile(this.player.position.x + Math.cos(this.player.aim) * 22, this.player.position.y + Math.sin(this.player.aim) * 22, this.player.aim + offset, damage, ship.color, ship.id === 'nova');
    }
    if (this.hasBoon('echo-chamber') && this.rng.chance(0.2)) {
      this.spawnFriendlyProjectile(this.player.position.x + Math.cos(this.player.aim) * 22, this.player.position.y + Math.sin(this.player.aim) * 22, this.player.aim, damage, '#f0d36a', false, 0.08);
    }
    this.emit({ type: 'shot', intensity: ship.id === 'nova' ? charge : 0.6 });
  }

  private updateDirector(dt: number): void {
    this.waveElapsed += dt;
    this.spawnTimer -= dt;
    const route = this.activeRoute;
    const spawnInterval = route === 'rift' ? 0.7 : route === 'elite' ? 0.82 : 1.1;
    if (this.spawnTimer <= 0 && this.waveElapsed < this.waveDuration()) {
      const baseCount = route === 'elite' ? 1 : route === 'rift' ? 2 : 1;
      const crowded = this.heatIds.includes('crowded') ? 1 : 0;
      for (let i = 0; i < baseCount + crowded; i += 1) this.spawnEnemy(route === 'elite' && this.waveNumber > 3);
      this.waveNumber += 1;
      this.spawnTimer = spawnInterval;
    }
    if (this.waveElapsed > this.waveDuration() && (this.enemies.length === 0 || this.waveElapsed > this.waveDuration() + 7)) {
      const payout = route === 'rift' ? 110 : route === 'elite' ? 90 : 28 + this.rng.int(0, 42);
      this.awardDust(payout);
      this.emit({ type: 'message', text: `${getRoute(route ?? 'sweep').name} CLEAR / +${payout} DUST` });
      if (route === 'elite' || route === 'rift') {
        this.phase = 'boon';
        this.pendingBoonChoices = this.boonChoices();
        this.emit({ type: 'boonReady', choices: [...this.pendingBoonChoices] });
      } else {
        this.completeNode();
      }
    }
  }

  private waveDuration(): number {
    if (this.activeRoute === 'elite') return 17;
    if (this.activeRoute === 'rift') return 15;
    return 13;
  }

  private spawnEnemy(elite: boolean): void {
    if (this.enemies.length >= MAX_ENEMIES) return;
    const sector = getSector(this.sector);
    const id = elite ? this.rng.pick(sector.roster) : this.rng.pick(sector.roster);
    const definition = getEnemy(id);
    const angle = this.rng.next() * TAU;
    const distance = ARENA_RADIUS + 35;
    const hullMultiplier = 1 + (this.sector - 1) * 0.12 + (elite ? 1.15 : 0);
    this.enemies.push({
      id,
      x: ARENA_CENTER.x + Math.cos(angle) * distance,
      y: ARENA_CENTER.y + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      radius: definition.radius + (elite ? 4 : 0),
      hull: definition.hull * hullMultiplier,
      maxHull: definition.hull * hullMultiplier,
      damage: definition.damage * (elite ? 1.15 : 1),
      speed: definition.speed * (1 + (this.heatIds.includes('overclocked') ? 0.18 : 0)),
      angle: angle + Math.PI,
      telegraph: 0,
      flash: 0,
      patternTimer: this.rng.next() * 2,
      chargeTimer: 0,
      elite,
      stolen: 0,
    });
  }

  private updateEnemies(dt: number): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      const definition = getEnemy(enemy.id);
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.patternTimer -= dt;
      enemy.telegraph = Math.max(0, enemy.telegraph - dt);
      const toPlayer = normalize(this.player.position.x - enemy.x, this.player.position.y - enemy.y, 0, 0);
      enemy.angle = Math.atan2(toPlayer.y, toPlayer.x);
      if (this.ship === 'nova' && this.player.abilityDuration > 0) {
        enemy.x += toPlayer.x * 180 * dt;
        enemy.y += toPlayer.y * 180 * dt;
      }
      if (enemy.id === 'mine') {
        enemy.vx = 0;
        enemy.vy = 0;
      } else if (enemy.id === 'lancer') {
        if (enemy.patternTimer <= 0 && enemy.telegraph <= 0) {
          enemy.telegraph = this.heatIds.includes('short-fuse') ? 0.72 : 0.95;
          enemy.chargeTimer = 0.22;
          enemy.patternTimer = 3.3;
        }
        if (enemy.telegraph > 0) {
          enemy.vx = 0;
          enemy.vy = 0;
        } else {
          enemy.chargeTimer = Math.max(0, enemy.chargeTimer - dt);
          const multiplier = enemy.chargeTimer > 0 ? 3.6 : 1;
          enemy.vx = toPlayer.x * enemy.speed * multiplier;
          enemy.vy = toPlayer.y * enemy.speed * multiplier;
        }
      } else if (enemy.id === 'prism') {
        enemy.vx = toPlayer.x * enemy.speed * 0.45;
        enemy.vy = toPlayer.y * enemy.speed * 0.45;
        if (enemy.patternTimer <= 0) {
          this.spawnHostile(enemy.x, enemy.y, enemy.angle, 180, 12, '#70e7ff');
          enemy.patternTimer = 2.3;
        }
      } else if (enemy.id === 'riftling') {
        enemy.vx = toPlayer.x * enemy.speed * 0.35;
        enemy.vy = toPlayer.y * enemy.speed * 0.35;
        if (enemy.patternTimer <= 0) {
          enemy.x = ARENA_CENTER.x + (this.rng.next() * 2 - 1) * 280;
          enemy.y = ARENA_CENTER.y + (this.rng.next() * 2 - 1) * 240;
          enemy.patternTimer = 2.6;
          enemy.telegraph = 0.45;
        }
      } else if (enemy.id === 'sentinel') {
        enemy.vx = toPlayer.x * enemy.speed * 0.4;
        enemy.vy = toPlayer.y * enemy.speed * 0.4;
        if (enemy.patternTimer <= 0) {
          for (let i = 0; i < 3; i += 1) this.spawnHostile(enemy.x, enemy.y, enemy.angle + (i - 1) * 0.3, 160, 15, '#f2c7ff');
          enemy.patternTimer = 2.8;
        }
      } else {
        const speedMultiplier = enemy.id === 'swarmer' ? 1.25 : enemy.id === 'seeker' ? 0.85 : 1;
        enemy.vx = toPlayer.x * enemy.speed * speedMultiplier;
        enemy.vy = toPlayer.y * enemy.speed * speedMultiplier;
        if (enemy.id === 'seeker' && enemy.patternTimer <= 0) {
          this.spawnHostile(enemy.x, enemy.y, enemy.angle, 145, 13, '#ff667d');
          enemy.patternTimer = 3.1;
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.id === 'harvester') {
        enemy.stolen += dt * 3;
        this.runDust = Math.max(0, this.runDust - dt * 1.4);
      }
      if (circleOverlap(enemy.x, enemy.y, enemy.radius, this.player.position.x, this.player.position.y, 18)) {
        this.damagePlayer(enemy.damage);
        const push = normalize(enemy.x - this.player.position.x, enemy.y - this.player.position.y, 1, 0);
        enemy.x += push.x * 26;
        enemy.y += push.y * 26;
      }
      const constrained = moveTowardCircle(enemy.x, enemy.y, ARENA_CENTER.x, ARENA_CENTER.y, ARENA_RADIUS + 16, 0);
      enemy.x = constrained.x;
      enemy.y = constrained.y;
      if (enemy.hull <= 0) this.defeatEnemy(index, definition.reward);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (projectile.life <= 0 || !this.insideProjectileBounds(projectile)) {
        this.removeAt(this.projectiles, index);
        continue;
      }
      if (!projectile.friendly) {
        if (circleOverlap(projectile.x, projectile.y, projectile.radius, this.player.position.x, this.player.position.y, 17)) {
          this.damagePlayer(projectile.damage);
          this.removeAt(this.projectiles, index);
        }
        continue;
      }
      let hit = false;
      for (const enemy of this.enemies) {
        if (!circleOverlap(projectile.x, projectile.y, projectile.radius, enemy.x, enemy.y, enemy.radius)) continue;
        const projectileAngle = Math.atan2(projectile.vy, projectile.vx);
        if (enemy.id === 'prism' && Math.abs(wrapAngle(projectileAngle - enemy.angle)) < 0.78) {
          projectile.friendly = false;
          projectile.damage *= 0.8;
          projectile.color = '#70e7ff';
          projectile.vx *= -1;
          projectile.vy *= -1;
          projectile.life = Math.min(projectile.life, 2.8);
          break;
        }
        if (enemy.id === 'sentinel' && Math.abs(wrapAngle(projectileAngle - enemy.angle)) < 1.05) {
          hit = true;
          break;
        }
        enemy.hull -= projectile.damage;
        enemy.flash = 0.12;
        if (this.hasBoon('prism-rounds')) {
          const shardAngle = projectileAngle;
          this.spawnFriendlyProjectile(projectile.x, projectile.y, shardAngle + 0.42, projectile.damage * 0.24, '#cbb3ff', false);
          this.spawnFriendlyProjectile(projectile.x, projectile.y, shardAngle - 0.42, projectile.damage * 0.24, '#cbb3ff', false);
        }
        hit = true;
        break;
      }
      if (!hit && this.boss && circleOverlap(projectile.x, projectile.y, projectile.radius, this.boss.x, this.boss.y, this.boss.radius)) {
        this.boss.hull -= projectile.damage;
        hit = true;
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
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      if (particle.life <= 0) this.removeAt(this.particles, index);
    }
  }

  private collectPickups(): void {
    const pullRadius = this.hasBoon('magnetar') ? 160 : 44;
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      const dx = this.player.position.x - pickup.x;
      const dy = this.player.position.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance < pullRadius && distance > 0.001) {
        pickup.x += (dx / distance) * 180 * FIXED_DT;
        pickup.y += (dy / distance) * 180 * FIXED_DT;
      }
      if (distance < 24) {
        if (pickup.kind === 'dust') this.awardDust(pickup.amount);
        if (pickup.kind === 'energy') this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + pickup.amount);
        if (pickup.kind === 'heal') this.player.hull = Math.min(this.player.maxHull, this.player.hull + pickup.amount);
        this.emit({ type: 'pickup', intensity: 0.7 });
        this.removeAt(this.pickups, index);
      }
    }
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
      this.emit({ type: 'message', text: `${getBoss(boss.id).name} / PHASE ${boss.phase}` });
      this.shake = this.save.settings.reducedMotion ? 0 : 1;
    }
    if (boss.telegraph <= 0 && boss.attackTimer <= 0 && !boss.attackPending) {
      boss.telegraph = this.heatIds.includes('short-fuse') ? 0.65 : 0.9;
      boss.attackTimer = Math.max(1.25, 2.6 - boss.phase * 0.25);
      boss.attackPending = true;
      this.emit({ type: 'message', text: `${getBoss(boss.id).name} TELEGRAPH / FIND THE GAP` });
    } else if (boss.attackPending && boss.telegraph <= 0) {
      boss.attackPending = false;
      this.fireBossPattern(boss);
    }
    if (boss.hull <= 0) this.defeatBoss();
  }

  private fireBossPattern(boss: BossEntity): void {
    boss.pattern += 1;
    const phase = boss.phase;
    if (boss.id === 'grinder') {
      this.fireRadial(boss.x, boss.y, 8 + phase * 2, 105 + phase * 20, 16 + phase * 3, '#ff8a5c', boss.angle);
      if (phase >= 2) {
        for (let i = 0; i < 3; i += 1) this.spawnEnemy(false);
      }
      if (phase >= 3) this.emit({ type: 'message', text: 'CENTER PULSE / STAY OUTSIDE THE RING' });
      return;
    }
    if (boss.id === 'rail-warden') {
      const lanes = phase === 1 ? [0, Math.PI / 2] : [0.3, 1.8, 2.9];
      for (const lane of lanes) this.fireLane(lane + boss.angle, 21 + phase * 2, '#ff667d');
      if (phase >= 2) for (let i = 0; i < phase; i += 1) this.spawnEnemy(false);
      return;
    }
    if (boss.id === 'bloom-mother') {
      this.fireRadial(boss.x, boss.y, 7 + phase * 2, 85 + phase * 20, 15 + phase * 3, '#a6ff65', boss.angle);
      for (let i = 0; i < phase; i += 1) this.spawnEnemy(false);
      return;
    }
    if (boss.id === 'prism-leviathan') {
      for (let i = 0; i < 3; i += 1) this.fireLane(boss.angle + i * (TAU / 3) + (phase >= 3 ? Math.PI / 3 : 0), 22, '#70e7ff');
      if (phase >= 2) this.fireRadial(boss.x, boss.y, 6, 120, 12, '#cbb3ff', boss.angle + 0.4);
      if (phase >= 3) for (let i = 0; i < 2; i += 1) this.spawnEnemy(false);
      return;
    }
    this.fireRadial(boss.x, boss.y, 10 + phase * 2, 75 + phase * 25, 17 + phase * 2, '#bd9aff', boss.angle);
    const dashEcho = this.player.lastDashAngle + (phase === 2 ? Math.PI / 2 : 0);
    if (phase >= 2) this.fireLane(dashEcho, 24, '#ff6f86');
    if (phase >= 3) for (let i = 0; i < 3; i += 1) this.spawnEnemy(false);
  }

  private defeatEnemy(index: number, reward: number): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.score += 1;
    const amount = Math.max(1, Math.round(reward * (enemy.elite ? 1.5 : 1)));
    this.spawnPickup(enemy.x, enemy.y, amount, 'dust');
    for (let i = 0; i < (enemy.elite ? 9 : 4); i += 1) this.spawnParticle(enemy.x, enemy.y, getEnemy(enemy.id).color, enemy.elite ? 4 : 2.5);
    if (enemy.id === 'splitter') {
      for (let i = 0; i < 2; i += 1) this.spawnEnemy(false);
    }
    this.emit({ type: 'enemyDefeated', enemy: enemy.id, x: enemy.x, y: enemy.y, dust: amount });
    this.removeAt(this.enemies, index);
  }

  private defeatBoss(): void {
    if (!this.boss) return;
    const defeated = this.boss.id;
    const reward = getBoss(defeated).reward;
    this.awardDust(reward);
    this.emit({ type: 'bossDefeated', boss: defeated, reward });
    if (!this.usedDash) this.emit({ type: 'feat', id: 'no-burn-victory' });
    for (let i = 0; i < 42; i += 1) this.spawnParticle(this.boss.x, this.boss.y, '#f2c7ff', 6);
    this.boss = null;
    if (this.sector >= 5) {
      this.finishRun('victory');
      return;
    }
    this.sector += 1;
    this.nodeIndex = 0;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.prepareRoute();
  }

  private damagePlayer(amount: number): void {
    if (this.player.invulnerable > 0 || this.player.grace > 0 || this.player.abilityDuration > 0 && (this.ship === 'bulwark' || this.ship === 'mirage')) return;
    const adjustedDamage = this.phase === 'boss' && this.sector === 1 ? amount * 0.65 : amount;
    this.nodeDamaged = true;
    this.player.hull -= adjustedDamage;
    this.player.grace = 0.75;
    this.shake = this.save.settings.reducedMotion ? 0 : Math.min(1, adjustedDamage / 20);
    this.emit({ type: 'hit', intensity: Math.min(1.5, adjustedDamage / 20) });
    this.emit({ type: 'message', text: `HULL ${Math.max(0, Math.ceil(this.player.hull))} / GRACE WINDOW` });
  }

  private spawnFriendlyProjectile(x: number, y: number, angle: number, damage: number, color: string, fromAbility: boolean, delay = 0): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const speed = this.ship === 'mirage' ? 860 : 720;
    this.projectiles.push({ x: x + Math.cos(angle) * delay * speed, y: y + Math.sin(angle) * delay * speed, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: fromAbility ? 8 : 5, life: 1.8 - delay, damage, friendly: true, color, fromAbility });
  }

  private spawnHostile(x: number, y: number, angle: number, speed: number, damage: number, color: string): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    this.projectiles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 7, life: 5.5, damage, friendly: false, color, fromAbility: false });
  }

  private fireRadial(x: number, y: number, count: number, speed: number, damage: number, color: string, offset: number): void {
    for (let i = 0; i < count; i += 1) this.spawnHostile(x, y, offset + i * (TAU / count), speed, damage, color);
  }

  private fireLane(angle: number, damage: number, color: string): void {
    const distance = ARENA_RADIUS + 120;
    const x = ARENA_CENTER.x + Math.cos(angle) * distance;
    const y = ARENA_CENTER.y + Math.sin(angle) * distance;
    this.spawnHostile(x, y, angle + Math.PI, 260, damage, color);
    this.spawnHostile(x, y, angle + Math.PI + 0.06, 260, damage, color);
  }

  private spawnPickup(x: number, y: number, amount: number, kind: 'dust' | 'energy' | 'heal'): void {
    if (this.pickups.length >= MAX_PICKUPS) return;
    this.pickups.push({ x, y, amount, kind, life: 18 });
  }

  private spawnParticle(x: number, y: number, color: string, size: number): void {
    if (this.save.settings.quality === 'low' && this.particles.length > 450) return;
    if (this.save.settings.quality === 'balanced' && this.particles.length > 1000) return;
    if (this.particles.length >= MAX_PARTICLES) return;
    const angle = this.rng.next() * TAU;
    const speed = 20 + this.rng.next() * 120;
    this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + this.rng.next() * 0.7, maxLife: 0.95, size: size * (0.6 + this.rng.next() * 0.8), color });
  }

  private awardDust(amount: number): void {
    const payout = this.hasBoon('magnetar') ? 1.15 : 1;
    this.runDust += amount * payout;
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
      const id = this.rng.pick(available);
      if (!choices.includes(id)) choices.push(id);
      if (choices.length === available.length) break;
    }
    return choices;
  }


  private marketChoices(): BoonId[] {
    return this.boonChoices().slice(0, 2);
  }

  private insideProjectileBounds(projectile: ProjectileEntity): boolean {
    const dx = projectile.x - ARENA_CENTER.x;
    const dy = projectile.y - ARENA_CENTER.y;
    return dx * dx + dy * dy < (ARENA_RADIUS + 140) ** 2;
  }

  private removeAt<T>(items: T[], index: number): void {
    const last = items.length - 1;
    if (index !== last) items[index] = items[last];
    items.pop();
  }

  private emit(event: GameEvent): void {
    this.callbacks.onEvent(event);
  }
}
