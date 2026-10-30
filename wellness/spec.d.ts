/* Types for spec.js, so the Convex side can import it under tsc. */

/** One max: a name, the day, the measures picked and their numbers. */
export interface Max { n: string; d?: string; u?: string[]; reps?: number; kg?: number; m?: number; kmh?: number; sec?: number }
export interface SleepField { id: string; name: string; short: string; unit: string; max: number; better?: 'high' | 'low' }
export interface Test { m: number; sec?: number }
export interface Sport { id: 'run' | 'swim' | 'lift' | 'other'; name: string; focus: string }

/** One session as kept: a sport, then what was measured. */
export interface Session {
  s: 'run' | 'swim' | 'lift' | 'other'; f?: string; t?: number; e?: number; hr?: number; pk?: number; lv?: number; d?: number;
  m?: number; sec?: number; w?: Test[]; lift?: string; kg?: number; reps?: number; n?: string;
  x?: Exercise[];
}
/** One exercise of a Gym session. */
export interface Exercise { n: string; sets?: number; reps?: number; kg?: number }
/** One max: a name, the day, the measures picked and their numbers. */
export interface Max { n: string; d?: string; u?: string[]; reps?: number; kg?: number; m?: number; kmh?: number; sec?: number }
export interface Sleep { hrv?: number; rhr?: number; min?: number; deep?: number; rem?: number; bed?: number; wake?: number }
/** One day as the server keeps it. */
export interface Day { day: string; sleep?: Sleep; gf?: boolean; cold?: boolean; dark?: boolean; travel?: boolean; sessions?: Session[]; note?: string }

export const SPEC: {
  start: string; sleep: SleepField[]; sports: Sport[];
  lifts: string[]; exMax: number; focus: string[]; perDay: number; nameMax: number;
  mix: Record<string, { avg: number; peak: number; felt: number }>; levels: number;
  maxUnits: { id: string; name: string; unit: string; max: number }[]; maxCount: number;
};
export const SLEEP: Map<string, SleepField>;
export const SPORT: Map<string, Sport>;

export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function cleanDay(day: string, input: unknown, today: string): Day | null;
export function cleanMaxes(input: unknown, today: string): Max[];
export function fixBed(bed: number | undefined): number | undefined;
export function fromExp0(d: unknown): Omit<Day, 'day'> | null;
export const REF: { run: number };
export function runSec(s: Session): number | undefined;
export function equivalent(s: Session): number | undefined;
export function tests(s: Session): Test[];
export function mps(t: Test): number | undefined;
export function exercises(s: Session): Exercise[];
export function e1rm(s: { kg?: number; reps?: number }): number | undefined;
export function hrTop(sessions: Session[]): number | undefined;
export type HR = number | { max?: number; rest?: number } | undefined;
export function reserve(bpm: number | undefined, hr: HR): number | undefined;
export function effort(s: Session, hr: HR): number | undefined;
export function minutes(s: Session): number | undefined;
export function load(s: Session, hr: HR): number | undefined;
export function scores(s: Session): { key: string; v: number; high: boolean }[];
export function bests(sessions: Session[]): Record<string, number>;
export function form(s: Session, best: Record<string, number>): number | undefined;
