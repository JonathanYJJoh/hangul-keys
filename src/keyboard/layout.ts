// Dubeolsik (두벌식) — the standard Korean keyboard layout.
// Keys are identified by KeyboardEvent.code so the mapping follows the
// physical key, regardless of the OS input language.

export type JamoKind = "consonant" | "vowel";

export interface Jamo {
  char: string;
  /** Revised Romanization of the sound, e.g. "g/k" for ㄱ. */
  roman: string;
  kind: JamoKind;
}

export interface KeyDef {
  code: string;
  label: string;
  /** Korean letter on this key (no Shift). */
  base?: Jamo;
  /** Korean letter with Shift held, only for the 7 keys that have one. */
  shift?: Jamo;
  /** Relative width in key units (default 1). */
  width?: number;
}

const c = (char: string, roman: string): Jamo => ({ char, roman, kind: "consonant" });
const v = (char: string, roman: string): Jamo => ({ char, roman, kind: "vowel" });

export const ROWS: KeyDef[][] = [
  [
    { code: "Backquote", label: "`" },
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => ({
      code: `Digit${d}`,
      label: d,
    })),
    { code: "Minus", label: "-" },
    { code: "Equal", label: "=" },
    { code: "Backspace", label: "Backspace", width: 2 },
  ],
  [
    { code: "Tab", label: "Tab", width: 1.5 },
    { code: "KeyQ", label: "Q", base: c("ㅂ", "b"), shift: c("ㅃ", "pp") },
    { code: "KeyW", label: "W", base: c("ㅈ", "j"), shift: c("ㅉ", "jj") },
    { code: "KeyE", label: "E", base: c("ㄷ", "d"), shift: c("ㄸ", "tt") },
    { code: "KeyR", label: "R", base: c("ㄱ", "g"), shift: c("ㄲ", "kk") },
    { code: "KeyT", label: "T", base: c("ㅅ", "s"), shift: c("ㅆ", "ss") },
    { code: "KeyY", label: "Y", base: v("ㅛ", "yo") },
    { code: "KeyU", label: "U", base: v("ㅕ", "yeo") },
    { code: "KeyI", label: "I", base: v("ㅑ", "ya") },
    { code: "KeyO", label: "O", base: v("ㅐ", "ae"), shift: v("ㅒ", "yae") },
    { code: "KeyP", label: "P", base: v("ㅔ", "e"), shift: v("ㅖ", "ye") },
    { code: "BracketLeft", label: "[" },
    { code: "BracketRight", label: "]" },
    { code: "Backslash", label: "\\", width: 1.5 },
  ],
  [
    { code: "CapsLock", label: "Caps", width: 1.75 },
    { code: "KeyA", label: "A", base: c("ㅁ", "m") },
    { code: "KeyS", label: "S", base: c("ㄴ", "n") },
    { code: "KeyD", label: "D", base: c("ㅇ", "ng") },
    { code: "KeyF", label: "F", base: c("ㄹ", "r/l") },
    { code: "KeyG", label: "G", base: c("ㅎ", "h") },
    { code: "KeyH", label: "H", base: v("ㅗ", "o") },
    { code: "KeyJ", label: "J", base: v("ㅓ", "eo") },
    { code: "KeyK", label: "K", base: v("ㅏ", "a") },
    { code: "KeyL", label: "L", base: v("ㅣ", "i") },
    { code: "Semicolon", label: ";" },
    { code: "Quote", label: "'" },
    { code: "Enter", label: "Enter", width: 2.25 },
  ],
  [
    { code: "ShiftLeft", label: "Shift", width: 2.25 },
    { code: "KeyZ", label: "Z", base: c("ㅋ", "k") },
    { code: "KeyX", label: "X", base: c("ㅌ", "t") },
    { code: "KeyC", label: "C", base: c("ㅊ", "ch") },
    { code: "KeyV", label: "V", base: c("ㅍ", "p") },
    { code: "KeyB", label: "B", base: v("ㅠ", "yu") },
    { code: "KeyN", label: "N", base: v("ㅜ", "u") },
    { code: "KeyM", label: "M", base: v("ㅡ", "eu") },
    { code: "Comma", label: "," },
    { code: "Period", label: "." },
    { code: "Slash", label: "/" },
    { code: "ShiftRight", label: "Shift", width: 2.75 },
  ],
  [{ code: "Space", label: "Space", width: 6.25 }],
];

/** The Korean letter a key produces, taking Shift into account. */
export function jamoFor(key: KeyDef, shift: boolean): Jamo | undefined {
  return shift && key.shift ? key.shift : key.base;
}

const BY_CODE = new Map(ROWS.flat().map((k) => [k.code, k]));

export function keyByCode(code: string): KeyDef | undefined {
  return BY_CODE.get(code);
}

/** Which key types a letter, and whether Shift is needed: ㅃ → Q with Shift. */
export function keyForJamo(char: string): { key: KeyDef; shift: boolean } | undefined {
  if (char === " ") return { key: BY_CODE.get("Space")!, shift: false };
  for (const key of BY_CODE.values()) {
    if (key.base?.char === char) return { key, shift: false };
    if (key.shift?.char === char) return { key, shift: true };
  }
  return undefined;
}

/** The letter (or " ") a keypress types, or undefined for other keys. */
export function typedJamo(code: string, shift: boolean): string | undefined {
  if (code === "Space") return " ";
  const key = keyByCode(code);
  return key && jamoFor(key, shift)?.char;
}
