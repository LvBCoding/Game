export interface ScoreEntry {
  score: number;
  wave:  number;
  date:  string;
}

const KEY = "love_blaster_lb";

function load(): ScoreEntry[] {
  try {
    const ls = (globalThis as any).localStorage;
    const raw = ls?.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: ScoreEntry[]) {
  try {
    (globalThis as any).localStorage?.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

export function addScore(score: number, wave: number): ScoreEntry[] {
  const entries = load();
  entries.push({ score, wave, date: new Date().toLocaleDateString() });
  entries.sort((a, b) => b.score - a.score);
  const top10 = entries.slice(0, 10);
  persist(top10);
  return top10;
}

export function getLeaderboard(): ScoreEntry[] {
  return load();
}
