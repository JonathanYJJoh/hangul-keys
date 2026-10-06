import { useState } from "react";
import { PracticePage } from "./pages/PracticePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TypingPage } from "./pages/TypingPage";
import { useSettings } from "./settings";
import "./App.css";

const PAGES = [
  { id: "typing", label: "Keyboard" },
  { id: "practice", label: "Practice" },
  { id: "settings", label: "Settings" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

function App() {
  const [page, setPage] = useState<PageId>("typing");
  const [settings, updateSettings] = useSettings();

  return (
    <main className="app">
      <nav className="topbar">
        <h1>
          Hangul Keys <span className="ko">한글 키</span>
        </h1>
        <div className="tabs" role="tablist">
          {PAGES.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={page === id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {page === "typing" && <TypingPage settings={settings} />}
      {page === "practice" && <PracticePage settings={settings} />}
      {page === "settings" && <SettingsPage settings={settings} update={updateSettings} />}
    </main>
  );
}

export default App;
