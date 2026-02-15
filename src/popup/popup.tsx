import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/popup.css";

function App() {
  return (
    <div className="app">
      <h1>2Vault</h1>
      <p>AI Bookmark Digester for Obsidian</p>
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
