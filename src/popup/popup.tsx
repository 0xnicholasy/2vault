import { StrictMode, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsSharp, IoBookmarks, IoStatsChart } from "react-icons/io5";
import type { ProcessingState } from "@/background/messages.ts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Settings } from "./components/Settings";
import { BookmarkBrowser } from "./components/BookmarkBrowser";
import { ProcessingModal } from "./components/ProcessingModal";
import { StatusTab } from "./components/StatusTab";
import { getProcessingState, getLocalStorage, isFirstTimeUser } from "@/utils/storage";
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
  { id: "bookmarks", label: "Bookmarks", icon: <IoBookmarks />, disabled: false },
  { id: "status", label: "Status", icon: <IoStatsChart />, disabled: false },
];

function App() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("bookmarks");
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | undefined>();

  // Redirect first-time users to onboarding
  useEffect(() => {
    isFirstTimeUser().then((firstTime) => {
      if (firstTime) {
        chrome.runtime.sendMessage({ type: "OPEN_ONBOARDING" });
        window.close();
      } else {
        setReady(true);
      }
    });
  }, []);

  // Check for active processing on mount
  useEffect(() => {
    getProcessingState().then((state) => {
      if (state) {
        setProcessingState(state);
        if (state.active) {
          setShowModal(true);
        }
      }
    });
  }, []);

  // Auto-process URL from context menu or keyboard shortcut failure
  useEffect(() => {
    getLocalStorage("pendingCaptureUrl").then((url) => {
      if (url) {
        chrome.storage.local.remove("pendingCaptureUrl");
        chrome.runtime.sendMessage(
          { type: "START_PROCESSING", urls: [url] },
          (response) => {
            if (response?.type === "PROCESSING_STARTED") {
              setShowModal(true);
            } else {
              // Batch already active - prefill URL for later retry
              setInitialUrl(url);
              setActiveTab("bookmarks");
              setShowModal(true);
            }
          }
        );
      }
    });
  }, []);

  // Listen for processing state changes
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes["processingState"]?.newValue) {
        const newState = changes["processingState"].newValue as ProcessingState;
        setProcessingState(newState);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleStartProcessing = useCallback((urls: string[]) => {
    chrome.runtime.sendMessage(
      { type: "START_PROCESSING", urls },
      (response) => {
        if (response?.type === "PROCESSING_STARTED") {
          setShowModal(true);
        }
      }
    );
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleSwitchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  const isProcessing = processingState?.active ?? false;

  if (!ready) {
    return (
      <div className="app">
        <div className="placeholder">Loading...</div>
      </div>
    );
  }

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

      <div className={`tab-content ${activeTab === "settings" ? "" : "tab-hidden"}`}>
        <ErrorBoundary>
          <Settings />
        </ErrorBoundary>
      </div>
      <div className={`tab-content ${activeTab === "bookmarks" ? "" : "tab-hidden"}`}>
        <ErrorBoundary>
          <BookmarkBrowser
            onProcess={handleStartProcessing}
            processing={isProcessing}
            initialUrl={initialUrl}
          />
        </ErrorBoundary>
      </div>
      <div className={`tab-content ${activeTab === "status" ? "" : "tab-hidden"}`}>
        <ErrorBoundary>
          <StatusTab
            processingState={processingState}
            onProcess={handleStartProcessing}
            onSwitchTab={handleSwitchTab}
          />
        </ErrorBoundary>
      </div>

      {showModal && processingState && (
        <ProcessingModal
          initialState={processingState}
          onClose={handleCloseModal}
        />
      )}
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
