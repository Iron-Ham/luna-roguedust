import { getBoon, getBoss, getEnemy, getShip, getWeapon } from './content';
import { clamp, TAU } from './math';
import type { Quality, RenderEnemy, RenderState } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

const QUALITY_DPR: Record<Quality, number> = { high: 1.5, balanced: 1.25, low: 1 };

export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly stars: HTMLCanvasElement;
  private readonly starContext: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private quality: Quality = 'balanced';

  public constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.canvas = canvas;
    this.context = context;
    this.stars = document.createElement('canvas');
    this.stars.width = LOGICAL_WIDTH;
    this.stars.height = LOGICAL_HEIGHT;
    const starContext = this.stars.getContext('2d');
    if (!starContext) throw new Error('Starfield canvas unavailable');
    this.starContext = starContext;
    this.createStarfield();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  public setQuality(quality: Quality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.resize();
  }

  public resize(): void {
    const dpr = QUALITY_DPR[this.quality];
    this.canvas.width = Math.round(LOGICAL_WIDTH * dpr);
    this.canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
  }

  public render(state: RenderState): void {
    const ctx = this.context;
    const dpr = this.canvas.width / LOGICAL_WIDTH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    this.drawBackground(ctx, state);
    ctx.save();
    if (!state.reducedMotion && state.shake > 0) {
      ctx.translate((Math.sin(state.elapsed * 74) * state.shake) * 5, (Math.cos(state.elapsed * 61) * state.shake) * 4);
    }
    this.drawArena(ctx, state);
    this.drawAsteroids(ctx, state);
    this.drawCargo(ctx, state);
    this.drawReward(ctx, state);
    this.drawPickups(ctx, state);
    this.drawParticles(ctx, state);
    this.drawProjectiles(ctx, state);
    for (const enemy of [...state.enemies].sort((a, b) => a.depth - b.depth)) this.drawEnemy(ctx, enemy, state.elapsed);
    if (state.boss) this.drawBoss(ctx, state);
    this.drawPlayer(ctx, state);
    this.drawVignette(ctx);
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
  }

  private createStarfield(): void {
    const ctx = this.starContext;
    ctx.fillStyle = '#0a081b';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    let seed = 0x4f1bbcdc;
    const next = (): number => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0x100000000;
    };
    for (let i = 0; i < 290; i += 1) {
      const x = next() * LOGICAL_WIDTH;
      const y = next() * LOGICAL_HEIGHT;
      const radius = 0.4 + next() * 1.8;
      const alpha = 0.12 + next() * 0.38;
      ctx.fillStyle = `rgba(${90 + Math.floor(next() * 80)}, ${80 + Math.floor(next() * 85)}, ${150 + Math.floor(next() * 90)}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
    const nebula = ctx.createRadialGradient(1120, 310, 30, 1120, 310, 570);
    nebula.addColorStop(0, 'rgba(104, 67, 169, 0.19)');
    nebula.addColorStop(0.46, 'rgba(73, 43, 133, 0.08)');
    nebula.addColorStop(1, 'rgba(8, 7, 22, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(450, 0, 1150, 900);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, state: RenderState): void {
    ctx.drawImage(this.stars, 0, 0);
    const pulse = 0.5 + Math.sin(state.elapsed * 0.55) * 0.08;
    ctx.fillStyle = `rgba(29, 21, 61, ${pulse * 0.22})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = '#b8a7e2';
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.letterSpacing = '0.18em';
    ctx.fillText('IONIZED SALVAGE // LIVE FEED', 38, 42);
    ctx.fillText(`SECTOR ${String(state.sector).padStart(2, '0')} / ${state.sectorName}`, 38, 66);
    ctx.letterSpacing = 'normal';
  }

  private drawArena(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const radius = 340;
    ctx.save();
    const globe = ctx.createRadialGradient(centerX - 105, centerY - 120, 20, centerX, centerY, radius * 1.12);
    globe.addColorStop(0, 'rgba(64, 44, 116, 0.82)');
    globe.addColorStop(0.52, 'rgba(24, 18, 57, 0.95)');
    globe.addColorStop(1, 'rgba(6, 6, 20, 0.98)');
    ctx.fillStyle = globe;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(112, 231, 255, 0.14)';
    ctx.lineWidth = 1;
    for (let index = -3; index <= 3; index += 1) {
      const offset = index * radius * 0.22;
      ctx.beginPath();
      ctx.ellipse(centerX + offset * 0.22, centerY, Math.max(18, Math.abs(offset) * 0.85), radius, 0, 0, TAU);
      ctx.stroke();
    }
    for (let index = -2; index <= 2; index += 1) {
      const offset = index * radius * 0.26;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + offset, radius, Math.max(12, radius * 0.16), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(224, 196, 255, 0.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(213, 255, 75, 0.16)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 18, -0.75, 0.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 111, 134, 0.12)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 36, 2.1, 4.5);
    ctx.stroke();
    ctx.restore();
    if (state.boss) this.drawBossTelegraph(ctx, state);
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, state: RenderState): void {
    for (const asteroid of state.asteroids) {
      if (asteroid.depth < -0.28) continue;
      ctx.save();
      ctx.globalAlpha = clamp(0.28 + asteroid.depth * 0.72, 0.18, 1);
      ctx.translate(asteroid.x, asteroid.y);
      ctx.rotate(asteroid.angle);
      ctx.strokeStyle = asteroid.color;
      ctx.fillStyle = `${asteroid.color}28`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let index = 0; index < 7; index += 1) {
        const angle = index * TAU / 7;
        const radius = asteroid.radius * (0.72 + ((index * 17) % 5) * 0.06);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCargo(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const cargo = state.cargo;
    if (!cargo) return;
    ctx.save();
    ctx.translate(cargo.x, cargo.y);
    ctx.rotate(state.elapsed * 0.7);
    ctx.strokeStyle = '#f0d36a';
    ctx.fillStyle = 'rgba(240, 211, 106, 0.16)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-18, -18, 36, 36);
    ctx.fillRect(-18, -18, 36, 36);
    ctx.restore();
    this.bar(ctx, cargo.x - 28, cargo.y - 32, 56, 5, cargo.health / cargo.maxHealth, '#f0d36a', '');
    ctx.fillStyle = '#f0d36a';
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(cargo.label, cargo.x + 24, cargo.y + 4);
  }

  private drawReward(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const reward = state.reward;
    if (!reward) return;
    ctx.save();
    ctx.translate(reward.x, reward.y);
    ctx.rotate(Math.sin(state.elapsed * 2) * 0.08);
    ctx.strokeStyle = reward.color;
    ctx.fillStyle = `${reward.color}30`;
    ctx.lineWidth = 4;
    ctx.fillRect(-26, -20, 52, 40);
    ctx.strokeRect(-26, -20, 52, 40);
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.lineTo(26, -2);
    ctx.stroke();
    ctx.restore();
    this.bar(ctx, reward.x - 40, reward.y - 42, 80, 6, reward.health / reward.maxHealth, reward.color, '');
    ctx.fillStyle = reward.color;
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(reward.label, reward.x + 34, reward.y + 4);
  }
  private drawBossTelegraph(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const boss = state.boss;
    if (!boss || boss.telegraph <= 0) return;
    const alpha = clamp(boss.telegraph / 0.9, 0.18, 0.85);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 111, 134, ${alpha})`;
    ctx.fillStyle = `rgba(255, 111, 134, ${alpha * 0.12})`;
    ctx.lineWidth = 4;
    if (boss.id === 'rail-warden') {
      for (let i = 0; i < 2; i += 1) {
        const angle = state.elapsed * 0.3 + i * Math.PI / 2;
        this.lineFromCenter(ctx, angle, 510);
      }
    } else if (boss.id === 'prism-leviathan') {
      for (let i = 0; i < 3; i += 1) {
        const angle = state.elapsed * 0.25 + i * (TAU / 3);
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y);
        ctx.arc(boss.x, boss.y, 520, angle - 0.26, angle + 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, 120 + (1 - alpha) * 280, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, 180 + (1 - alpha) * 220, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const player = state.player;
    const ship = getShip(state.ship);
    ctx.save();
    ctx.translate(player.position.x, player.position.y);
    ctx.rotate(player.aim + Math.PI / 2);
    if (player.invulnerable > 0) ctx.globalAlpha = 0.56 + Math.sin(state.elapsed * 35) * 0.25;
    ctx.fillStyle = `${ship.color}22`;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ship.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(17, 18);
    ctx.lineTo(0, 11);
    ctx.lineTo(-17, 18);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = ship.color;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(7, 11);
    ctx.lineTo(0, 6);
    ctx.lineTo(-7, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (player.charging > 0) {
      ctx.save();
      ctx.strokeStyle = '#f58dca';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, 30 + player.charging * 18, -Math.PI / 2, -Math.PI / 2 + player.charging / 1.2 * TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (player.decoy > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, player.decoy / 2.5);
      ctx.strokeStyle = '#e8c7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.position.x - Math.cos(player.aim) * 72, player.position.y - Math.sin(player.aim) * 72, 18, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (player.abilityDuration > 0 && state.ship === 'bulwark') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 155, 74, 0.8)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, 44, player.aim - 0.8, player.aim + 0.8);
      ctx.stroke();
      ctx.restore();
    }
    this.drawHud(ctx, state);
  }

  private drawHud(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const player = state.player;
    const x = 38;
    const y = 820;
    this.bar(ctx, x, y, 250, 10, player.hull / player.maxHull, '#ff6f86', `HULL ${Math.ceil(Math.max(0, player.hull))}/${player.maxHull}`);
    this.bar(ctx, x, y + 28, 250, 7, player.energy / player.maxEnergy, '#70e7ff', `ENERGY ${Math.ceil(player.energy)}`);
    const weapon = getWeapon(player.weapon ?? 'pulse');
    ctx.fillStyle = '#f2e9ff';
    ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`DUST ${state.runDust.toString().padStart(4, '0')}`, 1320, 46);
    ctx.fillText(`SCORE ${state.score.toString().padStart(6, '0')}`, 1320, 68);
    ctx.fillStyle = state.multiplier >= 3 ? '#f0d36a' : '#b8a7e2';
    ctx.fillText(`MULTI x${state.multiplier.toFixed(1)}`, 1320, 90);
    ctx.fillStyle = '#b8a7e2';
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`NODE ${Math.min(state.nodeIndex + 1, state.nodeTotal)}/${state.nodeTotal}`, 1320, 112);
    ctx.fillText(`HEAT ${state.heat}%`, 1320, 132);
    ctx.fillText('ESC PAUSE', 1320, 152);
    ctx.fillStyle = weapon.color;
    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`${weapon.name} // ${weapon.element.toUpperCase()}`, x, 875);
    ctx.fillStyle = '#d5ff4b';
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`DASH ${player.dashCooldown <= 0 ? 'READY' : `${player.dashCooldown.toFixed(1)}S`} · ${state.ship.toUpperCase()}`, x, 894);
    ctx.fillStyle = '#70e7ff';
    ctx.fillText(`ABILITY ${player.abilityCooldown <= 0 ? 'READY' : `${player.abilityCooldown.toFixed(1)}S`} · BOMBS ${player.bombs ?? 0} · SHIELDS ${player.shieldCharges ?? 0}`, x + 230, 894);
    ctx.fillStyle = '#f2e9ff';
    const build = state.boons.length > 0 ? state.boons.map((id) => getBoon(id).name).join(' / ') : 'EMPTY';
    ctx.fillText(`BUILD ${build}`.slice(0, 82), 430, 812);
    ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(state.status.slice(0, 74), 430, 838);
    if (state.boss) {
      const ratio = clamp(state.boss.hull / state.boss.maxHull, 0, 1);
      this.bar(ctx, 520, 92, 560, 12, ratio, '#ff6f86', `${state.boss.name} / PHASE ${state.boss.phase}`);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: RenderEnemy, elapsed: number): void {
    if (enemy.depth < -0.28) return;
    const definition = getEnemy(enemy.id);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.globalAlpha = clamp(0.3 + enemy.depth * 0.7, 0.2, 1) * (enemy.flash > 0 ? 0.62 : 1);
    ctx.strokeStyle = definition.color;
    ctx.fillStyle = `${definition.color}22`;
    ctx.lineWidth = enemy.elite ? 4 : 2;
    if (enemy.telegraph > 0) {
      ctx.strokeStyle = '#ff5d62';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(180, 0);
      ctx.stroke();
    }
    this.shape(ctx, definition.shape, enemy.radius);
    ctx.restore();
    if (enemy.elite) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 155, 74, ${0.5 + Math.sin(elapsed * 7) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (enemy.weakTo.length > 0) {
      const weakColor = enemy.element === 'plasma' ? '#ff8a5c' : enemy.element === 'cryo' ? '#70e7ff' : enemy.element === 'void' ? '#bd9aff' : '#f2e9ff';
      ctx.fillStyle = weakColor;
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.radius + 5, enemy.y - enemy.radius - 5, 3, 0, TAU);
      ctx.fill();
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, state: RenderState): void {
    const boss = state.boss;
    if (!boss || boss.depth < -0.28) return;
    const definition = getBoss(boss.id);
    ctx.save();
    ctx.globalAlpha = clamp(0.3 + boss.depth * 0.7, 0.25, 1);
    ctx.translate(boss.x, boss.y);
    ctx.rotate(state.elapsed * 0.16);
    ctx.strokeStyle = boss.phase === 3 ? '#ff6f86' : '#e8c7ff';
    ctx.fillStyle = boss.phase === 2 ? 'rgba(112, 231, 255, 0.14)' : 'rgba(232, 199, 255, 0.1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -boss.radius * 0.72);
      ctx.lineTo(17, -boss.radius - 54 - boss.phase * 7);
      ctx.lineTo(-17, -boss.radius - 54 - boss.phase * 7);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = definition.id === 'null-crown' ? '#ff6f86' : '#d5ff4b';
    ctx.beginPath();
    ctx.arc(0, 0, 28 + boss.phase * 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  private drawProjectiles(ctx: CanvasRenderingContext2D, state: RenderState): void {
    for (const projectile of state.projectiles) {
      if (projectile.depth < -0.22) continue;
      ctx.save();
      ctx.strokeStyle = projectile.color;
      ctx.fillStyle = projectile.color;
      ctx.globalAlpha = clamp(projectile.life * 2, 0.28, 1) * clamp(0.35 + projectile.depth * 0.65, 0.25, 1);
      ctx.lineWidth = projectile.friendly ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(projectile.x - projectile.vx * 0.022, projectile.y - projectile.vy * 0.022);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius + (projectile.friendly ? 1 : 0), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  private drawPickups(ctx: CanvasRenderingContext2D, state: RenderState): void {
    for (const pickup of state.pickups) {
      if (pickup.depth < -0.25) continue;
      const color = pickup.kind === 'dust' || pickup.kind === 'score' ? '#f0d36a' : pickup.kind === 'energy' || pickup.kind === 'shield' ? '#70e7ff' : pickup.kind === 'bomb' ? '#ff9b4a' : '#a6ff65';
      ctx.save();
      ctx.globalAlpha = clamp(0.3 + pickup.depth * 0.7, 0.24, 1);
      ctx.strokeStyle = color;
      ctx.fillStyle = `${color}33`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 8 + Math.sin(state.elapsed * 5 + pickup.x) * 2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2e9ff';
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(pickup.label ?? `+${pickup.amount}`, pickup.x + 12, pickup.y + 4);
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, state: RenderState): void {
    for (const particle of state.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1) * (state.reducedMotion ? 0.55 : 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createRadialGradient(800, 450, 280, 800, 450, 780);
    gradient.addColorStop(0, 'rgba(8, 7, 22, 0)');
    gradient.addColorStop(1, 'rgba(5, 4, 16, 0.58)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  private shape(ctx: CanvasRenderingContext2D, shape: RenderEnemy['id'] extends never ? never : 'diamond' | 'orb' | 'triangle' | 'mine' | 'hex' | 'split' | 'wedge' | 'harvest' | 'rift' | 'shield', radius: number): void {
    ctx.beginPath();
    if (shape === 'orb') ctx.arc(0, 0, radius, 0, TAU);
    else if (shape === 'diamond') {
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
    } else if (shape === 'triangle') {
      ctx.moveTo(radius, 0);
      ctx.lineTo(-radius * 0.7, radius * 0.75);
      ctx.lineTo(-radius * 0.7, -radius * 0.75);
      ctx.closePath();
    } else if (shape === 'mine') {
      ctx.arc(0, 0, radius * 0.72, 0, TAU);
      ctx.moveTo(-radius, 0);
      ctx.lineTo(radius, 0);
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, radius);
    } else if (shape === 'wedge') {
      ctx.moveTo(radius, 0);
      ctx.arc(0, 0, radius, -0.65, 0.65);
      ctx.closePath();
    } else if (shape === 'split') {
      ctx.arc(-radius * 0.35, 0, radius * 0.65, 0, TAU);
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius);
      ctx.closePath();
    } else if (shape === 'shield') {
      ctx.arc(0, 0, radius, -1.05, 1.05);
      ctx.lineTo(0, 0);
      ctx.closePath();
    } else {
      for (let i = 0; i < 6; i += 1) {
        const angle = i * TAU / 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  private bar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, ratio: number, color: string, label: string): void {
    ctx.fillStyle = 'rgba(232, 199, 255, 0.12)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * clamp(ratio, 0, 1), height);
    ctx.fillStyle = '#f2e9ff';
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(label, x, y - 8);
  }

  private lineFromCenter(ctx: CanvasRenderingContext2D, angle: number, length: number): void {
    ctx.beginPath();
    ctx.moveTo(LOGICAL_WIDTH / 2 - Math.cos(angle) * length, LOGICAL_HEIGHT / 2 - Math.sin(angle) * length);
    ctx.lineTo(LOGICAL_WIDTH / 2 + Math.cos(angle) * length, LOGICAL_HEIGHT / 2 + Math.sin(angle) * length);
    ctx.stroke();
  }

}
