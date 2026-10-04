import {
  canBeFinal,
  combineFinals,
  combineVowels,
  isConsonant,
  isVowel,
  makeSyllable,
  splitFinal,
} from "./jamo";

/** The syllable block currently being typed. Any part may be missing. */
export interface Block {
  initial?: string;
  vowel?: string;
  final?: string;
}

/** Renders a block: a full syllable when possible, otherwise the lone jamo. */
export function renderBlock({ initial, vowel, final }: Block): string {
  if (initial && vowel) return makeSyllable(initial, vowel, final);
  return (initial ?? "") + (vowel ?? "");
}

/**
 * Turns a stream of jamo keystrokes into Hangul syllables, the way a Korean
 * IME does: ㅎ ㅏ ㄴ → 한, and 한 + ㅏ → 하나.
 *
 * The composer only owns the block being typed. Whenever a keystroke finishes
 * that block, input() returns the finished text so the caller can append it.
 */
export class HangulComposer {
  /**
   * Every state the current block has passed through, oldest first.
   * Backspace pops one entry, so it undoes one keystroke (과 → 고 → ㄱ)
   * instead of deleting the whole syllable.
   */
  private history: Block[] = [];

  private get block(): Block {
    return this.history[this.history.length - 1] ?? {};
  }

  /** The in-progress syllable, e.g. "하" while typing 한. */
  get composing(): string {
    return renderBlock(this.block);
  }

  /** Feeds one jamo. Returns any text that became final ("" if none). */
  input(jamo: string): string {
    if (isConsonant(jamo)) return this.inputConsonant(jamo);
    if (isVowel(jamo)) return this.inputVowel(jamo);
    // Anything else (space, punctuation) ends the block and passes through.
    return this.commit() + jamo;
  }

  /**
   * Undoes the last keystroke of the current block. Returns false when there
   * is nothing being composed, so the caller should delete a committed char.
   */
  backspace(): boolean {
    if (this.history.length === 0) return false;
    this.history.pop();
    return true;
  }

  /** Finishes the current block and returns it. */
  commit(): string {
    const text = this.composing;
    this.history = [];
    return text;
  }

  private push(block: Block) {
    this.history.push(block);
  }

  /** Commits the current block and starts a new one from the given states. */
  private startNew(...states: Block[]): string {
    const text = this.commit();
    this.history = states;
    return text;
  }

  private inputConsonant(c: string): string {
    const { initial, vowel, final } = this.block;

    // ㄱ → 각: a consonant after initial + vowel becomes the final.
    if (initial && vowel && !final && canBeFinal(c)) {
      this.push({ initial, vowel, final: c });
      return "";
    }
    // 갈 + ㄱ → 갉: two finals can merge into a double final.
    if (initial && vowel && final) {
      const merged = combineFinals(final, c);
      if (merged) {
        this.push({ initial, vowel, final: merged });
        return "";
      }
    }
    if (!initial && !vowel) {
      this.push({ initial: c });
      return "";
    }
    // Anything else starts a new syllable with this consonant.
    return this.startNew({ initial: c });
  }

  private inputVowel(v: string): string {
    const { initial, vowel, final } = this.block;

    // A final consonant followed by a vowel moves into the next syllable:
    // 한 + ㅏ → 하나, and 닭 + ㅣ → 달기 (only the second half of ㄺ moves).
    if (initial && vowel && final) {
      const split = splitFinal(final);
      const [kept, moved] = split ?? [undefined, final];
      this.history = [{ initial, vowel, final: kept }];
      return this.startNew({ initial: moved }, { initial: moved, vowel: v });
    }
    if (vowel) {
      // ㅗ + ㅏ → ㅘ
      const merged = combineVowels(vowel, v);
      if (merged) {
        this.push({ initial, vowel: merged });
        return "";
      }
      return this.startNew({ vowel: v });
    }
    // Either an empty block or a lone initial: ㄱ + ㅏ → 가.
    this.push({ initial, vowel: v });
    return "";
  }
}

/** Convenience for tests and drills: composes a whole keystroke sequence. */
export function compose(jamos: Iterable<string>): string {
  const composer = new HangulComposer();
  let text = "";
  for (const j of jamos) text += composer.input(j);
  return text + composer.commit();
}
