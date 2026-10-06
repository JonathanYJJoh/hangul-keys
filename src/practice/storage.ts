// Saves practice history in the app's local storage. It persists between
// launches; if storage is unavailable, practice still works, just unsaved.

import type { DrillSummary } from "./drill";
import type { KeyStats } from "./stats";

export type DrillMode = "letters" | "listening" | "words";

export interface SessionRecord extends DrillSummary {
  mode: DrillMode;
  /** When the session finished, as an ISO date string. */
  date: string;
}

const STATS_KEY = "practice.keyStats";
const SESSIONS_KEY = "practice.sessions";
/** Enough history for progress charts without growing forever. */
const MAX_SESSIONS = 200;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep going without saving.
  }
}

export const loadKeyStats = (): KeyStats => load(STATS_KEY, {});
export const saveKeyStats = (stats: KeyStats) => save(STATS_KEY, stats);

export const loadSessions = (): SessionRecord[] => load(SESSIONS_KEY, []);
export function addSession(session: SessionRecord): SessionRecord[] {
  const sessions = [...loadSessions(), session].slice(-MAX_SESSIONS);
  save(SESSIONS_KEY, sessions);
  return sessions;
}
