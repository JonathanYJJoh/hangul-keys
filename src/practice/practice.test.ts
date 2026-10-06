import { describe, expect, it } from "vitest";
import { compose } from "../hangul/composer";
import { keystrokesFor } from "../hangul/jamo";
import { expectedKey, isFinished, press, promptForText, startDrill, summarize } from "./drill";
import { mergeStats, pickLetters, weakestKeys, weakness } from "./stats";
import { WORDS } from "./words";

/** A predictable stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe("drill", () => {
  it("advances through each key of each prompt", () => {
    let s = startDrill([promptForText("한"), promptForText("ㅏ")]);
    const seen: (string | undefined)[] = [];
    for (const [i, key] of ["ㅎ", "ㅏ", "ㄴ", "ㅏ"].entries()) {
      seen.push(expectedKey(s));
      s = press(s, key, i * 100);
    }
    expect(seen).toEqual(["ㅎ", "ㅏ", "ㄴ", "ㅏ"]);
    expect(isFinished(s)).toBe(true);
    expect(s.correct).toBe(4);
  });

  it("counts a wrong key as a miss and waits for the right one", () => {
    let s = startDrill([promptForText("가")]);
    s = press(s, "ㅋ", 0);
    expect(s).toMatchObject({ misses: 1, lastWrong: "ㅋ", position: 0 });
    expect(expectedKey(s)).toBe("ㄱ");
    s = press(s, "ㄱ", 500);
    expect(s.lastWrong).toBeUndefined();
    expect(s.keys["ㄱ"]).toEqual({ attempts: 2, misses: 1, totalMs: 500 });
  });

  it("measures accuracy and keys per minute from the first keypress", () => {
    let s = startDrill([promptForText("가나")]);
    // 4 correct keys and 1 miss over 6 seconds.
    s = press(s, "ㄱ", 10_000);
    s = press(s, "ㅏ", 11_000);
    s = press(s, "ㅂ", 12_000);
    s = press(s, "ㄴ", 13_000);
    s = press(s, "ㅏ", 16_000);
    expect(summarize(s)).toEqual({ accuracy: 0.8, keysPerMinute: 40, durationMs: 6000 });
  });

  it("ignores keypresses after finishing", () => {
    let s = press(startDrill([promptForText("ㅏ")]), "ㅏ", 0);
    expect(press(s, "ㅏ", 100)).toBe(s);
  });
});

describe("word list", () => {
  it.each(WORDS.map((w) => [w.word]))("types %s with keys that compose back to it", (word) => {
    expect(compose(keystrokesFor(word))).toBe(word);
  });
});

describe("stats", () => {
  const result = (attempts: number, misses: number, totalMs: number) => ({ attempts, misses, totalMs });

  it("rates frequently missed and slow keys as weaker", () => {
    const good = result(10, 0, 5000);
    expect(weakness(result(10, 5, 2500))).toBeGreaterThan(weakness(good));
    expect(weakness(result(10, 0, 30_000))).toBeGreaterThan(weakness(good));
  });

  it("merges drill results into running totals", () => {
    expect(mergeStats({ ㄱ: result(2, 1, 900) }, { ㄱ: result(1, 0, 300), ㄴ: result(1, 0, 400) }))
      .toEqual({ ㄱ: result(3, 1, 1200), ㄴ: result(1, 0, 400) });
  });

  it("lists the weakest practiced keys first", () => {
    const stats = { ㄱ: result(10, 0, 5000), ㅓ: result(10, 6, 12_000), ㅂ: result(1, 1, 0) };
    // ㅂ has too little history to judge.
    expect(weakestKeys(stats, 2)).toEqual(["ㅓ", "ㄱ"]);
  });

  it("picks weak letters more often, without immediate repeats", () => {
    const stats = { ㄱ: result(20, 0, 10_000), ㅓ: result(20, 12, 40_000) };
    const picks = pickLetters(["ㄱ", "ㅓ", "ㅏ"], stats, 300, seeded(42));
    const count = (k: string) => picks.filter((p) => p === k).length;
    expect(count("ㅓ")).toBeGreaterThan(count("ㄱ"));
    expect(picks.some((p, i) => p === picks[i - 1])).toBe(false);
  });
});
