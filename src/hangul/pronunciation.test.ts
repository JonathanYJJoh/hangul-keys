import { describe, expect, it } from "vitest";
import { ROWS } from "../keyboard/layout";
import { isConsonant, makeSyllable } from "./jamo";
import { PRONUNCIATION } from "./pronunciation";

const keyboardJamo = ROWS.flat()
  .flatMap((k) => [k.base, k.shift])
  .filter((j) => j !== undefined)
  .map((j) => j.char);

describe("PRONUNCIATION", () => {
  it("covers every letter on the keyboard", () => {
    const missing = keyboardJamo.filter((j) => !PRONUNCIATION[j]);
    expect(missing).toEqual([]);
  });

  it.each(keyboardJamo)("demonstrates %s with the matching syllable", (jamo) => {
    // Consonants are voiced with ㅏ, vowels after the silent ㅇ.
    const expected = isConsonant(jamo) ? makeSyllable(jamo, "ㅏ") : makeSyllable("ㅇ", jamo);
    expect(PRONUNCIATION[jamo].sound).toBe(expected);
  });

  it("writes every example word in Hangul syllables", () => {
    for (const { example } of Object.values(PRONUNCIATION)) {
      expect(example.word).toMatch(/^[가-힣]+$/);
    }
  });
});
