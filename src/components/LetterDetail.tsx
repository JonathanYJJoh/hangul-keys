import { invoke } from "@tauri-apps/api/core";
import { PRONUNCIATION } from "../hangul/pronunciation";
import type { Jamo, KeyDef } from "../keyboard/layout";
import { inTauri } from "../settings";
import { speak } from "../speech";

interface LetterDetailProps {
  keyDef?: KeyDef;
  jamo?: Jamo;
  /** Whether Shift is held, which changes what the Shift hint says. */
  shift: boolean;
  /** The Korean voice; null if none is installed, undefined while loading. */
  voice: SpeechSynthesisVoice | null | undefined;
}

function SpeakButton({
  text,
  label,
  voice,
}: {
  text: string;
  label: string;
  voice: SpeechSynthesisVoice | null | undefined;
}) {
  return (
    <button
      className="speak"
      onClick={() => voice && speak(text, voice)}
      disabled={!voice}
      title={voice ? `Hear “${text}”` : "No Korean voice installed"}
      aria-label={`${label}: hear ${text}`}
    >
      🔊
    </button>
  );
}

export function LetterDetail({ keyDef, jamo, shift, voice }: LetterDetailProps) {
  if (!keyDef || !jamo) {
    return (
      <section className="detail">
        <span className="placeholder">Click a letter to hear how it sounds</span>
      </section>
    );
  }

  const info = PRONUNCIATION[jamo.char];

  return (
    <section className="detail">
      <div className="detail-main">
        <span className="detail-char">{jamo.char}</span>
        <div>
          <div className="detail-roman">
            “{jamo.roman}” <SpeakButton text={info.sound} label="Sound" voice={voice} />
            <span className="detail-sound">as in {info.sound}</span>
          </div>
          <div className="detail-meta">
            {jamo.kind} · key <kbd>{keyDef.label}</kbd>
            {keyDef.shift && !shift && <> · Shift → {keyDef.shift.char}</>}
          </div>
        </div>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Name</dt>
          <dd>
            {info.name} <SpeakButton text={info.name} label="Name" voice={voice} />
          </dd>
        </div>
        <div>
          <dt>Example</dt>
          <dd>
            {info.example.word} <span className="muted">({info.example.meaning})</span>{" "}
            <SpeakButton text={info.example.word} label="Example" voice={voice} />
          </dd>
        </div>
      </dl>

      {info.tip && <p className="detail-tip">{info.tip}</p>}

      {voice === null && (
        <p className="detail-tip">
          No Korean voice is installed, so sounds can’t play. Add “Korean” under Language & region
          in Windows Settings, including text-to-speech.{" "}
          {inTauri && (
            <button className="link" onClick={() => invoke("open_language_settings")}>
              Open Windows settings
            </button>
          )}
        </p>
      )}
    </section>
  );
}
