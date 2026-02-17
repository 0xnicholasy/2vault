import { useState, useEffect, useCallback } from "react";
import {
  IoChevronForward,
  IoChevronDown,
  IoFolder,
  IoLink,
} from "react-icons/io5";
import { getConfig } from "@/utils/storage";

interface BookmarkFolder {
  id: string;
  title: string;
  urls: { id: string; title: string; url: string }[];
  children: BookmarkFolder[];
}

interface BookmarkBrowserProps {
  onProcess: (urls: string[]) => void;
  processing: boolean;
  initialUrl?: string;
}

function parseUrls(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const valid: string[] = [];
  for (const line of lines) {
    try {
      new URL(line);
      valid.push(line);
    } catch {
      // skip invalid URLs
    }
  }
  return [...new Set(valid)];
}

function flattenUrls(folder: BookmarkFolder): string[] {
  const urls = folder.urls.map((u) => u.url);
  for (const child of folder.children) {
    urls.push(...flattenUrls(child));
  }
  return urls;
}

function countUrls(folder: BookmarkFolder): number {
  return flattenUrls(folder).length;
}

function buildTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): BookmarkFolder[] {
  const folders: BookmarkFolder[] = [];

  for (const node of nodes) {
    if (!node.children) continue;

    const folder: BookmarkFolder = {
      id: node.id,
      title: node.title || "Bookmarks",
      urls: [],
      children: [],
    };

    for (const child of node.children) {
      if (child.url) {
        folder.urls.push({
          id: child.id,
          title: child.title || child.url,
          url: child.url,
        });
      } else if (child.children) {
        folder.children.push(...buildTree([child]));
      }
    }

    folders.push(folder);
  }

  return folders;
}

function FolderNode({
  folder,
  selectedUrls,
  onToggleUrl,
  onProcessFolder,
  processing,
}: {
  folder: BookmarkFolder;
  selectedUrls: Set<string>;
  onToggleUrl: (url: string) => void;
  onProcessFolder: (urls: string[]) => void;
  processing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const urlCount = countUrls(folder);

  if (urlCount === 0) return null;

  return (
    <div className="folder-node">
      <div className="folder-row" onClick={() => setExpanded((v) => !v)}>
        <span className="folder-toggle">
          {expanded ? <IoChevronDown /> : <IoChevronForward />}
        </span>
        <IoFolder className="folder-icon" />
        <span className="folder-title">{folder.title}</span>
        <span className="folder-count">{urlCount}</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onProcessFolder(flattenUrls(folder));
          }}
          disabled={processing || urlCount === 0}
        >
          Process
        </button>
      </div>

      {expanded && (
        <div className="folder-contents">
          {folder.urls.map((bookmark) => (
            <label key={bookmark.id} className="bookmark-item">
              <input
                type="checkbox"
                checked={selectedUrls.has(bookmark.url)}
                onChange={() => onToggleUrl(bookmark.url)}
              />
              <IoLink className="bookmark-icon" />
              <span className="bookmark-title" title={bookmark.url}>
                {bookmark.title}
              </span>
            </label>
          ))}
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedUrls={selectedUrls}
              onToggleUrl={onToggleUrl}
              onProcessFolder={onProcessFolder}
              processing={processing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BookmarkBrowser({
  onProcess,
  processing,
  initialUrl,
}: BookmarkBrowserProps) {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [directUrls, setDirectUrls] = useState("");
  const [parsedUrls, setParsedUrls] = useState<string[]>([]);

  useEffect(() => {
    getConfig().then((config) => {
      if (!config.apiKey || !config.vaultApiKey) {
        setConfigMissing(true);
      }
    });
  }, []);

  useEffect(() => {
    chrome.bookmarks.getTree().then((tree) => {
      const root = tree[0]?.children ?? [];
      setFolders(buildTree(root));
      setLoading(false);
    });
  }, []);

  // Prefill URL textarea from context menu failure
  useEffect(() => {
    if (initialUrl) {
      setDirectUrls(initialUrl);
      setParsedUrls(parseUrls(initialUrl));
    }
  }, [initialUrl]);

  const toggleUrl = useCallback((url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }, []);

  const handleProcessSelected = useCallback(() => {
    const urls = Array.from(selectedUrls);
    if (urls.length > 0) {
      onProcess(urls);
    }
  }, [selectedUrls, onProcess]);

  const handleProcessFolder = useCallback(
    (urls: string[]) => {
      onProcess(urls);
    },
    [onProcess]
  );

  const handleDirectUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setDirectUrls(text);
      setParsedUrls(parseUrls(text));
    },
    []
  );

  if (configMissing) {
    return (
      <div className="config-guard">
        <p>
          Configure your API keys in the Settings tab to start processing
          bookmarks.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="placeholder">Loading bookmarks...</div>;
  }

  return (
    <div className="bookmark-browser">
      <div className="direct-url-input">
        <label htmlFor="directUrls">Paste URLs (one per line)</label>
        <textarea
          id="directUrls"
          value={directUrls}
          onChange={handleDirectUrlChange}
          placeholder={"https://example.com/article\nhttps://..."}
          rows={3}
        />
        <div className="direct-url-actions">
          <span className="url-count">
            {parsedUrls.length} valid URL{parsedUrls.length !== 1 ? "s" : ""}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onProcess(parsedUrls)}
            disabled={processing || parsedUrls.length === 0}
          >
            Process URLs
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <>
          <div className="url-divider">or browse bookmarks</div>

          {selectedUrls.size > 0 && (
            <div className="bookmark-actions">
              <button
                className="btn btn-primary"
                onClick={handleProcessSelected}
                disabled={processing}
              >
                Process Selected ({selectedUrls.size})
              </button>
            </div>
          )}

          <div className="bookmark-tree">
            {folders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                selectedUrls={selectedUrls}
                onToggleUrl={toggleUrl}
                onProcessFolder={handleProcessFolder}
                processing={processing}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
