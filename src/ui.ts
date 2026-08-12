import { BOONS, BOSSES, HEATS, META, ROUTES, SECTORS, SHIPS, TRANSMISSIONS } from './content';
import type { GameIntent, GameView, HeatId, NodeKind, SalvageChoice, Screen, SettingsData, ShipId } from './types';

export interface UiCallbacks {
  onIntent: (intent: GameIntent) => void;
}

const SCREEN_LABELS: Record<Exclude<Screen, 'game'>, string> = {
  title: 'TITLE',
  hangar: 'HANGAR',
  core: 'CORE',
  shipyard: 'SHIPYARD',
  archive: 'ARCHIVE',
  settings: 'SETTINGS',
  route: 'ROUTE',
  salvage: 'SALVAGE',
  boon: 'BOON',
  market: 'MARKET',
  pause: 'PAUSE',
  report: 'REPORT',
};

export class GameUI {
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLElement;
  private readonly live: HTMLElement;
  private readonly callbacks: UiCallbacks;
  private screen: Screen = 'title';
  private choices: string[] = [];
  private lastSignature = '';

  public constructor(root: HTMLElement, callbacks: UiCallbacks) {
    this.callbacks = callbacks;
    root.innerHTML = `
      <div class="game-shell">
        <div class="canvas-wrap">
          <canvas class="game-canvas" aria-label="Super Roguedust arena"></canvas>
          <div class="scanlines" aria-hidden="true"></div>
        </div>
        <div class="screen-overlay" role="dialog" aria-modal="false"></div>
        <div class="live-region" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;
    const canvas = root.querySelector<HTMLCanvasElement>('.game-canvas');
    const overlay = root.querySelector<HTMLElement>('.screen-overlay');
    const live = root.querySelector<HTMLElement>('.live-region');
    if (!canvas || !overlay || !live) throw new Error('Game shell failed to mount');
    this.canvas = canvas;
    this.overlay = overlay;
    this.live = live;
    overlay.addEventListener('click', this.handleClick);
    overlay.addEventListener('input', this.handleInput);
    overlay.addEventListener('change', this.handleInput);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setScreen(screen: Screen, choices: string[] = []): void {
    this.screen = screen;
    this.choices = choices;
    this.lastSignature = '';
  }

  public showRoute(choices: NodeKind[]): void {
    this.setScreen('route', choices);
  }

  public showSalvage(): void {
    this.setScreen('salvage');
  }

  public showBoons(choices: string[]): void {
    this.setScreen('boon', choices);
  }

  public showMarket(choices: string[]): void {
    this.setScreen('market', choices);
  }

  public showReport(): void {
    this.setScreen('report');
  }

  public update(view: GameView): void {
    const signature = `${this.screen}|${view.render.phase}|${view.render.sector}|${view.render.nodeIndex}|${view.render.runDust}|${view.render.status}|${view.save.dust}|${view.save.selectedShip}|${view.save.lastRun?.dust ?? 0}|${view.save.meta['hull-matrix']}|${view.save.threatModifiers.join(',')}|${this.choices.join(',')}`;
    this.live.textContent = view.render.status;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.overlay.classList.toggle('is-hidden', this.screen === 'game');
    this.overlay.setAttribute('aria-hidden', this.screen === 'game' ? 'true' : 'false');
    if (this.screen === 'game') {
      this.overlay.innerHTML = '';
      return;
    }
    this.overlay.innerHTML = this.renderScreen(view);
    const heading = this.overlay.querySelector<HTMLElement>('h1, h2');
    if (heading) heading.focus({ preventScroll: true });
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const element = target.closest<HTMLElement>('[data-intent], [data-screen]');
    if (!element) return;
    if (element instanceof HTMLInputElement && element.dataset.intent === 'toggle-heat') return;
    if (element.dataset.screen) {
      this.callbacks.onIntent({ type: 'select-screen', screen: element.dataset.screen as Screen });
      return;
    }
    const intent = element.dataset.intent;
    if (!intent) return;
    if (intent === 'launch') this.callbacks.onIntent({ type: 'launch' });
    else if (intent === 'restart') this.callbacks.onIntent({ type: 'restart' });
    else if (intent === 'reset-save') this.callbacks.onIntent({ type: 'reset-save' });
    else if (intent === 'route' && element.dataset.kind) this.callbacks.onIntent({ type: 'choose-route', kind: element.dataset.kind as NodeKind });
    else if (intent === 'salvage' && element.dataset.choice) this.callbacks.onIntent({ type: 'choose-salvage', choice: element.dataset.choice as SalvageChoice });
    else if (intent === 'boon' && element.dataset.boon) this.callbacks.onIntent({ type: 'choose-boon', boon: element.dataset.boon as GameIntent['boon'] });
    else if (intent === 'market' && element.dataset.boon) this.callbacks.onIntent({ type: 'purchase-market', boon: element.dataset.boon as GameIntent['boon'] });
    else if (intent === 'leave-market') this.callbacks.onIntent({ type: 'leave-market' });
    else if (intent === 'buy-meta' && element.dataset.meta) this.callbacks.onIntent({ type: 'buy-meta', meta: element.dataset.meta as GameIntent['meta'] });
    else if (intent === 'select-ship' && element.dataset.ship) this.callbacks.onIntent({ type: 'select-ship', ship: element.dataset.ship as ShipId });
    else if (intent === 'toggle-heat' && element.dataset.heat) this.callbacks.onIntent({ type: 'toggle-heat', heat: element.dataset.heat as HeatId });
    else if (intent === 'pause') this.callbacks.onIntent({ type: 'pause' });
    else if (intent === 'resume') this.callbacks.onIntent({ type: 'resume' });
  };

  private readonly handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target instanceof HTMLInputElement && target.dataset.intent === 'toggle-heat' && target.dataset.heat) {
      this.callbacks.onIntent({ type: 'toggle-heat', heat: target.dataset.heat as HeatId });
      return;
    }
    const key = target.dataset.setting as keyof SettingsData | undefined;
    if (!key) return;
    const value: boolean | number | SettingsData['quality'] = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target instanceof HTMLSelectElement ? target.value as SettingsData['quality'] : Number(target.value);
    this.callbacks.onIntent({ type: 'setting', key, value });
  };


  private renderScreen(view: GameView): string {
    if (this.screen === 'title') return this.renderTitle(view);
    if (this.screen === 'hangar') return this.renderHangar(view);
    if (this.screen === 'core') return this.renderCore(view);
    if (this.screen === 'shipyard') return this.renderShipyard(view);
    if (this.screen === 'archive') return this.renderArchive(view);
    if (this.screen === 'settings') return this.renderSettings(view);
    if (this.screen === 'route') return this.renderRoute(view);
    if (this.screen === 'salvage') return this.renderSalvage(view);
    if (this.screen === 'boon') return this.renderBoons(view);
    if (this.screen === 'market') return this.renderMarket(view);
    if (this.screen === 'pause') return this.renderPause(view);
    return this.renderReport(view);
  }

  private renderTitle(view: GameView): string {
    return `<section class="title-screen screen-panel">
      <div class="eyebrow">PERSONAL SALVAGE PILOT // SIGNAL LOCKED</div>
      <h1 tabindex="-1"><span>SUPER</span> ROGUEDUST</h1>
      <p class="tagline">DIE LOUD. FLY FURTHER.</p>
      <div class="title-grid">
        <div class="title-signal"><span class="signal-dot"></span><span>RING STATUS: UNSTABLE</span><span>SECTOR ACCESS: ${view.save.highestSector}/5</span></div>
        <div class="starter-card"><strong>VANGUARD</strong><span>Balanced pulse cannon / repulsor burst</span><span>100 HULL · 100% VECTOR · READY</span></div>
      </div>
      <button class="button button-primary button-launch" data-intent="launch">LAUNCH <span>↗</span></button>
      <p class="microcopy">WASD / ARROWS MOVE · MOUSE AIM · HOLD LMB FIRE · E ABILITY · SPACE DASH</p>
      ${view.save.recoveryNotice ? `<p class="notice notice-warn">${escapeHTML(view.save.recoveryNotice)}</p>` : ''}
    </section>`;
  }

  private renderHangar(view: GameView): string {
    const ship = SHIPS.find((candidate) => candidate.id === view.save.selectedShip) ?? SHIPS[0];
    return `<section class="hangar-screen screen-panel wide-panel">
      ${this.renderHeader(view, 'HANGAR // RETURN VECTOR')}
      <div class="hangar-grid">
        <div class="hangar-hero">
          <div class="eyebrow">CURRENT VESSEL</div><h1 tabindex="-1">${ship.name}</h1>
          <p>${ship.tagline}</p>
          <div class="ship-readout"><span><b>${ship.maxHull + view.save.meta['hull-matrix'] * 10}</b> HULL</span><span><b>${Math.round(ship.speed * (1 + view.save.meta['vector-coils'] * 0.06) * 100)}%</b> SPEED</span><span><b>${ship.abilityName}</b> ABILITY</span></div>
          <button class="button button-primary" data-intent="launch">LAUNCH AGAIN <span>↗</span></button>
        </div>
        <div class="hangar-report">
          <div class="dust-count"><span>DUST</span><strong>${view.save.dust.toLocaleString()}</strong></div>
          <div class="stat-list"><span>HIGHEST SECTOR <b>${view.save.highestSector}/5</b></span><span>TOTAL KILLS <b>${view.save.totalKills.toLocaleString()}</b></span><span>DEFEATED BOSSES <b>${view.save.defeatedBosses.length}/5</b></span></div>
          ${view.save.lastRun ? `<div class="last-run"><span>LAST EXPEDITION</span><b>${view.save.lastRun.reason === 'victory' ? 'VICTORY' : 'DUST RECOVERED'}</b><span>+${view.save.lastRun.dust} DUST · SECTOR ${view.save.lastRun.sector}</span></div>` : '<div class="last-run"><span>NO FLIGHT RECORD</span><b>THE RING IS WAITING</b></div>'}
          ${view.save.recoveryNotice ? `<p class="notice notice-warn">${escapeHTML(view.save.recoveryNotice)}</p>` : ''}
        </div>
      </div>
      ${this.renderNav('hangar', view.save.threatUnlocked)}
    </section>`;
  }

  private renderCore(view: GameView): string {
    return `<section class="screen-panel wide-panel"><div class="screen-scroll">${this.renderHeader(view, 'CORE // PERMANENT SYSTEMS')}
      <p class="section-lede">Dust survives every impact. Invest in the parts of the ship that should outlive you.</p>
      <div class="card-grid meta-grid">${META.map((meta) => {
        const level = view.save.meta[meta.id];
        const maxed = level >= meta.costs.length;
        const cost = meta.costs[level];
        const canBuy = !maxed && view.save.dust >= cost;
        return `<article class="info-card meta-card"><div class="card-top"><span class="eyebrow">LEVEL ${level}/${meta.costs.length}</span><span class="chip ${canBuy ? 'chip-live' : ''}">${maxed ? 'MAXED' : `${cost} DUST`}</span></div><h2>${meta.name}</h2><p>${meta.description}</p><div class="value-row"><span>${meta.valueAtLevel(level)}</span><b>→ ${maxed ? 'FULL OUTPUT' : meta.nextValue(level)}</b></div><button class="button ${canBuy ? 'button-primary' : ''}" data-intent="buy-meta" data-meta="${meta.id}" ${canBuy ? '' : 'disabled'}>${maxed ? 'SYSTEM MAXED' : canBuy ? `BUY LEVEL ${level + 1}` : 'INSUFFICIENT DUST'}</button></article>`;
      }).join('')}</div>${this.renderNav('core', view.save.threatUnlocked)}</div></section>`;
  }

  private renderShipyard(view: GameView): string {
    return `<section class="screen-panel wide-panel"><div class="screen-scroll">${this.renderHeader(view, 'SHIPYARD // BLUEPRINTS')}
      <p class="section-lede">No universal upgrades. Pick the silhouette that makes your mistakes interesting.</p>
      <div class="card-grid ship-grid">${SHIPS.map((ship) => {
        const unlocked = view.save.unlockedShips.includes(ship.id);
        const selected = view.save.selectedShip === ship.id;
        const affordable = view.save.dust >= ship.cost;
        const requirementMet = ship.id === 'vanguard' || ship.id === 'bulwark' && view.save.defeatedBosses.includes('grinder') || ship.id === 'needle' && view.save.totalKills >= 100 || ship.id === 'mirage' && view.save.defeatedBosses.includes('rail-warden') || ship.id === 'nova' && view.save.defeatedBosses.includes('null-crown');
        const available = unlocked || (requirementMet && affordable);
        return `<article class="info-card ship-card ${selected ? 'is-selected' : ''} ${!available ? 'is-locked' : ''}"><div class="ship-glyph" style="--ship-color:${ship.color}"><span></span></div><div class="card-top"><span class="eyebrow">${selected ? 'ACTIVE' : unlocked ? 'UNLOCKED' : 'LOCKED'}</span><span class="chip">${ship.cost ? `${ship.cost} DUST` : 'STARTER'}</span></div><h2>${ship.name}</h2><p>${ship.tagline}</p><div class="ship-specs"><span>${ship.maxHull} HULL</span><span>${Math.round(ship.speed * 100)}% SPEED</span><span>${ship.abilityName}</span></div><p class="microcopy">${ship.abilityDescription}</p><p class="prereq">${unlocked ? 'BLUEPRINT READY' : ship.prerequisite}</p><button class="button ${available ? 'button-primary' : ''}" data-intent="select-ship" data-ship="${ship.id}" ${available ? '' : 'disabled'}>${selected ? 'SELECTED' : unlocked ? 'SELECT' : requirementMet ? 'BUY BLUEPRINT' : 'LOCKED'}</button></article>`;
      }).join('')}</div>${this.renderNav('shipyard', view.save.threatUnlocked)}</div></section>`;
  }

  private renderArchive(view: GameView): string {
    return `<section class="screen-panel wide-panel"><div class="screen-scroll">${this.renderHeader(view, 'ARCHIVE // SIGNAL LOG')}
      <div class="archive-section"><div class="eyebrow">SECTOR RECORDS</div><div class="archive-list">${SECTORS.map((sector) => this.archiveRow(view.save.discovered.includes(sector.id), sector.name, sector.unlock, `SECTOR ${sector.number}`)).join('')}</div></div>
      <div class="archive-section"><div class="eyebrow">BOSS RECORDS</div><div class="archive-list">${BOSSES.map((boss) => this.archiveRow(view.save.defeatedBosses.includes(boss.id), boss.name, `DEFEAT ${boss.name}`, `${boss.reward} DUST`)).join('')}</div></div>
      <div class="archive-section"><div class="eyebrow">BOON CATALOG</div><div class="archive-list">${BOONS.map((boon) => this.archiveRow(view.save.discovered.includes(boon.id), boon.name, boon.discovery, boon.short)).join('')}</div></div>
      <div class="archive-section"><div class="eyebrow">TRANSMISSIONS</div><div class="transmission-grid">${TRANSMISSIONS.map((entry) => `<article class="transmission ${view.save.transmissions.includes(entry.id) ? 'is-found' : ''}"><span>${view.save.transmissions.includes(entry.id) ? entry.title : 'SIGNAL / UNKNOWN'}</span><p>${view.save.transmissions.includes(entry.id) ? entry.body : entry.condition}</p></article>`).join('')}</div></div>
      ${view.save.threatUnlocked ? `<div class="archive-section"><div class="eyebrow">THREAT PROTOCOL // SELECTABLE</div><div class="heat-grid">${HEATS.map((heat) => `<label class="heat-toggle"><input type="checkbox" data-intent="toggle-heat" data-heat="${heat.id}" ${view.save.threatModifiers.includes(heat.id) ? 'checked' : ''}><span><b>${heat.name}</b><small>${heat.effect} · +${Math.round(heat.payout * 100)}% PAYOUT</small></span></label>`).join('')}</div></div>` : ''}
      ${this.renderNav('archive', view.save.threatUnlocked)}</div></section>`;
  }

  private renderSettings(view: GameView): string {
    const settings = view.save.settings;
    return `<section class="screen-panel narrow-panel">${this.renderHeader(view, 'SETTINGS // FLIGHT DECK')}
      <div class="settings-list"><label class="setting-row"><span>MUSIC <small>${Math.round(settings.music * 100)}%</small></span><input type="range" min="0" max="1" step="0.01" value="${settings.music}" data-setting="music"></label><label class="setting-row"><span>SFX <small>${Math.round(settings.sfx * 100)}%</small></span><input type="range" min="0" max="1" step="0.01" value="${settings.sfx}" data-setting="sfx"></label><label class="setting-row"><span>MASTER <small>${Math.round(settings.master * 100)}%</small></span><input type="range" min="0" max="1" step="0.01" value="${settings.master}" data-setting="master"></label><label class="setting-row"><span>REDUCED MOTION <small>${settings.reducedMotion ? 'ON' : 'OFF'}</small></span><input type="checkbox" ${settings.reducedMotion ? 'checked' : ''} data-setting="reducedMotion"></label><label class="setting-row"><span>VISUAL QUALITY <small>${settings.quality.toUpperCase()}</small></span><select data-setting="quality"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>HIGH</option><option value="balanced" ${settings.quality === 'balanced' ? 'selected' : ''}>BALANCED</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>LOW</option></select></label></div>
      <p class="notice ${settings.audioUnavailable ? 'notice-warn' : 'notice-live'}">${settings.audioUnavailable ? 'SILENT MODE — AUDIO CONTEXT UNAVAILABLE' : 'AUDIO BUS READY — FIRST LAUNCH UNLOCKS SOUND'}</p><button class="button button-danger" data-intent="reset-save">WIPE PROFILE</button>${this.renderNav('settings', view.save.threatUnlocked)}</section>`;
  }

  private renderRoute(view: GameView): string {
    const routes = this.choices.map((kind) => ROUTES.find((route) => route.kind === kind)).filter((route): route is typeof ROUTES[number] => Boolean(route));
    return `<section class="screen-panel route-panel"><div class="route-head"><div><div class="eyebrow">SECTOR ${view.render.sector} / NODE ${view.render.nodeIndex + 1} OF ${view.render.nodeTotal}</div><h1 tabindex="-1">${view.render.sectorName}</h1></div><div class="route-dust"><span>RUN DUST</span><b>${view.render.runDust}</b></div></div><p class="section-lede">Choose the pressure you can survive. The ring remembers your route.</p><div class="route-grid">${routes.map((route) => `<button class="route-card" data-intent="route" data-kind="${route.kind}" style="--route-color:${route.color}"><span class="route-kind">${route.name}</span><strong>${route.risk}</strong><span>${route.description}</span><small>PROJECTED ${route.reward}</small></button>`).join('')}</div><p class="microcopy">ROUTES ARE SEEDED FOR THIS RUN · THREE NODES OPEN THE BOSS GATE</p></section>`;
  }

  private renderSalvage(view: GameView): string {
    return `<section class="screen-panel choice-panel"><div class="eyebrow">SALVAGE POCKET // SECTOR ${view.render.sector}</div><h1 tabindex="-1">TAKE YOUR CUT</h1><p class="section-lede">No combat. One choice. The pressure resumes after you leave.</p><div class="choice-grid">${this.choiceButton('patch', 'PATCH', '+24 HULL', view.render.player.hull >= view.render.player.maxHull || view.save.threatModifiers.includes('scarcity') ? 'UNAVAILABLE' : 'RESTORE HULL')}${this.choiceButton('cache', 'CACHE', '+60 DUST', 'BANK THE EASY SIGNAL')}${this.choiceButton('charge', 'CHARGE', '+35 ENERGY', 'REFILL ABILITY POWER')}</div></section>`;
  }

