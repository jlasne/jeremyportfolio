/* Types for spec.js, so the Convex side can import it under tsc. */
export interface Metric {
  id: string; name: string; protocol: string; unit: string;
  step: number; max: number; fallback: number; note: string;
}
export interface Exercise extends Metric { discipline: string }
export interface Habit { id: string; unlockDay: number; name: string; why: string }
export interface Payload { values: Record<string, number>; habits: Record<string, boolean>; sleep: number }
export const SPEC: { start: string; rampDays: number; exercises: Exercise[]; sleep: Metric; habits: Habit[] };
export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function dayOf(key?: string): number;
export function unlocked(habit: Habit, day: number): boolean;
export function fullRhythm(day: number): boolean;
export function clean(input: Partial<Payload> | undefined, day: number): Payload;
