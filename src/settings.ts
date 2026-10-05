import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** False when a page is opened in a normal browser for development. */
export const inTauri = "__TAURI_INTERNALS__" in window;

/** Mirrors `Settings` in src-tauri/src/settings.rs. */
export interface Settings {
  overlayOpacity: number;
  overlayScale: number;
  highlightKeys: boolean;
  autoKorean: boolean;
  showRomanization: boolean;
  showShiftHints: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  overlayOpacity: 1,
  overlayScale: 1,
  highlightKeys: true,
  autoKorean: true,
  showRomanization: true,
  showShiftHints: true,
};

/**
 * The app's settings, kept in sync across windows. Rust owns the saved copy;
 * every change is broadcast, so the overlay updates while you edit settings.
 */
export function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Lets update() merge into the newest settings without being recreated.
  const latest = useRef(settings);
  latest.current = settings;

  useEffect(() => {
    if (!inTauri) return;
    invoke<Settings>("get_settings").then(setSettings);
    const stop = listen<Settings>("settings-changed", ({ payload }) => setSettings(payload));
    return () => {
      stop.then((unlisten) => unlisten());
    };
  }, []);

  const update = useCallback((change: Partial<Settings>) => {
    const next = { ...latest.current, ...change };
    setSettings(next); // Show the change immediately, before Rust confirms.
    if (inTauri) {
      invoke<Settings>("update_settings", { settings: next }).catch((e) =>
        console.error("Failed to save settings", e),
      );
    }
  }, []);

  return [settings, update];
}
