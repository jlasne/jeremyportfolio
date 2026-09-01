/**
 * Gigawatt: the leaderboard.
 *
 * The clock runs in the browser, so a player can hand it any number. Every
 * check that could sit here would fall in 10 minutes, so the board says the
 * truth out loud and lets people judge it.
 *
 * Leave ENDPOINT empty and the board stays on the player's machine. Point it
 * at a host that takes a POST of {name, seconds} and answers GET with a list,
 * and the same board goes public.
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
