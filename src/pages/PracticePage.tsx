import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "../components/Keyboard";
import { compose } from "../hangul/composer";
import { decompose } from "../hangul/jamo";
import { PRONUNCIATION } from "../hangul/pronunciation";
import { keyForJamo, ROWS, typedJamo } from "../keyboard/layout";
import {
  expectedKey,
  isFinished,
  press,
  promptForText,
  startDrill,
  summarize,
  type DrillState,
  type Prompt,
} from "../practice/drill";
import { mergeStats, pickLetters, shuffleTake, weakestKeys, weakness } from "../practice/stats";
import {
  addSession,
  loadKeyStats,
  loadSessions,
  saveKeyStats,
  type DrillMode,
  type SessionRecord,
} from "../practice/storage";
import { WORDS } from "../practice/words";
import type { Settings } from "../settings";
import { speak, useKoreanVoice } from "../speech";

/** Every letter on the keyboard, including the Shift letters. */
const ALL_LETTERS = ROWS.flat().flatMap((k) => [k.base?.char, k.shift?.char].filter((c) => c !== undefined));

const MODES: { mode: DrillMode; title: string; description: string }[] = [
  {
    mode: "letters",
    title: "Letter drill",
    description: "A letter appears; press its key. Letters you miss or find slowly come up more often.",
  },
  {
    mode: "listening",
    title: "Listening drill",
    description: "Hear a letter's sound and press its key, without seeing it.",
  },
  {
    mode: "words",
    title: "Word typing",
    description: "Type real Korean words and phrases, and watch each syllable build as you go.",
  },
];

const MODE_TITLES = Object.fromEntries(MODES.map((m) => [m.mode, m.title])) as Record<DrillMode, string>;

function makePrompts(mode: DrillMode, letterPool: string[]): Prompt[] {
  const stats = loadKeyStats();
  switch (mode) {
    case "letters":
      return pickLetters(letterPool, stats, 20).map((l) => promptForText(l));
    case "listening":
      return pickLetters(letterPool, stats, 15).map((l) => promptForText(l));
    case "words":
      return shuffleTake(WORDS, 10).map((w) => promptForText(w.word, w.meaning));
  }
}

/** How many characters of `text` are fully typed after `position` keystrokes. */
function completedChars(text: string, position: number): number {
  let keys = 0;
  let count = 0;
  for (const char of text) {
    keys += decompose(char).length;
    if (keys > position) break;
    count++;
  }
  return count;
}

/** Loads a remembered UI preference; storage may be unavailable. */
function loadPref(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Not saved; the toggle still works for this session.
  }
}

type View =
  | { kind: "menu" }
  | { kind: "drill"; mode: DrillMode; prompts: Prompt[]; pool: string[] }
  | { kind: "results"; mode: DrillMode; drill: DrillState; pool: string[]; previousBest: number };

