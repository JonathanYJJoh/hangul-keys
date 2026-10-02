import { ROWS, jamoFor, type KeyDef } from "../keyboard/layout";

interface KeyboardProps {
  /** KeyboardEvent.code values currently held down. */
  pressed: Set<string>;
  shift: boolean;
  selected?: string;
  onSelect?: (key: KeyDef) => void;
}

export function Keyboard({ pressed, shift, selected, onSelect }: KeyboardProps) {
  return (
    <div className="keyboard" role="group" aria-label="Korean keyboard">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map((key) => {
            const jamo = jamoFor(key, shift);
            const classes = [
              "key",
              jamo ? jamo.kind : "plain",
              pressed.has(key.code) ? "pressed" : "",
              selected === key.code ? "selected" : "",
              shift && key.shift ? "shifted" : "",
            ].join(" ");

            return (
              <button
                key={key.code}
                className={classes}
                style={{ flexGrow: key.width ?? 1 }}
                onClick={() => jamo && onSelect?.(key)}
                tabIndex={-1}
                title={jamo ? `${key.label} → ${jamo.char} (${jamo.roman})` : undefined}
              >
                <span className="key-en">{key.label}</span>
                {jamo && <span className="key-ko">{jamo.char}</span>}
                {jamo && <span className="key-roman">{jamo.roman}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
