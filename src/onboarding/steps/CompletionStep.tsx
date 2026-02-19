import { IoCheckmarkCircle } from "react-icons/io5";
import type { OnboardingData } from "../hooks/useOnboardingState";

interface Props {
  data: OnboardingData;
}

export function CompletionStep({ data }: Props) {
  return (
    <div className="step-content">
      <h2>You're all set!</h2>

      <div className="completion-checklist">
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Obsidian vault connected at {data.vaultUrl}</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>AI provider configured (OpenRouter)</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Organization: {data.vaultOrganization === "para" ? "PARA" : "Custom"}</span>
        </div>
        <div className="checklist-item">
          <IoCheckmarkCircle className="checklist-icon" />
          <span>Summary detail: Standard</span>
        </div>
      </div>

      <div className="completion-nudge">
        <p>
          Pick a small bookmark folder (5-10 bookmarks) and click <strong>Process</strong> to see 2Vault in action. You can adjust summary detail level and other settings anytime.
        </p>
      </div>

      <div className="status-guide">
        <h3>Understanding Status Types</h3>
        <ul className="status-list">
          <li>
            <strong>Success:</strong> Note created successfully in your vault
          </li>
          <li>
            <strong>Review:</strong> Note saved, but content extraction was incomplete (e.g., login required, bot protection). You can review and verify in your vault.
          </li>
          <li>
            <strong>Skipped:</strong> URL already exists in your vault or was filtered out
          </li>
          <li>
            <strong>Timeout:</strong> Page took too long to load (30+ seconds)
          </li>
          <li>
            <strong>Failed:</strong> Processing failed due to network errors, API issues, or page restrictions
          </li>
        </ul>
      </div>
    </div>
  );
}
