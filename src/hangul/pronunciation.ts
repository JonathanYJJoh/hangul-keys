// How each letter on the keyboard sounds, for the pronunciation panel.
//
// Speech engines read a lone jamo by its name (ㄱ → "giyeok"), so to hear a
// letter's sound we speak it inside a syllable instead: consonants with ㅏ
// (ㄱ → 가) and vowels after the silent ㅇ (ㅓ → 어).

export interface Pronunciation {
  /** The letter's Korean name, e.g. 기역 for ㄱ. */
  name: string;
  /** A syllable that demonstrates the sound, e.g. 가 for ㄱ. */
  sound: string;
  example: { word: string; meaning: string };
  /** A pointer for sounds English speakers find tricky. */
  tip?: string;
}

export const PRONUNCIATION: Record<string, Pronunciation> = {
  // Consonants
  ㄱ: { name: "기역", sound: "가", example: { word: "가방", meaning: "bag" },
    tip: "Between “g” and “k”: a soft “g” at the start of a word." },
  ㄲ: { name: "쌍기역", sound: "까", example: { word: "까치", meaning: "magpie" },
    tip: "A tense “kk”: tighten your throat and don’t let air puff out." },
  ㄴ: { name: "니은", sound: "나", example: { word: "나무", meaning: "tree" } },
  ㄷ: { name: "디귿", sound: "다", example: { word: "다리", meaning: "leg; bridge" },
    tip: "Between “d” and “t”." },
  ㄸ: { name: "쌍디귿", sound: "따", example: { word: "딸기", meaning: "strawberry" },
    tip: "A tense “tt” with no puff of air." },
  ㄹ: { name: "리을", sound: "라", example: { word: "라면", meaning: "ramen" },
    tip: "Between “r” and “l”: a quick tap of the tongue. At the end of a syllable it sounds like “l”." },
  ㅁ: { name: "미음", sound: "마", example: { word: "머리", meaning: "head" } },
  ㅂ: { name: "비읍", sound: "바", example: { word: "바다", meaning: "sea" },
    tip: "Between “b” and “p”." },
  ㅃ: { name: "쌍비읍", sound: "빠", example: { word: "빵", meaning: "bread" },
    tip: "A tense “pp” with no puff of air." },
  ㅅ: { name: "시옷", sound: "사", example: { word: "사과", meaning: "apple" },
    tip: "Before ㅣ it sounds like “sh”: 시 is “shi”." },
  ㅆ: { name: "쌍시옷", sound: "싸", example: { word: "쌀", meaning: "uncooked rice" },
    tip: "A sharper, tense “ss”." },
  ㅇ: { name: "이응", sound: "아", example: { word: "강", meaning: "river" },
    tip: "Silent at the start of a syllable (아 is just “a”), “ng” at the end (강 is “gang”)." },
  ㅈ: { name: "지읒", sound: "자", example: { word: "자동차", meaning: "car" },
    tip: "Between “j” and “ch”." },
  ㅉ: { name: "쌍지읒", sound: "짜", example: { word: "짜다", meaning: "to be salty" },
    tip: "A tense “jj” with no puff of air." },
  ㅊ: { name: "치읓", sound: "차", example: { word: "친구", meaning: "friend" },
    tip: "“ch” with a strong puff of air." },
  ㅋ: { name: "키읔", sound: "카", example: { word: "코", meaning: "nose" },
    tip: "“k” with a strong puff of air." },
  ㅌ: { name: "티읕", sound: "타", example: { word: "토끼", meaning: "rabbit" },
    tip: "“t” with a strong puff of air." },
  ㅍ: { name: "피읖", sound: "파", example: { word: "포도", meaning: "grapes" },
    tip: "“p” with a strong puff of air." },
  ㅎ: { name: "히읗", sound: "하", example: { word: "하늘", meaning: "sky" } },

  // Vowels: a vowel's name is its own sound.
  ㅏ: { name: "아", sound: "아", example: { word: "아이", meaning: "child" },
    tip: "Like “a” in “father”." },
  ㅐ: { name: "애", sound: "애", example: { word: "개", meaning: "dog" },
    tip: "Like “e” in “bed”. Most speakers say it the same as ㅔ." },
  ㅑ: { name: "야", sound: "야", example: { word: "야구", meaning: "baseball" } },
  ㅒ: { name: "얘", sound: "얘", example: { word: "얘기", meaning: "story; talk" } },
  ㅓ: { name: "어", sound: "어", example: { word: "어머니", meaning: "mother" },
    tip: "Like “u” in “up”, with a slightly open mouth." },
  ㅔ: { name: "에", sound: "에", example: { word: "게", meaning: "crab" },
    tip: "Like “e” in “bed”." },
  ㅕ: { name: "여", sound: "여", example: { word: "여름", meaning: "summer" } },
  ㅖ: { name: "예", sound: "예", example: { word: "시계", meaning: "clock" } },
  ㅗ: { name: "오", sound: "오", example: { word: "오이", meaning: "cucumber" },
    tip: "Like “o” in “go”, with rounded lips and no “w” at the end." },
  ㅛ: { name: "요", sound: "요", example: { word: "요리", meaning: "cooking" } },
  ㅜ: { name: "우", sound: "우", example: { word: "우유", meaning: "milk" },
    tip: "Like “oo” in “moon”." },
  ㅠ: { name: "유", sound: "유", example: { word: "유리", meaning: "glass" } },
  ㅡ: { name: "으", sound: "으", example: { word: "음악", meaning: "music" },
    tip: "Say “oo” but with your lips spread flat, not rounded." },
  ㅣ: { name: "이", sound: "이", example: { word: "이름", meaning: "name" },
    tip: "Like “ee” in “see”." },
};
