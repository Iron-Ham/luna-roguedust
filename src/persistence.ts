import type { BossId, BoonId, HeatId, MetaLevels, Quality, SaveData, ShipId, SettingsData } from './types';

export const SAVE_KEY = 'super-roguedust:save';

const SHIP_IDS: readonly ShipId[] = ['vanguard', 'bulwark', 'needle', 'mirage', 'nova'];
const BOSS_IDS: readonly BossId[] = ['grinder', 'rail-warden', 'bloom-mother', 'prism-leviathan', 'null-crown'];
const BOON_IDS: readonly BoonId[] = ['overclock', 'echo-chamber', 'magnetar', 'afterimage', 'prism-rounds', 'drone-pact', 'rift-step', 'null-shell'];
const HEAT_IDS: readonly HeatId[] = ['overclocked', 'crowded', 'short-fuse', 'scarcity', 'fractured'];
const QUALITIES: readonly Quality[] = ['high', 'balanced', 'low'];
const META_IDS: readonly (keyof MetaLevels)[] = ['hull-matrix', 'vector-coils', 'capacitor-bank', 'salvage-lens', 'phase-lattice', 'resonance-core'];

function defaultReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createDefaultSave(): SaveData {
  return {
    schemaVersion: 1,
    dust: 0,
    selectedShip: 'vanguard',
    unlockedShips: ['vanguard'],
    meta: {
      'hull-matrix': 0,
      'vector-coils': 0,
      'capacitor-bank': 0,
      'salvage-lens': 0,
      'phase-lattice': 0,
      'resonance-core': 0,
    },
    discovered: ['vanguard', 'overclock', 'magnetar', 'rust-expanse', 'grinder'],
    defeatedBosses: [],
    transmissions: [],
    feats: [],
    totalKills: 0,
    highestSector: 1,
    threatUnlocked: false,
    threatModifiers: [],
    settings: {
      music: 0.58,
      sfx: 0.72,
      master: 0.82,
      reducedMotion: defaultReducedMotion(),
      quality: 'balanced',
      audioUnavailable: false,
    },
    lastRun: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isStringArray<T extends string>(value: unknown, values: readonly T[]): value is T[] {
  return Array.isArray(value) && value.every((item) => isOneOf(item, values));
}

function isMeta(value: unknown): value is MetaLevels {
  if (!isRecord(value)) return false;
  return META_IDS.every((id) => isIntegerInRange(value[id], 0, 3));
}

function isSettings(value: unknown): value is SettingsData {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.music) && value.music >= 0 && value.music <= 1 &&
    isFiniteNumber(value.sfx) && value.sfx >= 0 && value.sfx <= 1 &&
    isFiniteNumber(value.master) && value.master >= 0 && value.master <= 1 &&
    typeof value.reducedMotion === 'boolean' &&
    isOneOf(value.quality, QUALITIES) &&
    typeof value.audioUnavailable === 'boolean'
  );
}

function isRunSummary(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    isOneOf(value.reason, ['destroyed', 'victory', 'abandoned']) &&
    isFiniteNumber(value.dust) && value.dust >= 0 &&
    isIntegerInRange(value.sector, 1, 5) &&
    isIntegerInRange(value.kills, 0, 100000) &&
    isStringArray(value.boons, BOON_IDS) &&
    isOneOf(value.ship, SHIP_IDS) &&
    (value.boss === undefined || isOneOf(value.boss, BOSS_IDS)) &&
    Array.isArray(value.newlyUnlocked) && value.newlyUnlocked.every((item) => typeof item === 'string')
  );
}

function isSaveData(value: unknown): value is SaveData {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    isFiniteNumber(value.dust) && value.dust >= 0 &&
    isOneOf(value.selectedShip, SHIP_IDS) &&
    isStringArray(value.unlockedShips, SHIP_IDS) && value.unlockedShips.includes('vanguard') &&
    isMeta(value.meta) &&
    Array.isArray(value.discovered) && value.discovered.every((item) => typeof item === 'string') &&
    isStringArray(value.defeatedBosses, BOSS_IDS) &&
    Array.isArray(value.transmissions) && value.transmissions.every((item) => typeof item === 'string') &&
    Array.isArray(value.feats) && value.feats.every((item) => typeof item === 'string') &&
    isIntegerInRange(value.totalKills, 0, 10000000) &&
    isIntegerInRange(value.highestSector, 1, 5) &&
    typeof value.threatUnlocked === 'boolean' &&
    isStringArray(value.threatModifiers, HEAT_IDS) &&
    isSettings(value.settings) &&
    isRunSummary(value.lastRun)
  );
}

function withRecoveryNotice(save: SaveData, notice: string): SaveData {
  return { ...save, recoveryNotice: notice };
}

export function loadSave(storage: Storage | null): SaveData {
  const fresh = createDefaultSave();
  if (!storage) return withRecoveryNotice(fresh, 'SAVE UNAVAILABLE — PLAYING IN MEMORY');
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const parsed: unknown = JSON.parse(raw);
    if (!isSaveData(parsed)) return withRecoveryNotice(fresh, 'SAVE RECOVERED — MALFORMED PROFILE RESET');
    if (!parsed.unlockedShips.includes(parsed.selectedShip)) parsed.selectedShip = 'vanguard';
    return parsed;
  } catch {
    return withRecoveryNotice(fresh, 'SAVE RECOVERED — PROFILE RESET');
  }
}

export function persistSave(save: SaveData, storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // A blocked storage surface must not prevent the current session from running.
  }
}
