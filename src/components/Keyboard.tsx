import { ROWS, jamoFor, type KeyDef } from "../keyboard/layout";

/** The overlay only needs the three letter rows, without the plain keys. */
const COMPACT_ROWS = ROWS.slice(1, 4).map((row) => row.filter((k) => k.base));

interface KeyboardProps {
  /** KeyboardEvent.code values currently held down. */
  pressed: Set<string>;
  shift: boolean;
  selected?: string;
  onSelect?: (key: KeyDef) => void;
  /** "compact" shows only the Korean letter keys, for the overlay. */
  variant?: "full" | "compact";
  showRomanization?: boolean;
  showShiftHints?: boolean;
  /** Keys to highlight as "press this next" (practice hints). */
  targets?: Set<string>;
  /** A key to flash as a wrong press. */
  wrong?: string;
}

export function Keyboard({
  pressed,
  shift,
  selected,
  onSelect,
  variant = "full",
  showRomanization = true,
  showShiftHints = true,
  targets,
  wrong,
}: KeyboardProps) {
  const rows = variant === "compact" ? COMPACT_ROWS : ROWS;

  return (
    <div className={`keyboard ${variant}`} role="group" aria-label="Korean keyboard">
      {rows.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map((key) => {
            const jamo = jamoFor(key, shift);
            const classes = [
              "key",
              jamo ? jamo.kind : "plain",
              pressed.has(key.code) ? "pressed" : "",
              selected === key.code ? "selected" : "",
              shift && key.shift ? "shifted" : "",
              targets?.has(key.code) ? "target" : "",
              wrong === key.code ? "wrong" : "",
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
                {showShiftHints && key.shift && !shift && (
                  <span className="key-shift">{key.shift.char}</span>
                )}
                {jamo && <span className="key-ko">{jamo.char}</span>}
                {showRomanization && jamo && <span className="key-roman">{jamo.roman}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
