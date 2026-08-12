import './styles.css';
import { AudioEngine } from './audio';
import { getShip, META, SHIPS } from './content';
import { InputController } from './input';
import { CanvasRenderer } from './render';
import { createDefaultSave, loadSave, persistSave, resetSave } from './persistence';
import { GameSimulation } from './simulation';
import type { GameEvent, GameIntent, HeatId, MetaId, SaveData, Screen } from './types';
import { FIXED_DT } from './types';
import { GameUI } from './ui';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App mount missing');

const storage = getStorage();
const save = loadSave(storage);
const input = new InputController();
const audio = new AudioEngine(save.settings);
let simulation: GameSimulation;
let hiddenPaused = false;
let persistTimer: number | null = null;

const ui = new GameUI(root, { onIntent: handleIntent });
const renderer = new CanvasRenderer(ui.getCanvas());
input.attach(ui.getCanvas());

simulation = new GameSimulation(save, { onEvent: handleEvent });
ui.setScreen('title');
ui.update({ save, render: simulation.getRenderState() });
input.setActive(false);

let previousTimestamp = performance.now();
let accumulator = 0;
let lastUiRender = 0;

function frame(timestamp: number): void {
  const elapsed = Math.min(0.1, Math.max(0, (timestamp - previousTimestamp) / 1000));
  previousTimestamp = timestamp;
  if (!document.hidden) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 6) {
      simulation.step(input.snapshot(), FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
    }
  }
  const render = simulation.getRenderState();
  renderer.setQuality(save.settings.quality);
  renderer.render(render);
  if (timestamp - lastUiRender > 80 || render.phase === 'route' || render.phase === 'boon' || render.phase === 'salvage' || render.phase === 'market') {
    ui.update({ save, render });
    lastUiRender = timestamp;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (simulation.getPhase() === 'combat' || simulation.getPhase() === 'boss') {
      simulation.pause();
      hiddenPaused = true;
    }
    audio.suspend();
    persistNow();
    accumulator = 0;
    return;
  }
  previousTimestamp = performance.now();
  accumulator = 0;
  if (hiddenPaused) {
    simulation.pause();
    hiddenPaused = false;
  }
  void audio.resume();
});

window.addEventListener('pagehide', persistNow);

function handleEvent(event: GameEvent): void {
  if (event.type === 'shot') audio.playSfx('shot', event.intensity);
  if (event.type === 'dash') audio.playSfx('dash', event.intensity);
  if (event.type === 'ability') audio.playSfx('ability', event.intensity);
  if (event.type === 'hit') audio.playSfx('hit', event.intensity);
  if (event.type === 'pickup') audio.playSfx('pickup', event.intensity);
  if (event.type === 'bossPhase') {
    audio.playSfx('bossPhase', 1);
    audio.setMusicMode('boss');
  }
  if (event.type === 'bossDefeated') {
    audio.playSfx('victory', 1);
    audio.setMusicMode('sector');
    applyBossUnlocks(event.boss);
    persistSoon();
  }
  if (event.type === 'feat') {
    if (!save.feats.includes(event.id)) save.feats.push(event.id);
    if (event.id === 'clean-circuit' && !save.discovered.includes('echo-chamber')) save.discovered.push('echo-chamber');
    if (event.id === 'no-burn-victory' && !save.discovered.includes('null-shell')) save.discovered.push('null-shell');
    persistSoon();
  }
  if (event.type === 'routeReady') {
    ui.showRoute(event.choices);
    input.setActive(false);
  }
  if (event.type === 'salvageReady') {
    ui.showSalvage();
    input.setActive(false);
  }
  if (event.type === 'boonReady') {
    ui.showBoons(event.choices);
    input.setActive(false);
  }
  if (event.type === 'marketReady') {
    ui.showMarket(event.choices);
    input.setActive(false);
  }
  if (event.type === 'runEnded') {
    save.dust += event.summary.dust;
    save.totalKills += event.summary.kills;
    save.highestSector = Math.max(save.highestSector, event.summary.sector);
    save.lastRun = event.summary;
    persistNow();
    audio.playSfx(event.summary.reason === 'victory' ? 'victory' : 'death', 1);
    audio.setMusicMode('quiet');
    ui.showReport();
    input.setActive(false);
  }
  if (event.type === 'message') {
    const phase = simulation.getPhase();
    if (phase === 'paused') {
      ui.setScreen('pause');
      input.setActive(false);
    } else if (phase === 'combat' || phase === 'boss') {
      ui.setScreen('game');
      input.setActive(true);
    }
    ui.update({ save, render: simulation.getRenderState() });
  }
}