export function PracticePage({ settings }: { settings: Settings }) {
  const [view, setView] = useState<View>({ kind: "menu" });
  const [keyStats, setKeyStats] = useState(loadKeyStats);
  const [sessions, setSessions] = useState(loadSessions);
  const [showHints, setShowHints] = useState(() => loadPref("practice.showHints", true));
  const voice = useKoreanVoice();

  useEffect(() => savePref("practice.showHints", showHints), [showHints]);

  const start = (mode: DrillMode, pool = ALL_LETTERS) =>
    setView({ kind: "drill", mode, prompts: makePrompts(mode, pool), pool });

  const finish = (mode: DrillMode, drill: DrillState, pool: string[]) => {
    const stats = mergeStats(loadKeyStats(), drill.keys);
    saveKeyStats(stats);
    setKeyStats(stats);
    const previousBest = Math.max(0, ...sessions.filter((s) => s.mode === mode).map((s) => s.keysPerMinute));
    setSessions(addSession({ mode, date: new Date().toISOString(), ...summarize(drill) }));
    setView({ kind: "results", mode, drill, pool, previousBest });
  };

  if (view.kind === "drill") {
    return (
      <DrillView
        key={view.prompts.map((p) => p.text).join()}
        mode={view.mode}
        prompts={view.prompts}
        showHints={showHints}
        settings={settings}
        voice={voice}
        onFinish={(drill) => finish(view.mode, drill, view.pool)}
        onQuit={() => setView({ kind: "menu" })}
      />
    );
  }

  if (view.kind === "results") {
    return (
      <Results
        mode={view.mode}
        drill={view.drill}
        previousBest={view.previousBest}
        onAgain={() => start(view.mode, view.pool)}
        onDrillKeys={(keys) => start("letters", keys)}
        onMenu={() => setView({ kind: "menu" })}
      />
    );
  }

  const weakest = weakestKeys(keyStats, 6);

  return (
    <div className="practice">
      <div className="mode-cards">
        {MODES.map(({ mode, title, description }) => (
          <button
            key={mode}
            className="mode-card"
            onClick={() => start(mode)}
            disabled={mode === "listening" && !voice}
            title={mode === "listening" && !voice ? "Needs a Korean voice (see the Keyboard page)" : undefined}
          >
            <span className="mode-title">{title}</span>
            <span className="mode-description">{description}</span>
            <BestScore sessions={sessions} mode={mode} />
          </button>
        ))}
      </div>

      <label className="setting">
        <div>
          <div className="setting-label">Show the next key on the keyboard</div>
          <div className="setting-hint">Turn this off once you know the layout, to test yourself.</div>
        </div>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={showHints}
          onChange={(e) => setShowHints(e.target.checked)}
        />
      </label>

      <section className="settings-group">
        <h2>Your weakest letters</h2>
        {weakest.length > 0 ? (
          <>
            <p className="setting-hint">The letters you miss most or take longest to find.</p>
            <div className="chips">
              {weakest.map((k) => (
                <span key={k} className="chip">
                  {k}
                </span>
              ))}
              <button className="button" onClick={() => start("letters", weakest)}>
                Practice these
              </button>
            </div>
          </>
        ) : (
          <p className="setting-hint">Finish a drill or two and your trickiest letters will show up here.</p>
        )}
      </section>
    </div>
  );
}

function BestScore({ sessions, mode }: { sessions: SessionRecord[]; mode: DrillMode }) {
  const mine = sessions.filter((s) => s.mode === mode);
  if (mine.length === 0) return <span className="mode-best">Not played yet</span>;
  const best = Math.max(...mine.map((s) => s.keysPerMinute));
  return (
    <span className="mode-best">
      Best {best} keys/min · {mine.length} {mine.length === 1 ? "session" : "sessions"}
    </span>
  );
}

interface DrillViewProps {
  mode: DrillMode;
  prompts: Prompt[];
  showHints: boolean;
  settings: Settings;
  voice: SpeechSynthesisVoice | null | undefined;
  onFinish: (drill: DrillState) => void;
  onQuit: () => void;
}

