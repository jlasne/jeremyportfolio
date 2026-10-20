/* Types for spec.js, so the Convex side can import it under tsc. */

export interface SleepField { id: string; name: string; short: string; unit: string; max: number; better?: 'high' | 'low' }
export interface Sport { id: 'run' | 'swim' | 'lift' | 'other'; name: string; focus: string }

/** One session as kept: a sport, then what was measured. */
export interface Session {
  s: 'run' | 'swim' | 'lift' | 'other'; f?: string; t?: number; e?: number; hr?: number; pk?: number; lv?: number;
  m?: number; sec?: number; lift?: string; kg?: number; reps?: number; n?: string;
}
export interface Sleep { score?: number; hrv?: number; rhr?: number; ready?: number; min?: number; bed?: number; wake?: number }
/** One day as the server keeps it. */
export interface Day { day: string; sleep?: Sleep; sessions?: Session[]; note?: string }

export const SPEC: {
  start: string; sleep: SleepField[]; sports: Sport[];
  lifts: string[]; focus: string[]; perDay: number; nameMax: number;
  mix: Record<string, { avg: number; peak: number; felt: number }>; levels: number;
};
export const SLEEP: Map<string, SleepField>;
export const SPORT: Map<string, Sport>;

export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function cleanDay(day: string, input: unknown, today: string): Day | null;
export function fixBed(bed: number | undefined): number | undefined;
export function fromExp0(d: unknown): Omit<Day, 'day'> | null;
export const REF: { run: number };
export function equivalent(s: Session): number | undefined;
export function e1rm(s: Session): number | undefined;
export function hrTop(sessions: Session[]): number | undefined;
export function effort(s: Session, top: number | undefined): number | undefined;
export function minutes(s: Session): number | undefined;
export function load(s: Session, top: number | undefined): number | undefined;
export function score(s: Session): { key: string; v: number; high: boolean } | null;
export function bests(sessions: Session[]): Record<string, number>;
export function form(s: Session, best: Record<string, number>): number | undefined;
