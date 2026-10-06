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

/** Reverses a pair table: { "ㄹㄱ": "ㄺ" } → { ㄺ: ["ㄹ", "ㄱ"] }. */
const splitTable = (pairs: Record<string, string>): Record<string, [string, string]> =>
  Object.fromEntries(Object.entries(pairs).map(([pair, merged]) => [merged, [pair[0], pair[1]]]));

const SPLIT_VOWELS = splitTable(COMPOUND_VOWELS);
const SPLIT_FINALS = splitTable(COMPOUND_FINALS);

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

/**
 * The keys typed to produce a character, in order: the reverse of composing.
 * Compound vowels and double finals take two keys: 과 → ㄱ ㅗ ㅏ, 닭 → ㄷ ㅏ ㄹ ㄱ.
 * Lone jamo and other characters (like spaces) are typed as themselves.
 */
export function decompose(char: string): string[] {
  const code = char.charCodeAt(0) - SYLLABLE_BASE;
  const syllableCount = INITIALS.length * VOWELS.length * FINALS.length;
  if (char.length !== 1 || code < 0 || code >= syllableCount) {
    const split = SPLIT_VOWELS[char] ?? SPLIT_FINALS[char];
    return split ? [...split] : [char];
  }

  const initial = INITIALS[Math.floor(code / (VOWELS.length * FINALS.length))];
  const vowel = VOWELS[Math.floor(code / FINALS.length) % VOWELS.length];
  const final = FINALS[code % FINALS.length];
  return [
    initial,
    ...(SPLIT_VOWELS[vowel] ?? [vowel]),
    ...(final ? (SPLIT_FINALS[final] ?? [final]) : []),
  ];
}

/** The keys typed to produce a whole string, e.g. "한글" → ㅎ ㅏ ㄴ ㄱ ㅡ ㄹ. */
export const keystrokesFor = (text: string): string[] => [...text].flatMap(decompose);

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
