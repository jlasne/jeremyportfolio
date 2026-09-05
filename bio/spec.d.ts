/* Types for spec.js, so the Convex side can import it under tsc. */
export interface Exercise {
  id: string; discipline: string; name: string; protocol: string; unit: string;
  step: number; max: number; fallback: number; note: string;
}
export interface Habit { id: string; short: string; name: string; why: string }
export interface Day { habits: Record<string, boolean>; sleep?: number }
export interface Payload { values: Record<string, number>; log: Record<string, Day> }
export const SPEC: {
  start: string; days: number; exercises: Exercise[];
  sleep: { unit: string; step: number; max: number }; habits: Habit[];
};
export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function dayOf(key: string): number;
export function keyOfDay(n: number): string;
export function clean(input: Partial<Payload> | undefined, today: string): Payload;
