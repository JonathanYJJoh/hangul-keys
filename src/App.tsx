import { useEffect, useRef, useState } from "react";
import { Keyboard } from "./components/Keyboard";
import { HangulComposer } from "./hangul/composer";
import { jamoFor, keyByCode, type KeyDef } from "./keyboard/layout";
import "./App.css";

function App() {
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [shift, setShift] = useState(false);
  const [selected, setSelected] = useState<KeyDef>();
  // Finished text, plus the syllable still being typed (shown underlined).
  const [text, setText] = useState("");
  const [composing, setComposing] = useState("");
  const composer = useRef(new HangulComposer());

  useEffect(() => {
    const engine = composer.current;

    // Engine calls stay outside state updaters, which React may run twice.
    const type = (input: string) => {
      const done = engine.input(input);
      if (done) setText((t) => t + done);
      setComposing(engine.composing);
    };

    const down = (e: KeyboardEvent) => {
      setShift(e.shiftKey);
      setPressed((prev) => new Set(prev).add(e.code));

      if (e.code === "Backspace") {
        if (!engine.backspace()) setText((t) => t.slice(0, -1));
        setComposing(engine.composing);
        return;
      }
      if (e.code === "Space") return type(" ");
      if (e.code === "Enter") return type("\n");

      const key = keyByCode(e.code);
      const jamo = key && jamoFor(key, e.shiftKey);
      if (key && jamo && !e.repeat) {
        type(jamo.char);
        setSelected(key);
      }
    };
    const up = (e: KeyboardEvent) => {
      // e.shiftKey can still read true on the Shift key's own keyup.
      setShift(e.key === "Shift" ? false : e.shiftKey);
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };
    // Releasing keys while the window is unfocused would leave them "stuck".
    const reset = () => {
      setPressed(new Set());
      setShift(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const selectedJamo = selected && jamoFor(selected, shift && !!selected.shift);

  return (
    <main className="app">
      <header>
        <h1>
          Hangul Keys <span className="ko">한글 키</span>
        </h1>
        <p className="hint">
          Type on your keyboard or click a key. Hold <kbd>Shift</kbd> for ㅃ ㅉ ㄸ ㄲ ㅆ ㅒ ㅖ.
        </p>
        <p className="hint">
          Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> anywhere to show or hide the floating
          keyboard. Closing this window keeps Hangul Keys running in the system tray.
        </p>
      </header>

      <section className="output" aria-live="polite">
        {text || composing ? (
          <>
            {text}
            {composing && <span className="composing">{composing}</span>}
          </>
        ) : (
          <span className="placeholder">Start typing…</span>
        )}
        <span className="caret" />
      </section>

      <section className="detail">
        {selected && selectedJamo ? (
          <>
            <span className="detail-char">{selectedJamo.char}</span>
            <div>
              <div className="detail-roman">“{selectedJamo.roman}”</div>
              <div className="detail-meta">
                {selectedJamo.kind} · key <kbd>{selected.label}</kbd>
                {selected.shift && !shift && <> · Shift → {selected.shift.char}</>}
              </div>
            </div>
          </>
        ) : (
          <span className="placeholder">Select a letter to see how it sounds</span>
        )}
      </section>

      <Keyboard
        pressed={pressed}
        shift={shift}
        selected={selected?.code}
        onSelect={setSelected}
      />

      <footer className="legend">
        <span className="swatch consonant" /> consonants (left hand)
        <span className="swatch vowel" /> vowels (right hand)
      </footer>
    </main>
  );
}

export default App;
