/**
 * Gigawatt — the leaderboard.
 *
 * A browser game keeps its clock in the browser, which means anyone who cares
 * to can hand it whatever number they like. There is no check here that would
 * survive ten minutes of somebody trying, so there isn't one. The board says
 * so out loud instead, and everybody can decide for themselves what it is
 * worth. Times posted from a console are not really the point.
 *
 * With no endpoint configured the board is your own machine, and nothing
 * leaves it. Point ENDPOINT at any host that takes a POST of {name, seconds}
 * and answers GET with a list, and the same board goes public.
 */

const ENDPOINT = '';
const LOCAL_KEY = 'gigawatt.times';
const MAX = 25;

const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
};
const writeLocal = (rows) => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, MAX))); } catch { /* private window */ }
};

const rank = (rows) => rows
  .filter((r) => r && typeof r.seconds === 'number' && r.seconds > 0)
  .sort((a, b) => a.seconds - b.seconds)
  .slice(0, MAX);

export const isPublic = Boolean(ENDPOINT);

export async function load() {
  if (!ENDPOINT) return rank(readLocal());
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status);
    return rank(await res.json());
  } catch {
    return rank(readLocal());          // offline, or the board is down
  }
}

export async function submit(name, seconds) {
  const row = { name: String(name).slice(0, 18).trim() || 'Anonymous', seconds, at: Date.now() };
  writeLocal(rank([...readLocal(), row]));
  if (ENDPOINT) {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(row),
      });
    } catch { /* the local copy still stands */ }
  }
  return { row, rows: await load() };
}