function applyBossUnlocks(boss: Extract<GameEvent, { type: 'bossDefeated' }>['boss']): void {
  if (!save.defeatedBosses.includes(boss)) save.defeatedBosses.push(boss);
  const discoveryByBoss: Record<typeof boss, string[]> = {
    grinder: ['ion-gardens', 'prism-rounds', 'rift-step', 'bulwark'],
    'rail-warden': ['blooming-void', 'drone-pact', 'lancer', 'splitter', 'prism'],
    'bloom-mother': ['glass-trench', 'afterimage', 'null-shell', 'harvester', 'riftling', 'sentinel'],
    'prism-leviathan': ['null-crown', 'echo', 'black-market'],
    'null-crown': ['threat-protocol', 'final-transmission'],
  };
  for (const id of discoveryByBoss[boss]) if (!save.discovered.includes(id)) save.discovered.push(id);
  const defeatedCount = save.defeatedBosses.length;
  save.highestSector = Math.max(save.highestSector, Math.min(5, defeatedCount + 1));
  if (boss === 'null-crown') {
    save.threatUnlocked = true;
    save.transmissions.push(...['transmission-5', 'transmission-6'].filter((id) => !save.transmissions.includes(id)));
  } else {
    const transmission = `transmission-${save.defeatedBosses.indexOf(boss) + 1}`;
    if (!save.transmissions.includes(transmission)) save.transmissions.push(transmission);
  }
}

function handleIntent(intent: GameIntent): void {
  if (intent.type === 'launch' || intent.type === 'restart') {
    void launchRun();
    return;
  }
  if (intent.type === 'select-screen' && intent.screen) {
    const allowedScreens: Screen[] = ['hangar', 'core', 'shipyard', 'archive', 'settings'];
    if (allowedScreens.includes(intent.screen) && (simulation.getPhase() === 'idle' || simulation.getPhase() === 'dead' || simulation.getPhase() === 'victory')) {
      ui.setScreen(intent.screen);
      input.setActive(false);
    }
    if (intent.screen === 'settings' && simulation.getPhase() === 'paused') ui.setScreen('settings');
    return;
  }
  if (intent.type === 'choose-route' && intent.kind) {
    simulation.chooseRoute(intent.kind);
    const phase = simulation.getPhase();
    if (phase === 'combat' || phase === 'boss') {
      ui.setScreen('game');
      input.setActive(true);
      audio.setMusicMode(phase === 'boss' ? 'boss' : 'sector');
    }
    return;
  }
  if (intent.type === 'choose-salvage' && intent.choice) {
    simulation.chooseSalvage(intent.choice);
    return;
  }
  if (intent.type === 'choose-boon' && intent.boon) {
    simulation.chooseBoon(intent.boon);
    return;
  }
  if (intent.type === 'purchase-market' && intent.boon) {
    simulation.purchaseMarket(intent.boon);
    return;
  }
  if (intent.type === 'leave-market') {
    simulation.leaveMarket();
    return;
  }
  if (intent.type === 'buy-meta' && intent.meta) buyMeta(intent.meta);
  if (intent.type === 'select-ship' && intent.ship) selectShip(intent.ship);
  if (intent.type === 'toggle-heat' && intent.heat) toggleHeat(intent.heat);
  if (intent.type === 'pause' || intent.type === 'resume') {
    simulation.pause();
    if (simulation.getPhase() === 'paused') {
      ui.setScreen('pause');
      input.setActive(false);
    } else {
      ui.setScreen('game');
      input.setActive(true);
    }
  }
  if (intent.type === 'setting' && intent.key !== undefined && intent.value !== undefined) updateSetting(intent.key, intent.value);
  if (intent.type === 'reset-save') wipeProfile();
}

