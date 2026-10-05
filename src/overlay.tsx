import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Keyboard } from "./components/Keyboard";
import { inTauri, useSettings } from "./settings";
import "./App.css";
import "./overlay.css";

/** Mirrors `InputMode` in src-tauri/src/input_lang.rs. */
type InputMode = "hangul" | "latin" | "other" | "missing";

const MODE_BADGES: Record<InputMode, { label: string; title: string }> = {
  hangul: { label: "한", title: "Typing Korean. Click to type English letters." },
  latin: { label: "A", title: "Korean keyboard in English mode. Click to type Korean." },
  other: { label: "EN", title: "Not using the Korean keyboard. Click to switch to Korean." },
  missing: {
    label: "한?",
    title: "The Windows Korean keyboard isn't installed. Click to open language settings.",
  },
};

/** Levels the toolbar's ◐ button steps through. */
const OPACITY_LEVELS = [1, 0.75, 0.5, 0.3];

/** The next level down from the current opacity, wrapping back to 100%. */
function nextOpacity(current: number): number {
  return OPACITY_LEVELS.find((level) => level < current - 0.01) ?? OPACITY_LEVELS[0];
}

/** Reads a remembered setting; storage can be unavailable, so never throw. */
function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not worth surfacing: the setting just won't be remembered.
  }
}

/** Starts a native window drag, so the whole overlay follows the mouse. */
function startDrag(e: React.MouseEvent) {
  if (e.button === 0 && inTauri) getCurrentWindow().startDragging();
}

function Overlay() {
  const [settings, updateSettings] = useSettings();
  // Collapsing the toolbar is a quick overlay-only choice, not an app setting.
  const [collapsed, setCollapsed] = useState(() => loadSetting("overlay.collapsed", false));
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<InputMode>();
  const root = useRef<HTMLDivElement>(null);

  // The overlay never has focus, so keys come from the system-wide keyboard
  // hook in Rust rather than from DOM keydown events.
  useEffect(() => {
    if (!inTauri) return;
    const unlisteners = [
      listen<{ code: string; down: boolean }>("global-key", ({ payload }) => {
        setPressed((prev) => {
          if (payload.down === prev.has(payload.code)) return prev; // key repeat
          const next = new Set(prev);
          if (payload.down) next.add(payload.code);
          else next.delete(payload.code);
          return next;
        });
      }),
      listen("overlay-shown", () => setPressed(new Set())),
      listen<InputMode>("input-mode", ({ payload }) => setMode(payload)),
    ];
    return () => {
      for (const u of unlisteners) u.then((stop) => stop());
    };
  }, []);

  // Turning highlighting off mid-press would leave keys lit.
  useEffect(() => {
    if (!settings.highlightKeys) setPressed(new Set());
  }, [settings.highlightKeys]);

  useEffect(() => saveSetting("overlay.collapsed", collapsed), [collapsed]);

  // Tell Rust which areas should catch the mouse. Everything else, including
  // the keys, stays click-through.
  useLayoutEffect(() => {
    if (!inTauri || !root.current) return;
    const report = () => {
      const regions = [...root.current!.querySelectorAll("[data-clickable]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      invoke("set_overlay_hit_regions", { regions });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [collapsed, settings.overlayScale]);

  const opacity = settings.overlayOpacity;
  const badge = mode && MODE_BADGES[mode];
  const modeBadge = badge && (
    <button
      className={`mode-badge ${mode}`}
      title={badge.title}
      onClick={() => invoke(mode === "missing" ? "open_language_settings" : "toggle_hangul")}
    >
      {badge.label}
    </button>
  );

  return (
    // Rust resizes the window for the size setting; zoom scales the content.
    <div className="overlay" ref={root} style={{ zoom: settings.overlayScale }}>
      {collapsed ? (
        <div className="toolbar collapsed" data-clickable>
          <span className="grip" onMouseDown={startDrag} title="Drag to move">
            ⠿
          </span>
          {modeBadge}
          <button onClick={() => setCollapsed(false)} title="Show toolbar">
            ▾
          </button>
        </div>
      ) : (
        <div className="toolbar" data-clickable>
          <span className="grip" onMouseDown={startDrag} title="Drag to move">
            ⠿ <span className="toolbar-title">Hangul Keys</span>
          </span>
          {modeBadge}
          <button onClick={() => invoke("open_main_window")} title="Open the Hangul Keys app">
            ↗ Open app
          </button>
          <button
            onClick={() => updateSettings({ overlayOpacity: nextOpacity(opacity) })}
            title="Change transparency"
          >
            ◐ {Math.round(opacity * 100)}%
          </button>
          <button onClick={() => setCollapsed(true)} title="Hide toolbar">
            ▴
          </button>
          <button onClick={() => invoke("hide_overlay")} title="Hide overlay (Ctrl+Alt+K)">
            ✕
          </button>
        </div>
      )}

      <div style={{ opacity }}>
        <Keyboard
          pressed={pressed}
          shift={pressed.has("ShiftLeft") || pressed.has("ShiftRight")}
          variant="compact"
          showRomanization={settings.showRomanization}
          showShiftHints={settings.showShiftHints}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