  private renderBoons(view: GameView): string {
    const boons = this.choices.map((id) => BOONS.find((boon) => boon.id === id)).filter((boon): boon is typeof BOONS[number] => Boolean(boon));
    return `<section class="screen-panel choice-panel"><div class="eyebrow">SIGNAL ACQUISITION // SLOT ${view.render.nodeIndex + 1}</div><h1 tabindex="-1">CHOOSE A BOON</h1><p class="section-lede">Three slots. One decision. Current Dust: <b>${view.render.runDust}</b>.</p><div class="boon-grid">${boons.map((boon) => `<button class="boon-card" data-intent="boon" data-boon="${boon.id}" style="--boon-color:${boon.color}"><span class="route-kind">${boon.name}</span><strong>${boon.short}</strong><span>${boon.description}</span></button>`).join('')}</div><p class="microcopy">${view.render.nodeIndex >= 0 ? `SLOTS OCCUPIED ${view.render.nodeIndex > 0 ? '· BUILD IS LIVE' : ''}` : ''}</p></section>`;
  }

  private renderMarket(view: GameView): string {
    const boons = this.choices.map((id) => BOONS.find((boon) => boon.id === id)).filter((boon): boon is typeof BOONS[number] => Boolean(boon));
    return `<section class="screen-panel choice-panel"><div class="eyebrow">BLACK MARKET // RUN DUST ${view.render.runDust}</div><h1 tabindex="-1">BUY OR WALK</h1><p class="section-lede">Each signal costs <b>80 DUST</b>. Leaving keeps your reserve.</p><div class="boon-grid">${boons.map((boon) => `<button class="boon-card" data-intent="market" data-boon="${boon.id}" style="--boon-color:${boon.color}" ${view.render.runDust < 80 ? 'disabled' : ''}><span class="route-kind">${boon.name}</span><strong>80 DUST</strong><span>${boon.description}</span></button>`).join('')}</div><button class="button" data-intent="leave-market">LEAVE MARKET</button></section>`;
  }

