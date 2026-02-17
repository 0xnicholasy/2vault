import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnboardingApp } from "./OnboardingApp";
import "./styles/onboarding.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OnboardingApp />
    </StrictMode>
  );
}
