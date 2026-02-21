import { StrictMode, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  IoSettingsSharp,
  IoBookmarks,
  IoStatsChart,
  IoInformationCircleOutline,
  IoGlobeOutline,
  IoLogoGithub,
} from "react-icons/io5";
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);
  const aboutBtnRef = useRef<HTMLButtonElement>(null);

  // Close about dropdown on click outside or Escape
  useEffect(() => {
    if (!aboutOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !aboutRef.current?.contains(e.target as Node) &&
        !aboutBtnRef.current?.contains(e.target as Node)
      ) {
        setAboutOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAboutOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [aboutOpen]);

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
        <div className="about-wrapper">
          <button
            ref={aboutBtnRef}
            className="about-button"
            onClick={() => setAboutOpen((v) => !v)}
            aria-label="About 2Vault"
            aria-expanded={aboutOpen}
            aria-haspopup="menu"
          >
            <IoInformationCircleOutline />
          </button>
          {aboutOpen && (
            <div ref={aboutRef} className="about-dropdown" role="menu">
              <a
                href="https://www.2vault.dev/"
                className="about-dropdown-link"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  chrome.tabs.create({ url: "https://www.2vault.dev/" });
                }}
              >
                <IoGlobeOutline />
                <span>Visit 2Vault Website</span>
              </a>
              <div className="about-dropdown-divider" />
              <a
                href="https://github.com/0xnicholasy/2vault"
                className="about-dropdown-link"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  chrome.tabs.create({ url: "https://github.com/0xnicholasy/2vault" });
                }}
              >
                <IoLogoGithub />
                <span>View on GitHub</span>
              </a>
              <div className="about-dropdown-divider" />
              <div className="about-dropdown-footer">
                Built by <strong>0xnicholasy</strong>
              </div>
            </div>
          )}
        </div>
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
