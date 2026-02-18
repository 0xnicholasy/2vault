import {
  IoBanOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoEllipsisHorizontal,
  IoHourglass,
  IoWarning,
} from "react-icons/io5";
import type { UrlStatus, ProcessingState } from "@/background/messages.ts";
import { generateFilename } from "@/core/note-formatter";

export function StatusIcon({ status }: { status: UrlStatus }) {
  switch (status) {
    case "done":
      return <IoCheckmarkCircle className="status-icon status-icon-done" />;
    case "review":
      return <IoWarning className="status-icon status-icon-review" />;
    case "failed":
      return <IoCloseCircle className="status-icon status-icon-failed" />;
    case "skipped":
      return <IoBanOutline className="status-icon status-icon-skipped" />;
    case "queued":
      return <IoHourglass className="status-icon status-icon-queued" />;
    default:
      return <IoEllipsisHorizontal className="status-icon status-icon-active" />;
  }
}

export function getUrlStatus(
  url: string,
  state: ProcessingState
): UrlStatus {
  return state.urlStatuses[url] ?? "queued";
}

const STATUS_LABELS: Record<UrlStatus, string> = {
  queued: "Queued",
  checking: "Checking",
  extracting: "Reading",
  processing: "Summarizing",
  creating: "Saving",
  done: "Done",
  review: "Needs Review",
  failed: "Failed",
  skipped: "Skipped",
};

export function statusDisplayLabel(status: UrlStatus): string {
  return STATUS_LABELS[status];
}

export function formatUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname.length > 30
      ? parsed.pathname.slice(0, 30) + "..."
      : parsed.pathname);
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "..." : url;
  }
}

export function buildObsidianUri(
  vaultName: string,
  folder: string,
  title: string
): string {
  const filename = generateFilename(title);
  const filePath = `${folder}/${filename}`.replace(/\.md$/, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}
