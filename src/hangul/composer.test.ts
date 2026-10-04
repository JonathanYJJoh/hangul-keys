import { describe, expect, it } from "vitest";
import { ROWS } from "../keyboard/layout";
import { HangulComposer, compose } from "./composer";
import { makeSyllable } from "./jamo";

/** Types English letters as if on a Dubeolsik keyboard; uppercase = Shift. */
function typeKeys(keys: string): string {
  const byLetter = new Map(
    ROWS.flat()
      .filter((k) => k.base)
      .flatMap((k) => [
        [k.label.toLowerCase(), k.base!.char],
        [k.label, (k.shift ?? k.base)!.char],
      ]),
  );
  return compose([...keys].map((k) => byLetter.get(k) ?? k));
}

const jamos = (s: string) => [...s];

describe("makeSyllable", () => {
  it("computes code points from jamo indexes", () => {
    expect(makeSyllable("ㄱ", "ㅏ")).toBe("가");
    expect(makeSyllable("ㅎ", "ㅏ", "ㄴ")).toBe("한");
    expect(makeSyllable("ㅎ", "ㅣ", "ㅎ")).toBe("힣"); // last syllable in Unicode
  });

  it("rejects parts in the wrong position", () => {
    expect(() => makeSyllable("ㅏ", "ㄱ")).toThrow();
    expect(() => makeSyllable("ㄱ", "ㅏ", "ㄸ")).toThrow(); // ㄸ is never a final
  });
});

describe("compose", () => {
  it.each([
    // [description, keystrokes, expected]
    ["a basic syllable", "ㅎㅏㄴ", "한"],
    ["two syllables", "ㅎㅏㄴㄱㅡㄹ", "한글"],
    ["a final that moves to the next syllable", "ㅎㅏㄴㅏ", "하나"],
    ["a compound vowel", "ㄱㅗㅏ", "과"],
    ["every compound vowel", "ㅇㅗㅐㅇㅗㅣㅇㅜㅓㅇㅜㅔㅇㅜㅣㅇㅡㅣ", "왜외워웨위의"],
    ["a double final", "ㄷㅏㄹㄱ", "닭"],
    ["a double final that splits before a vowel", "ㄷㅏㄹㄱㅣ", "달기"],
    ["ㅄ splitting", "ㄱㅏㅂㅅㅣ", "갑시"],
    ["a lone vowel", "ㅏ", "ㅏ"],
    ["vowels that do not combine", "ㅏㅏ", "ㅏㅏ"],
    ["consonants that do not combine", "ㄱㄱ", "ㄱㄱ"],
    ["a consonant that cannot be a final", "ㄱㅏㄸㅏ", "가따"],
    ["a third final starts a new syllable", "ㄷㅏㄹㄱㄱ", "닭ㄱ"],
    ["a compound vowel then a final", "ㄱㅘㄴ", "관"],
    ["spaces between words", "ㅇㅏㄴ ㄴㅕㅇ", "안 녕"],
    ["a sentence", "ㅅㅏㄹㅏㅇㅎㅐㅇㅛ", "사랑해요"],
  ])("handles %s", (_, keys, expected) => {
    expect(compose(jamos(keys))).toBe(expected);
  });
});

describe("HangulComposer", () => {
  it("shows the syllable while it is being typed", () => {
    const c = new HangulComposer();
    const steps = ["ㅎ", "ㅏ", "ㄴ"].map((j) => {
      expect(c.input(j)).toBe("");
      return c.composing;
    });
    expect(steps).toEqual(["ㅎ", "하", "한"]);
  });

  it("returns the finished syllable when the next one starts", () => {
    const c = new HangulComposer();
    for (const j of "ㅎㅏㄴ") c.input(j);
    expect(c.input("ㅏ")).toBe("하");
    expect(c.composing).toBe("나");
  });

  it("backspaces one keystroke at a time", () => {
    const c = new HangulComposer();
    for (const j of "ㄱㅗㅏㄴ") c.input(j);
    expect(c.composing).toBe("관");

    const after: string[] = [];
    while (c.backspace()) after.push(c.composing);
    expect(after).toEqual(["과", "고", "ㄱ", ""]);
  });

  it("tells the caller to delete committed text when nothing is composing", () => {
    const c = new HangulComposer();
    expect(c.backspace()).toBe(false);
  });

  it("backspaces within the new syllable after a final moves", () => {
    const c = new HangulComposer();
    for (const j of "ㅎㅏㄴㅏ") c.input(j);
    c.backspace();
    expect(c.composing).toBe("ㄴ");
  });
});

describe("typing on the Dubeolsik layout", () => {
  it.each([
    ["gksrmf", "한글"],
    ["dkssudgktpdy", "안녕하세요"],
    ["rkatkgkqslek", "감사합니다"],
    ["Qkd", "빵"], // Shift+Q → ㅃ
    ["dhk", "와"],
  ])("types %s as %s", (keys, expected) => {
    expect(typeKeys(keys)).toBe(expected);
  });
});
