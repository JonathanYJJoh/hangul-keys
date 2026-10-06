import { describe, expect, it } from "vitest";
import { compose } from "./composer";
import { decompose, keystrokesFor } from "./jamo";

/** Every precomposed Hangul syllable in Unicode, 가 through 힣. */
const ALL_SYLLABLES = Array.from({ length: 11172 }, (_, i) => String.fromCharCode(0xac00 + i));

describe("decompose", () => {
  it.each([
    ["가", ["ㄱ", "ㅏ"]],
    ["한", ["ㅎ", "ㅏ", "ㄴ"]],
    ["과", ["ㄱ", "ㅗ", "ㅏ"]], // compound vowel: two keys
    ["닭", ["ㄷ", "ㅏ", "ㄹ", "ㄱ"]], // double final: two keys
    ["뷁", ["ㅂ", "ㅜ", "ㅔ", "ㄹ", "ㄱ"]], // both at once
    ["빵", ["ㅃ", "ㅏ", "ㅇ"]], // tense consonants are one (shifted) key
    ["ㅘ", ["ㅗ", "ㅏ"]],
    [" ", [" "]],
  ])("splits %s into its keystrokes", (char, keys) => {
    expect(decompose(char)).toEqual(keys);
  });

  it("round-trips all 11,172 Hangul syllables through the composer", () => {
    const failures = ALL_SYLLABLES.filter((s) => compose(decompose(s)) !== s);
    expect(failures).toEqual([]);
  });
});

describe("keystrokesFor", () => {
  it("lists the keystrokes for a phrase", () => {
    expect(keystrokesFor("안녕 한글")).toEqual([
      ..."ㅇㅏㄴㄴㅕㅇ",
      " ",
      ..."ㅎㅏㄴㄱㅡㄹ",
    ]);
  });
});
