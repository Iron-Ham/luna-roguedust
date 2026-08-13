import type { AudioMode, SettingsData } from './types';

export type SfxKind = 'shot' | 'dash' | 'ability' | 'hit' | 'pickup' | 'bossPhase' | 'ui' | 'death' | 'victory';

interface AudioBuses {
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  ui: GainNode;
}

const MAX_VOICES = 36;

export class AudioEngine {
  private context: AudioContext | null = null;
  private buses: AudioBuses | null = null;
  private settings: SettingsData;
  private mode: AudioMode = 'quiet';
  private musicTimer: number | null = null;
  private musicStep = 0;
  private activeVoices = 0;
  private unavailable = false;

  public constructor(settings: SettingsData) {
    this.settings = { ...settings };
    this.unavailable = settings.audioUnavailable;
  }

  public async unlockFromGesture(): Promise<boolean> {
    if (this.unavailable) return false;
    if (!this.context) {
      try {
        const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextConstructor) throw new Error('AudioContext unavailable');
        this.context = new AudioContextConstructor();
        this.buses = this.createBuses(this.context);
      } catch {
        this.unavailable = true;
        this.settings.audioUnavailable = true;
        return false;
      }
    }
    try {
      await this.context.resume();
      this.startMusic();
      return this.context.state === 'running';
    } catch {
      this.unavailable = true;
      this.settings.audioUnavailable = true;
      return false;
    }
  }

  public setSettings(settings: SettingsData): void {
    this.settings = { ...settings, audioUnavailable: this.unavailable || settings.audioUnavailable };
    if (this.buses) this.applyBusVolumes();
  }

  public getSettings(): SettingsData {
    return { ...this.settings, audioUnavailable: this.unavailable };
  }

  public playSfx(kind: SfxKind, intensity = 1, pitchShift = 0): void {
    if (!this.context || !this.buses || this.unavailable || this.settings.sfx <= 0 || this.activeVoices >= MAX_VOICES) return;
    const now = this.context.currentTime;
    const clamped = Math.max(0.15, Math.min(1.5, intensity));
    const destination = kind === 'ui' ? this.buses.ui : this.buses.sfx;
    const gain = this.context.createGain();
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const duration = kind === 'bossPhase' || kind === 'victory' ? 0.38 : kind === 'hit' ? 0.12 : 0.08;
    const base = (kind === 'shot' ? 180 + clamped * 90 : kind === 'dash' ? 90 : kind === 'ability' ? 110 : kind === 'pickup' ? 620 : kind === 'bossPhase' ? 72 : kind === 'victory' ? 330 : kind === 'death' ? 55 : 260) + pitchShift;
    const end = kind === 'shot' ? base * 1.8 : kind === 'dash' ? base * 2.2 : kind === 'hit' ? base * 0.55 : base * 1.15;
    oscillator.type = kind === 'hit' || kind === 'death' ? 'sawtooth' : kind === 'pickup' || kind === 'victory' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(base, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, end), now + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(kind === 'hit' ? 900 : 2400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.18, 0.055 * clamped), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(duration + 0.04);
  }

  public setMusicMode(mode: AudioMode): void {
    this.mode = mode;
    if (this.context && this.buses) this.startMusic();
  }

  public suspend(): void {
    if (this.context && this.context.state === 'running') void this.context.suspend();
  }

  public async resume(): Promise<void> {
    if (this.context && this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        this.unavailable = true;
        this.settings.audioUnavailable = true;
      }
    }
  }

  public dispose(): void {
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.buses = null;
  }

  private createBuses(context: AudioContext): AudioBuses {
    const master = context.createGain();
    const music = context.createGain();
    const sfx = context.createGain();
    const ui = context.createGain();
    music.connect(master);
    sfx.connect(master);
    ui.connect(master);
    master.connect(context.destination);
    return { master, music, sfx, ui };
  }

  private applyBusVolumes(): void {
    if (!this.buses) return;
    this.buses.master.gain.value = this.settings.master;
    this.buses.music.gain.value = this.settings.music;
    this.buses.sfx.gain.value = this.settings.sfx;
    this.buses.ui.gain.value = Math.min(1, this.settings.sfx * 1.1);
  }

  private startMusic(): void {
    if (!this.context || !this.buses || this.settings.music <= 0 || this.musicTimer !== null) {
      this.applyBusVolumes();
      return;
    }
    this.applyBusVolumes();
    const schedule = (): void => {
      this.musicTimer = null;
      if (!this.context || !this.buses || this.context.state !== 'running' || this.settings.music <= 0) return;
      const now = this.context.currentTime;
      const roots = this.mode === 'boss' ? [55, 65.4, 73.4, 82.4] : this.mode === 'sector' ? [73.4, 82.4, 98, 110] : [55, 65.4, 73.4, 82.4];
      const root = roots[this.musicStep % roots.length];
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(root * (this.musicStep % 3 === 0 ? 1 : 2), now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.024, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      oscillator.connect(gain).connect(this.buses.music);
      oscillator.start(now);
      oscillator.stop(now + 0.52);
      this.trackVoice(0.56);
      this.musicStep += 1;
      this.musicTimer = window.setTimeout(schedule, 420);
    };
    schedule();
  }

  private trackVoice(duration: number): void {
    this.activeVoices += 1;
    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, duration * 1000);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