function DrillView({ mode, prompts, showHints, settings, voice, onFinish, onQuit }: DrillViewProps) {
  const [drill, setDrill] = useState(() => startDrill(prompts));
  const [shift, setShift] = useState(false);
  const prompt = drill.prompts[Math.min(drill.index, drill.prompts.length - 1)];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      setShift(e.shiftKey);
      if (e.code === "Escape") return onQuit();
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const jamo = typedJamo(e.code, e.shiftKey);
      if (jamo === undefined) return;
      e.preventDefault(); // Keep Space from scrolling or clicking buttons.
      const now = performance.now();
      setDrill((d) => press(d, jamo, now));
    };
    const up = (e: KeyboardEvent) => setShift(e.key === "Shift" ? false : e.shiftKey);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onQuit]);

  // Report the result exactly once, even if this re-renders while finishing.
  const reported = useRef(false);
  useEffect(() => {
    if (isFinished(drill) && !reported.current) {
      reported.current = true;
      onFinish(drill);
    }
  }, [drill, onFinish]);

  // Listening drill: say each new letter.
  const sound = mode === "listening" ? PRONUNCIATION[prompt.text]?.sound : undefined;
  useEffect(() => {
    if (sound && voice) speak(sound, voice);
  }, [drill.index, sound, voice]);

  const targets = useMemo(() => {
    const next = expectedKey(drill);
    const where = next !== undefined ? keyForJamo(next) : undefined;
    // Showing the key up front would give away a listening question, so
    // there it only appears after a wrong guess.
    const reveal = mode !== "listening" || drill.lastWrong !== undefined;
    if (!showHints || !reveal || !where) return undefined;
    return new Set(where.shift ? [where.key.code, "ShiftLeft", "ShiftRight"] : [where.key.code]);
  }, [drill, showHints, mode]);

  const wrong = drill.lastWrong !== undefined ? keyForJamo(drill.lastWrong)?.key.code : undefined;
  const { accuracy } = summarize(drill, performance.now());
  // What the learner has typed of this word, as it would appear in a text box.
  const typed = compose(prompt.keys.slice(0, drill.position));
  const done = completedChars(prompt.text, drill.position);

  return (
    <div className="drill">
      <div className="drill-status">
        <span>
          {MODE_TITLES[mode]} · {Math.min(drill.index + 1, drill.prompts.length)} / {drill.prompts.length}
        </span>
        <span>{drill.correct + drill.misses > 0 && `${Math.round(accuracy * 100)}% accuracy`}</span>
        <button className="button" onClick={onQuit}>
          Quit <kbd>Esc</kbd>
        </button>
      </div>

      <div className={`drill-prompt ${drill.lastWrong !== undefined ? "missed" : ""}`}>
        {mode === "listening" ? (
          <button
            className="listen"
            onClick={() => sound && voice && speak(sound, voice)}
            title="Hear it again"
          >
            🔊
          </button>
        ) : mode === "words" ? (
          <>
            <div className="drill-word">
              <span className="typed">{[...prompt.text].slice(0, done).join("")}</span>
              {[...prompt.text].slice(done).join("")}
            </div>
            <div className="drill-meaning">{prompt.meaning}</div>
            <div className="drill-input">
              {typed}
              <span className="caret" />
            </div>
          </>
        ) : (
          <div className="drill-letter">{prompt.text}</div>
        )}
        <div className="drill-hint">
          {drill.startedAt === undefined
            ? mode === "listening"
              ? "Listen, then press the letter's key."
              : "Press the key to start."
            : drill.lastWrong !== undefined
              ? "Not quite. Try again."
              : " "}
        </div>
      </div>

      <Keyboard
        pressed={new Set()}
        shift={shift}
        targets={targets}
        wrong={wrong}
        showRomanization={settings.showRomanization}
        showShiftHints={settings.showShiftHints}
      />
    </div>
  );
}

interface ResultsProps {
  mode: DrillMode;
  drill: DrillState;
  previousBest: number;
  onAgain: () => void;
  onDrillKeys: (keys: string[]) => void;
  onMenu: () => void;
}

function Results({ mode, drill, previousBest, onAgain, onDrillKeys, onMenu }: ResultsProps) {
  const { accuracy, keysPerMinute, durationMs } = summarize(drill);
  const missed = Object.entries(drill.keys)
    .filter(([key, r]) => r.misses > 0 && key !== " ")
    .sort(([, a], [, b]) => weakness(b) - weakness(a))
    .map(([key]) => key)
    .slice(0, 6);
  const newBest = previousBest > 0 && keysPerMinute > previousBest;

  return (
    <div className="results">
      <h2>{MODE_TITLES[mode]} complete</h2>
      {newBest && <p className="new-best">New personal best! (previously {previousBest} keys/min)</p>}

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{keysPerMinute}</span>
          <span className="stat-label">keys per minute</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{Math.round(accuracy * 100)}%</span>
          <span className="stat-label">accuracy</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{(durationMs / 1000).toFixed(1)}s</span>
          <span className="stat-label">time</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{drill.misses}</span>
          <span className="stat-label">mistakes</span>
        </div>
      </div>

      {missed.length > 0 && (
        <section className="settings-group">
          <h2>Letters to work on</h2>
          <div className="chips">
            {missed.map((k) => (
              <span key={k} className="chip">
                {k}
              </span>
            ))}
            <button className="button" onClick={() => onDrillKeys(missed)}>
              Drill these
            </button>
          </div>
        </section>
      )}

      <div className="results-actions">
        <button className="button primary" onClick={onAgain}>
          Play again
        </button>
        <button className="button" onClick={onMenu}>
          Back to practice
        </button>
      </div>
    </div>
  );
}
