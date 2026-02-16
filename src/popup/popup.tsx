import { StrictMode, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsSharp, IoBookmarks, IoStatsChart } from "react-icons/io5";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Settings } from "./components/Settings";
import "./styles/popup.css";

type Tab = "settings" | "bookmarks" | "status";

interface TabDef {
  id: Tab;
  label: string;
  icon: ReactNode;
  disabled: boolean;
}

const TABS: TabDef[] = [
  { id: "settings", label: "Settings", icon: <IoSettingsSharp />, disabled: false },
  { id: "bookmarks", label: "Bookmarks", icon: <IoBookmarks />, disabled: true },
  { id: "status", label: "Status", icon: <IoStatsChart />, disabled: true },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  return (
    <div className="app">
      <header className="app-header">
        <h1>2Vault</h1>
      </header>

      <nav className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""} ${tab.disabled ? "disabled" : ""}`}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <ErrorBoundary>
          {activeTab === "settings" && <Settings />}
          {activeTab === "bookmarks" && <div className="placeholder">Bookmarks (Sprint 2.2)</div>}
          {activeTab === "status" && <div className="placeholder">Status (Sprint 2.4)</div>}
        </ErrorBoundary>
      </main>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
