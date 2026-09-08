/* Types for spec.js, so the Convex side can import it under tsc. */
export interface Exercise {
  id: string; discipline: string; unit: string;
  step: number; max: number; best: 'max' | 'min';
}
export interface Habit { id: string; short: string; name: string; why: string }
export interface Day { habits: Record<string, boolean>; sleep?: number; weight?: number; train?: Record<string, number>; note?: string }
export interface Payload { log: Record<string, Day> }
export const SPEC: {
  start: string; exercises: Exercise[];
  sleep: { unit: string; step: number; max: number };
  weight: { unit: string; step: number; max: number; height: string; why: string }; habits: Habit[];
};
export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function clean(input: Partial<Payload> | undefined, today: string): Payload;