  private renderPause(view: GameView): string {
    return `<section class="screen-panel pause-panel"><div class="eyebrow">FLIGHT COMPUTER / HOLD</div><h1 tabindex="-1">PAUSED</h1><p>${escapeHTML(view.render.status)}</p><button class="button button-primary" data-intent="resume">RESUME FLIGHT</button><button class="button" data-screen="settings">SETTINGS</button></section>`;
  }

  private renderReport(view: GameView): string {
    const run = view.save.lastRun;
    if (!run) return this.renderHangar(view);
    return `<section class="screen-panel report-panel"><div class="eyebrow">EXPEDITION REPORT // ${run.reason === 'victory' ? 'SIGNAL STABLE' : 'HULL LOST'}</div><h1 tabindex="-1">${run.reason === 'victory' ? 'THE RING BENDS' : 'DUST SURVIVES'}</h1><div class="report-dust"><span>DUST RECOVERED</span><strong>+${run.dust}</strong></div><div class="report-grid"><span>REACHED SECTOR <b>${run.sector}/5</b></span><span>HOSTILES BROKEN <b>${run.kills}</b></span><span>BUILD RESET <b>YES</b></span><span>SHIP <b>${run.ship.toUpperCase()}</b></span></div><p class="section-lede">Your temporary build is gone. Your Dust, records, discoveries, and blueprint progress remain.</p><button class="button button-primary" data-intent="restart">LAUNCH AGAIN <span>↗</span></button><button class="button" data-screen="hangar">RETURN TO HANGAR</button></section>`;
  }

