// Long-term practice history: how each key has gone across all drills, used
// to pick letters the learner struggles with and to show their weakest keys.

import type { KeyResult } from "./drill";

export type KeyStats = Record<string, KeyResult>;

/** Adds one drill's results to the running totals. */
export function mergeStats(total: KeyStats, drill: KeyStats): KeyStats {
  const merged = { ...total };
  for (const [key, r] of Object.entries(drill)) {
    const old = merged[key] ?? { attempts: 0, misses: 0, totalMs: 0 };
    merged[key] = {
      attempts: old.attempts + r.attempts,
      misses: old.misses + r.misses,
      totalMs: old.totalMs + r.totalMs,
    };
  }
  return merged;
}

/** A typical time to find a key, used before a key has history. */
const BASELINE_MS = 1500;

/**
 * How much a key needs practice; higher is weaker. Combines the miss rate and
 * how slowly the key is found. Unpracticed keys score as moderately weak, so
 * new letters get introduced instead of being starved by the weakest one.
 */
export function weakness(r: KeyResult | undefined): number {
  if (!r || r.attempts === 0) return 1;
  // +1/+2 smoothing keeps one lucky or unlucky press from dominating.
  const missRate = (r.misses + 1) / (r.attempts + 2);
  const correct = r.attempts - r.misses;
  const avgMs = correct > 0 ? r.totalMs / correct : BASELINE_MS * 2;
  return missRate * 2 + avgMs / BASELINE_MS;
}

/** The keys most in need of practice, weakest first, among keys with history. */
export function weakestKeys(stats: KeyStats, count: number): string[] {
  return Object.entries(stats)
    .filter(([, r]) => r.attempts >= 3)
    .sort(([, a], [, b]) => weakness(b) - weakness(a))
    .slice(0, count)
    .map(([key]) => key);
}

/**
 * Picks `count` letters, favoring weak ones: each pick's chance is
 * proportional to its weakness. Never repeats the same letter twice in a row.
 * `random` is injectable so tests can be deterministic.
 */
export function pickLetters(
  pool: string[],
  stats: KeyStats,
  count: number,
  random: () => number = Math.random,
): string[] {
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    const candidates = pool.length > 1 ? pool.filter((k) => k !== picks[i - 1]) : pool;
    const weights = candidates.map((k) => weakness(stats[k]));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    let choice = candidates[candidates.length - 1];
    for (let j = 0; j < candidates.length; j++) {
      roll -= weights[j];
      if (roll < 0) {
        choice = candidates[j];
        break;
      }
    }
    picks.push(choice);
  }
  return picks;
}

/** Picks `count` distinct items in random order. */
export function shuffleTake<T>(items: T[], count: number, random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
