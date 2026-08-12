import { clamp, normalize } from './math';
import type { InputSnapshot } from './types';

const CONTROL_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'e', ' ', 'shift', 'escape']);

export class InputController {
  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();
  private canvas: HTMLCanvasElement | null = null;
  private pointerX = 800;
  private pointerY = 450;
  private pointerActive = false;
  private firing = false;
  private previousPadButtons: boolean[] = [];
  private attached = false;
  private active = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (this.active && CONTROL_KEYS.has(key)) event.preventDefault();
    if (!this.pressed.has(key)) this.justPressed.add(key);
    this.pressed.add(key);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.pressed.delete(key);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = clamp(((event.clientX - rect.left) / rect.width) * 1600, 0, 1600);
    this.pointerY = clamp(((event.clientY - rect.top) / rect.height) * 900, 0, 900);
    this.pointerActive = true;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.firing = true;
      this.pointerActive = true;
    }
    if (event.button === 2) {
      this.justPressed.add('pointer-ability');
      event.preventDefault();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) this.firing = false;
  };

  private readonly onBlur = (): void => {
    this.pressed.clear();
    this.justPressed.clear();
    this.firing = false;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.active) event.preventDefault();
  };

  public attach(canvas: HTMLCanvasElement): void {
    if (this.attached) return;
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    this.attached = true;
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!active) this.onBlur();
  }

  public snapshot(): InputSnapshot {
    const moveX = (this.pressed.has('d') || this.pressed.has('arrowright') ? 1 : 0) - (this.pressed.has('a') || this.pressed.has('arrowleft') ? 1 : 0);
    const moveY = (this.pressed.has('s') || this.pressed.has('arrowdown') ? 1 : 0) - (this.pressed.has('w') || this.pressed.has('arrowup') ? 1 : 0);
    const move = normalize(moveX, moveY, 0, 0);
    const pad = this.readGamepad();
    const dashPressed = this.takePressed(' ', 'shift') || pad.dash;
    const abilityPressed = this.takePressed('e') || this.takePointerAbility() || pad.ability;
    const pausePressed = this.takePressed('escape') || pad.pause;
    const firing = this.firing || this.pressed.has('control') || pad.firing;
    const pointerAim = !pad.aimActive;
    const aim = pad.aimActive ? normalize(pad.aimX, pad.aimY, 1, 0) : normalize(this.pointerX - 800, this.pointerY - 450, 1, 0);
    const snapshot: InputSnapshot = {
      moveX: Number.isFinite(pad.moveX) && Math.abs(pad.moveX) > 0.15 ? pad.moveX : move.x,
      moveY: Number.isFinite(pad.moveY) && Math.abs(pad.moveY) > 0.15 ? pad.moveY : move.y,
      aimX: aim.x,
      aimY: aim.y,
      aimTargetX: this.pointerX,
      aimTargetY: this.pointerY,
      firing,
      abilityPressed,
      dashPressed,
      pausePressed,
      pointerActive: this.pointerActive && pointerAim,
    };
    this.justPressed.clear();
    return Object.freeze(snapshot);
  }

  public dispose(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas?.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas = null;
    this.attached = false;
  }

  private takePressed(...keys: string[]): boolean {
    return keys.some((key) => this.justPressed.has(key));
  }

  private takePointerAbility(): boolean {
    const pressed = this.justPressed.has('pointer-ability');
    if (pressed) this.justPressed.delete('pointer-ability');
    return pressed;
  }

  private readGamepad(): { moveX: number; moveY: number; aimX: number; aimY: number; aimActive: boolean; firing: boolean; ability: boolean; dash: boolean; pause: boolean } {
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = Array.from(gamepads).find((candidate): candidate is Gamepad => candidate !== null);
    if (!pad) {
      this.previousPadButtons = [];
      return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, firing: false, ability: false, dash: false, pause: false };
    }
    const axis = (index: number): number => clamp(pad.axes[index] ?? 0, -1, 1);
    const buttonDown = (index: number): boolean => Boolean(pad.buttons[index]?.pressed);
    const buttonEdge = (index: number): boolean => buttonDown(index) && !this.previousPadButtons[index];
    const snapshot = {
      moveX: axis(0),
      moveY: axis(1),
      aimX: axis(2),
      aimY: axis(3),
      aimActive: Math.hypot(axis(2), axis(3)) > 0.2,
      firing: buttonDown(7),
      ability: buttonEdge(6),
      dash: buttonEdge(0),
      pause: buttonEdge(9),
    };
    this.previousPadButtons = pad.buttons.map((button) => button.pressed);
    return snapshot;
  }
}