  private renderHeader(view: GameView, title: string): string {
    return `<header class="panel-header"><div><div class="eyebrow">SUPER ROGUEDUST // ${view.save.selectedShip.toUpperCase()}</div><h1 tabindex="-1">${title}</h1></div><div class="header-dust"><span>DUST</span><b>${view.save.dust.toLocaleString()}</b></div></header>`;
  }

  private renderNav(active: Exclude<Screen, 'game'>, threatUnlocked: boolean): string {
    const screens: Exclude<Screen, 'game'>[] = ['hangar', 'core', 'shipyard', 'archive', 'settings'];
    return `<nav class="screen-nav" aria-label="Hangar navigation">${screens.map((screen) => `<button class="nav-button ${active === screen ? 'is-active' : ''}" data-screen="${screen}">${SCREEN_LABELS[screen]}</button>`).join('')}${threatUnlocked ? '<span class="nav-signal">THREAT PROTOCOL ONLINE</span>' : ''}</nav>`;
  }

  private archiveRow(found: boolean, title: string, condition: string, detail: string): string {
    return `<div class="archive-row ${found ? 'is-found' : ''}"><span class="archive-status">${found ? 'DISCOVERED' : 'UNKNOWN'}</span><b>${found ? title : '//// / UNKNOWN'}</b><span>${found ? detail : condition}</span></div>`;
  }

  private choiceButton(choice: SalvageChoice, title: string, value: string, detail: string): string {
    return `<button class="choice-card" data-intent="salvage" data-choice="${choice}"><span class="route-kind">${title}</span><strong>${value}</strong><span>${detail}</span></button>`;
  }
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
