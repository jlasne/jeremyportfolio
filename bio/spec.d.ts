/* Types for spec.js, so the Convex side can import it under tsc. */
export interface Exercise {
  id: string; discipline: string; name: string; short: string; protocol: string; unit: string;
  step: number; max: number; best: 'max' | 'min'; target: number; note: string;
}
export interface Habit { id: string; short: string; name: string; why: string }
export interface Day { habits: Record<string, boolean>; sleep?: number; train?: Record<string, number>; note?: string }
export interface Payload { log: Record<string, Day> }
export const SPEC: {
  exercises: Exercise[];
  sleep: { unit: string; step: number; max: number }; habits: Habit[];
};
export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function clean(input: Partial<Payload> | undefined, today: string): Payload;
export function bestOf(e: Exercise, log: Record<string, Day>): { value: number; sessions: number };
export function series(e: Exercise, log: Record<string, Day>): { key: string; v: number }[];
