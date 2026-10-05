import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Keyboard } from "./components/Keyboard";
import "./App.css";
import "./overlay.css";

/** False when the page is opened in a normal browser for development. */
const inTauri = "__TAURI_INTERNALS__" in window;

const OPACITY_LEVELS = [1, 0.75, 0.5, 0.3];

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
  const [collapsed, setCollapsed] = useState(() => loadSetting("overlay.collapsed", false));
  const [opacity, setOpacity] = useState(() => loadSetting("overlay.opacity", 0));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => saveSetting("overlay.collapsed", collapsed), [collapsed]);
  useEffect(() => saveSetting("overlay.opacity", opacity), [opacity]);

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
  }, [collapsed]);

  const level = OPACITY_LEVELS[opacity % OPACITY_LEVELS.length];

  return (
    <div className="overlay" ref={root}>
      {collapsed ? (
        <div className="toolbar collapsed" data-clickable>
          <span className="grip" onMouseDown={startDrag} title="Drag to move">
            ⠿
          </span>
          <button onClick={() => setCollapsed(false)} title="Show toolbar">
            ▾
          </button>
        </div>
      ) : (
        <div className="toolbar" data-clickable>
          <span className="grip" onMouseDown={startDrag} title="Drag to move">
            ⠿ <span className="toolbar-title">Hangul Keys</span>
          </span>
          <button onClick={() => invoke("open_main_window")} title="Open the Hangul Keys app">
            ↗ Open app
          </button>
          <button
            onClick={() => setOpacity((o) => (o + 1) % OPACITY_LEVELS.length)}
            title="Change transparency"
          >
            ◐ {Math.round(level * 100)}%
          </button>
          <button onClick={() => setCollapsed(true)} title="Hide toolbar">
            ▴
          </button>
          <button onClick={() => invoke("hide_overlay")} title="Hide overlay (Ctrl+Alt+K)">
            ✕
          </button>
        </div>
      )}

      {/* The overlay never has focus, so it can't see keystrokes yet; for now
          it is a static map. Global key listening will light keys up later. */}
      <div style={{ opacity: level }}>
        <Keyboard pressed={new Set()} shift={false} variant="compact" />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
