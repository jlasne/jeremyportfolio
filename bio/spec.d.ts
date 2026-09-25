/* Types for spec.js, so the Convex side can import it under tsc. */

/** One field on a day: what it is called, what it may hold, how it is shown. */
export interface Field {
  id: string; group: string; name: string; unit?: string;
  kind: 'tap' | 'flag' | 'num' | 'time';
  max: number; step?: number; icon: string; src?: string;
  clock?: boolean; night?: boolean; spans?: string;
  goal?: number; goalDir?: 'min' | 'max'; scale?: number; scaleUnit?: string;
}
export interface Group { id: string; name: string; icon: string; when: string }
export interface Outcome { id: string; name: string; icon: string; unit: string; better: 'high' | 'low'; digits?: number }
export interface Factor {
  id: string; group: string; name: string; icon: string;
  split: 'flag' | 'zero' | 'median'; on: string;
  from?: 'coffee' | 'meals' | 'sessions'; lag?: number; fmt?: string; sport?: string;
}

/** Something that takes time: start and end, minutes after midnight. */
export interface Span { t?: number; e?: number }
export interface Meal extends Span { k?: number }
export interface Session extends Span { s: string; k?: number; i?: number }

/**
 * A logged day: field id to value, plus the lists `clean` writes: `cups`,
 * `meals` and `sessions`. The Convex validator on `bio.save` allows exactly
 * these, so the two have to agree or the save will not typecheck.
 */
export type Day = Record<string, number | boolean | string | Span[] | Meal[] | Session[]>;
export interface Payload { log: Record<string, Day> }

export const SPEC: {
  start: string; end: string; practice: number;
  reliableAt: number; minPerSide: number; maxLuck: number; veryAt: number;
  groups: Group[]; fields: Field[];
  sports: string[]; levels: string[];
  session: { perDay: number; kcal: number; name: number };
  meal: { perDay: number; kcal: number };
  lateCoffee: number;
  outcomes: Outcome[]; factors: Factor[];
};
export const FIELDS: Map<string, Field>;
export function inGroup(id: string): Field[];

export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function firstDay(): string;
export function isPractice(key: string): boolean;
export function allDays(): string[];

export function spanEnd(x?: Span): number | undefined;
export function spanMin(x?: Span): number | undefined;
/** Accepts anything the page may send; returns only what a day may hold. */
export function clean(input: { log?: Record<string, unknown> } | undefined, today: string): Payload;
export function isLogged(day?: Day): boolean;
export function hasBody(day?: Day): boolean;
export function goalMet(f: Field, v: number | null | undefined): boolean | null;

export interface Link {
  diff: number; delta: number; d: number; label: string; good: boolean; base: number;
  cut: number | null; p: number; q?: number; n: number; nOn: number;
}
export function valueOf(day: Day | undefined, f: Factor): number | undefined;
export function pairsOf(log: Record<string, Day>, factor: Factor, outcome: Outcome): { x: number; y: number }[];
export function needPairs(): number;
export function cell(log: Record<string, Day>, factor: Factor, outcome: Outcome): Link | null;
export function welchP(a: number[], b: number[]): number;
export function sportList(log: Record<string, Day>): string[];
export function factorsFor(log: Record<string, Day>): Factor[];
export function analyze(log: Record<string, Day>): {
  rows: { factor: Factor; cells: (Link | null)[]; counts: number[] }[];
  tested: number;
};
export function average(log: Record<string, Day>, outcome: Outcome): number | null;
export function isFinding(link: Link): boolean;
export function impact(link: Link | null): { level: 'neutral' | 'good' | 'bad'; very: boolean; lean?: 'good' | 'bad' | null } | null;
export function readyDays(log: Record<string, Day>): number;

/** The best time: three windows of my own days, early, middle, late. */
export interface Window { from: number; to: number; n: number; mean: number }
export interface BestTime { windows: Window[]; best: number; diff: number; d: number; p: number; q?: number; n: number }
export const TIMING: string[];
export function needTimed(): number;
export function bestTime(log: Record<string, Day>, factor: Factor, outcome: Outcome): BestTime | null;
export function bestTimes(log: Record<string, Day>): {
  rows: { factor: Factor; cells: (BestTime | null)[]; counts: number[] }[];
  tested: number;
};
export function timingImpact(res: BestTime | null): { level: 'neutral' | 'good'; very: boolean; lean?: 'good' | null } | null;
