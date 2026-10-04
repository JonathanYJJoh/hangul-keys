// Jamo tables in Unicode order. A syllable's code point is computed from the
// index of each part, so the order of these arrays must not change:
//   syllable = 0xAC00 + (initial * 21 + vowel) * 28 + final

/** 19 consonants that can start a syllable (초성). */
export const INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/** 21 vowels (중성). */
export const VOWELS = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ",
  "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
];

/** 27 final consonants (종성); index 0 means "no final". */
export const FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ",
  "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const SYLLABLE_BASE = 0xac00;

/** Vowel pairs typed as two keys that merge into one vowel: ㅗ + ㅏ → ㅘ. */
const COMPOUND_VOWELS: Record<string, string> = {
  "ㅗㅏ": "ㅘ",
  "ㅗㅐ": "ㅙ",
  "ㅗㅣ": "ㅚ",
  "ㅜㅓ": "ㅝ",
  "ㅜㅔ": "ㅞ",
  "ㅜㅣ": "ㅟ",
  "ㅡㅣ": "ㅢ",
};

/** Consonant pairs that merge into a double final: ㄹ + ㄱ → ㄺ. */
const COMPOUND_FINALS: Record<string, string> = {
  "ㄱㅅ": "ㄳ",
  "ㄴㅈ": "ㄵ",
  "ㄴㅎ": "ㄶ",
  "ㄹㄱ": "ㄺ",
  "ㄹㅁ": "ㄻ",
  "ㄹㅂ": "ㄼ",
  "ㄹㅅ": "ㄽ",
  "ㄹㅌ": "ㄾ",
  "ㄹㅍ": "ㄿ",
  "ㄹㅎ": "ㅀ",
  "ㅂㅅ": "ㅄ",
};

/** Reverse of COMPOUND_FINALS: ㄺ → ["ㄹ", "ㄱ"]. */
const SPLIT_FINALS: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(COMPOUND_FINALS).map(([pair, merged]) => [merged, [pair[0], pair[1]]]),
);

export const isConsonant = (j: string) => INITIALS.includes(j);
export const isVowel = (j: string) => VOWELS.includes(j);
export const isJamo = (j: string) => isConsonant(j) || isVowel(j);

/** ㄸ, ㅃ and ㅉ can start a syllable but never end one. */
export const canBeFinal = (j: string) => j !== "" && FINALS.includes(j);

export const combineVowels = (a: string, b: string): string | undefined =>
  COMPOUND_VOWELS[a + b];

export const combineFinals = (a: string, b: string): string | undefined =>
  COMPOUND_FINALS[a + b];

export const splitFinal = (f: string): [string, string] | undefined => SPLIT_FINALS[f];

/** Builds the precomposed syllable, e.g. ("ㅎ", "ㅏ", "ㄴ") → "한". */
export function makeSyllable(initial: string, vowel: string, final = ""): string {
  const i = INITIALS.indexOf(initial);
  const v = VOWELS.indexOf(vowel);
  const f = FINALS.indexOf(final);
  if (i < 0 || v < 0 || f < 0) {
    throw new Error(`Invalid syllable parts: ${initial} ${vowel} ${final}`);
  }
  return String.fromCharCode(SYLLABLE_BASE + (i * VOWELS.length + v) * FINALS.length + f);
}
