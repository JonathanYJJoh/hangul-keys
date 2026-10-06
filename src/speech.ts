import { useEffect, useState } from "react";

// Speaks Korean with the browser's Web Speech API, which uses the Windows
// text-to-speech voices (Korean is "Microsoft Heami").

/** A little slower than normal, so learners can hear each sound. */
const LEARNER_RATE = 0.8;

function findKoreanVoice(): SpeechSynthesisVoice | undefined {
  if (!("speechSynthesis" in window)) return undefined;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ko"));
}

/**
 * The Korean voice, or null if none is installed. Undefined while voices are
 * still loading, since browsers load them asynchronously.
 */
export function useKoreanVoice(): SpeechSynthesisVoice | null | undefined {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null | undefined>(() =>
    findKoreanVoice(),
  );

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setVoice(null);
      return;
    }
    const update = () => {
      const found = findKoreanVoice();
      // An empty list means "not loaded yet", not "no Korean voice".
      if (found || speechSynthesis.getVoices().length > 0) setVoice(found ?? null);
    };
    update();
    speechSynthesis.addEventListener("voiceschanged", update);
    return () => speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  return voice;
}

/** Says Korean text, interrupting anything still being spoken. */
export function speak(text: string, voice: SpeechSynthesisVoice) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = LEARNER_RATE;
  speechSynthesis.speak(utterance);
}
