import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { inTauri, type Settings } from "../settings";

const SIZES = [
  { label: "Small", scale: 0.85 },
  { label: "Medium", scale: 1 },
  { label: "Large", scale: 1.2 },
  { label: "Extra large", scale: 1.4 },
];

interface SettingsPageProps {
  settings: Settings;
  update: (change: Partial<Settings>) => void;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting">
      <div>
        <div className="setting-label">{label}</div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function SettingsPage({ settings, update }: SettingsPageProps) {
  // Undefined until checked. Re-checked on focus, in case the user just
  // installed it from Windows Settings and came back.
  const [koreanInstalled, setKoreanInstalled] = useState<boolean>();
  useEffect(() => {
    if (!inTauri) return;
    const check = () => invoke<boolean>("korean_keyboard_installed").then(setKoreanInstalled);
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  return (
    <div className="settings">
      <section className="settings-group">
        <h2>Typing in Korean</h2>
        <p className="setting-hint">
          Windows does the actual Korean typing in other apps. Hangul Keys switches it on for you
          and shows which keys to press.
        </p>

        <div className="setting">
          <div>
            <div className="setting-label">Windows Korean keyboard</div>
            <div className="setting-hint">
              {koreanInstalled === undefined
                ? "Checking…"
                : koreanInstalled
                  ? "Installed ✓"
                  : "Not installed. Add “Korean” under Language & region in Windows Settings."}
            </div>
          </div>
          {koreanInstalled === false && (
            <button className="button" onClick={() => invoke("open_language_settings")}>
              Open Windows settings
            </button>
          )}
        </div>

        <Toggle
          label="Switch to Korean when the floating keyboard opens"
          hint="Turns on the Korean keyboard in 가 mode, and switches back when it closes. Click the 한/A badge on the floating keyboard to toggle anytime."
          checked={settings.autoKorean}
          onChange={(autoKorean) => update({ autoKorean })}
        />
      </section>

      <section className="settings-group">
        <h2>Floating keyboard</h2>
        <p className="setting-hint">
          Show or hide it from anywhere with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd>. Changes here
          apply to it right away.
        </p>

        <div className="setting">
          <div className="setting-label">Transparency</div>
          <div className="setting-control">
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={Math.round(settings.overlayOpacity * 100)}
              onChange={(e) => update({ overlayOpacity: Number(e.target.value) / 100 })}
              aria-label="Overlay opacity"
            />
            <span className="setting-value">{Math.round(settings.overlayOpacity * 100)}%</span>
          </div>
        </div>

        <div className="setting">
          <div className="setting-label">Size</div>
          <div className="segmented" role="radiogroup" aria-label="Overlay size">
            {SIZES.map(({ label, scale }) => (
              <button
                key={label}
                role="radio"
                aria-checked={settings.overlayScale === scale}
                className={settings.overlayScale === scale ? "active" : ""}
                onClick={() => update({ overlayScale: scale })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Toggle
          label="Light up keys as I type in other apps"
          hint="Keys are only read while the floating keyboard is showing, and never leave your computer."
          checked={settings.highlightKeys}
          onChange={(highlightKeys) => update({ highlightKeys })}
        />

        <div className="setting">
          <div>
            <div className="setting-label">Position</div>
            <div className="setting-hint">Drag the ⠿ grip to move it.</div>
          </div>
          <button
            className="button"
            disabled={!inTauri}
            onClick={() => invoke("reset_overlay_position")}
          >
            Reset to bottom center
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2>Pronunciation</h2>
        <Toggle
          label="Say each letter when I click it"
          hint="Clicking a key on the Keyboard page plays its sound, like 가 for ㄱ. Use the 🔊 buttons to hear names and example words."
          checked={settings.speakLetters}
          onChange={(speakLetters) => update({ speakLetters })}
        />
      </section>

      <section className="settings-group">
        <h2>Keyboard labels</h2>
        <Toggle
          label="Show romanization"
          hint="The English sound under each letter, like “g” for ㄱ."
          checked={settings.showRomanization}
          onChange={(showRomanization) => update({ showRomanization })}
        />
        <Toggle
          label="Show Shift letters"
          hint="The letter Shift gives, like ㅃ in the corner of the ㅂ key."
          checked={settings.showShiftHints}
          onChange={(showShiftHints) => update({ showShiftHints })}
        />
      </section>
    </div>
  );
}