async function launchRun(): Promise<void> {
  const selected = getShip(save.selectedShip);
  if (!save.unlockedShips.includes(selected.id)) save.selectedShip = 'vanguard';
  const audioReady = await audio.unlockFromGesture();
  save.settings.audioUnavailable = !audioReady;
  audio.setSettings(save.settings);
  persistSoon();
  simulation.startRun(save.selectedShip, save.threatUnlocked ? save.threatModifiers : [], createSeed());
  audio.setMusicMode('sector');
  input.setActive(false);
}

function buyMeta(id: MetaId): void {
  const meta = META.find((candidate) => candidate.id === id);
  if (!meta) return;
  const level = save.meta[id];
  const cost = meta.costs[level];
  if (cost === undefined || save.dust < cost) return;
  save.dust -= cost;
  save.meta[id] = level + 1;
  persistNow();
  audio.playSfx('ui', 1);
  ui.setScreen('core');
}

function selectShip(id: SaveData['selectedShip']): void {
  const ship = SHIPS.find((candidate) => candidate.id === id);
  if (!ship) return;
  if (!save.unlockedShips.includes(id)) {
    const prerequisiteMet = id === 'bulwark' && save.defeatedBosses.includes('grinder') || id === 'needle' && save.totalKills >= 100 || id === 'mirage' && save.defeatedBosses.includes('rail-warden') || id === 'nova' && save.defeatedBosses.includes('null-crown');
    if (!prerequisiteMet || save.dust < ship.cost) return;
    save.dust -= ship.cost;
    save.unlockedShips.push(id);
  }
  save.selectedShip = id;
  save.discovered = save.discovered.includes(id) ? save.discovered : [...save.discovered, id];
  persistNow();
  audio.playSfx('ui', 1);
  ui.setScreen('shipyard');
}

function toggleHeat(id: HeatId): void {
  if (!save.threatUnlocked) return;
  if (save.threatModifiers.includes(id)) save.threatModifiers = save.threatModifiers.filter((candidate) => candidate !== id);
  else save.threatModifiers = [...save.threatModifiers, id];
  persistSoon();
}

function updateSetting(key: NonNullable<GameIntent['key']>, value: NonNullable<GameIntent['value']>): void {
  if (key === 'quality' && (value === 'high' || value === 'balanced' || value === 'low')) save.settings.quality = value;
  if (key === 'reducedMotion' && typeof value === 'boolean') save.settings.reducedMotion = value;
  if ((key === 'music' || key === 'sfx' || key === 'master') && typeof value === 'number') save.settings[key] = Math.max(0, Math.min(1, value));
  audio.setSettings(save.settings);
  renderer.setQuality(save.settings.quality);
  persistSoon();
}

function wipeProfile(): void {
  resetSave(storage);
  const fresh = createDefaultSave();
  Object.assign(save, fresh);
  audio.setSettings(save.settings);
  simulation = new GameSimulation(save, { onEvent: handleEvent });
  ui.setScreen('title');
  input.setActive(false);
  persistTimer = null;
}

function persistSoon(): void {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, 160);
}

function persistNow(): void {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistSave(save, storage);
}

function createSeed(): number {
  const values = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(values);
  return values[0] || Date.now() >>> 0;
}

function getStorage(): Storage | null {
  try {
    const candidate = window.localStorage;
    const probe = '__super_roguedust_probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
}
