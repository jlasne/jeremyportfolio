/* Types for spec.js, so the Convex side can import it under tsc. */

/** One field on a day: what it is called, what it may hold, how it is shown. */
export interface Field {
  id: string; name: string; unit?: string;
  kind?: 'tap' | 'flag' | 'num';
  max: number; step?: number; icon?: string; why?: string;
  src?: string; clock?: boolean;
}
export interface Outcome { id: string; name: string; better: 'high' | 'low' }
export interface Factor { id: string; name: string; icon: string; split: 'flag' | 'zero' | 'median' }

/** One sport session: the sport, start, end, calories, how hard (1-3). */
export interface Session { s: string; t?: number; e?: number; k?: number; i?: number }
/** One cup or one meal: start, end, and a meal's calories. */
export interface Span { t?: number; e?: number; k?: number }

/**
 * A logged day: field id to value.
 *
 * Flags are true and the rest are numbers, except the two lists `clean`
 * writes: `sessions` and the spans behind a tapped field, such as `cups`
 * and `meals`. The Convex validator on `bio.save` allows exactly these,
 * so the two have to agree or the save will not typecheck.
 */
export type Day = Record<string, number | boolean | string | Session[] | Span[]>;
export interface Payload { log: Record<string, Day> }

export const SPEC: {
  start: string; end: string;
  minDays: number; minPerSide: number;
  manual: Field[]; body: Field[];
  outcomes: Outcome[]; factors: Factor[];
};
export const FIELDS: Map<string, Field>;

export function dateKey(d?: Date): string;
export function isKey(key: unknown): key is string;
export function shift(key: string, n: number): string;
export function daysBetween(from: string, to: string): number;
export function allDays(): string[];
export function clean(input: Partial<Payload> | undefined, today: string): Payload;
export function isLogged(day?: Day): boolean;
export function hasBody(day?: Day): boolean;

export interface Cell { delta: number; label: string; good: boolean; n: number; nOn: number }
export function cell(log: Record<string, Day>, factor: Factor, outcome: Outcome): Cell | null;
export function matrix(log: Record<string, Day>): { factor: Factor; cells: (Cell | null)[]; loudest: number }[];
export function readyDays(log: Record<string, Day>): number;
