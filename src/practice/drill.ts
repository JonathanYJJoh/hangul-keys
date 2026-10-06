// The rules of a practice drill, kept free of UI so they can be unit tested.
//
// A drill is a list of prompts. Each prompt is a sequence of keystrokes (jamo,
// or " " for space). The learner must press each key in order: a correct key
// advances, a wrong key counts as a miss and must be retried.

import { keystrokesFor } from "../hangul/jamo";

export interface Prompt {
  /** What's shown: a letter, or a word like 사랑. */
  text: string;
  /** English meaning, for words. */
  meaning?: string;
  /** The keys to press, in order. */
  keys: string[];
}

/** How one key went during a drill. */
export interface KeyResult {
  attempts: number;
  misses: number;
  /** Total time to find the key, across correct presses. */
  totalMs: number;
}

export interface DrillState {
  prompts: Prompt[];
  /** Current prompt, and position within its keys. */
  index: number;
  position: number;
  correct: number;
  misses: number;
  /** The last wrong key pressed, so the UI can flash it. */
  lastWrong?: string;
  startedAt?: number;
  /** When the current key became the one to press. */
  keyStartedAt?: number;
  finishedAt?: number;
  keys: Record<string, KeyResult>;
}

export const promptForText = (text: string, meaning?: string): Prompt => ({
  text,
  meaning,
  keys: keystrokesFor(text),
});

export function startDrill(prompts: Prompt[]): DrillState {
  return { prompts, index: 0, position: 0, correct: 0, misses: 0, keys: {} };
}

export const isFinished = (s: DrillState) => s.finishedAt !== undefined;

/** The key the learner should press next, or undefined once finished. */
export function expectedKey(s: DrillState): string | undefined {
  return isFinished(s) ? undefined : s.prompts[s.index]?.keys[s.position];
}

function recordKey(
  keys: Record<string, KeyResult>,
  key: string,
  change: Partial<KeyResult>,
): Record<string, KeyResult> {
  const old = keys[key] ?? { attempts: 0, misses: 0, totalMs: 0 };
  return {
    ...keys,
    [key]: {
      attempts: old.attempts + (change.attempts ?? 0),
      misses: old.misses + (change.misses ?? 0),
      totalMs: old.totalMs + (change.totalMs ?? 0),
    },
  };
}

/** Applies one keypress. `now` is a timestamp in milliseconds. */
export function press(s: DrillState, key: string, now: number): DrillState {
  const expected = expectedKey(s);
  if (expected === undefined) return s;

  // The clock starts on the first keypress, not when the drill appears.
  const startedAt = s.startedAt ?? now;
  const keyStartedAt = s.keyStartedAt ?? now;

  if (key !== expected) {
    return {
      ...s,
      startedAt,
      keyStartedAt,
      misses: s.misses + 1,
      lastWrong: key,
      keys: recordKey(s.keys, expected, { attempts: 1, misses: 1 }),
    };
  }

  const keys = recordKey(s.keys, expected, { attempts: 1, totalMs: now - keyStartedAt });
  const promptDone = s.position + 1 >= s.prompts[s.index].keys.length;
  const drillDone = promptDone && s.index + 1 >= s.prompts.length;

  return {
    ...s,
    startedAt,
    keyStartedAt: now,
    index: promptDone ? s.index + 1 : s.index,
    position: promptDone ? 0 : s.position + 1,
    correct: s.correct + 1,
    lastWrong: undefined,
    keys,
    finishedAt: drillDone ? now : undefined,
  };
}

export interface DrillSummary {
  /** Correct keystrokes over all keystrokes, 0–1. */
  accuracy: number;
  /** Correct keystrokes per minute, the usual Korean typing speed measure (타수). */
  keysPerMinute: number;
  durationMs: number;
}

export function summarize(s: DrillState, now = s.finishedAt ?? 0): DrillSummary {
  const total = s.correct + s.misses;
  const durationMs = s.startedAt === undefined ? 0 : Math.max(0, now - s.startedAt);
  return {
    accuracy: total === 0 ? 1 : s.correct / total,
    keysPerMinute: durationMs === 0 ? 0 : Math.round((s.correct / durationMs) * 60_000),
    durationMs,
  };
}
