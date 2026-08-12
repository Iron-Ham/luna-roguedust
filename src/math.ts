import type { Vec2 } from './types';

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

export function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return target;
}

export function wrapAngle(angle: number): number {
  let result = angle % TAU;
  if (result < -Math.PI) result += TAU;
  if (result > Math.PI) result -= TAU;
  return result;
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function circleOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const radius = ar + br;
  return dx * dx + dy * dy <= radius * radius;
}

export function normalize(x: number, y: number, fallbackX = 0, fallbackY = -1): Vec2 {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

export function randomPointOnCircle(rng: Rng, cx: number, cy: number, radius: number): Vec2 {
  const angle = rng.next() * TAU;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function pointInCircle(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function signedAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

export function moveTowardCircle(x: number, y: number, cx: number, cy: number, radius: number, padding: number): Vec2 {
  const dx = x - cx;
  const dy = y - cy;
  const length = Math.hypot(dx, dy);
  const maxRadius = radius - padding;
  if (length <= maxRadius || length < 0.0001) return { x, y };
  return { x: cx + (dx / length) * maxRadius, y: cy + (dy / length) * maxRadius };
}

export class Rng {
  private state: number;

  public constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  public next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }

  public int(min: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - min + 1)) + min;
  }

  public pick<T>(values: readonly T[]): T {
    return values[Math.min(values.length - 1, Math.floor(this.next() * values.length))];
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public fork(salt: number): Rng {
    return new Rng((this.state ^ (salt * 2654435761)) >>> 0);
  }
}
