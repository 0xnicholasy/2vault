import { useState } from "react";
import { IoClose, IoAddCircleOutline } from "react-icons/io5";
import type { TagGroup } from "@/core/types";

interface TagGroupEditorProps {
  tagGroups: TagGroup[];
  onChange: (groups: TagGroup[]) => void;
}

export function TagGroupEditor({ tagGroups, onChange }: TagGroupEditorProps) {
  const [tagInputs, setTagInputs] = useState<Record<number, string>>({});

  const addGroup = () => {
    onChange([...tagGroups, { name: "", tags: [] }]);
  };

  const removeGroup = (index: number) => {
    onChange(tagGroups.filter((_, i) => i !== index));
  };

  const updateGroupName = (index: number, name: string) => {
    const updated = tagGroups.map((g, i) => (i === index ? { ...g, name } : g));
    onChange(updated);
  };

  const addTag = (groupIndex: number, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;

    const group = tagGroups[groupIndex];
    if (!group || group.tags.includes(trimmed)) return;

    const updated = tagGroups.map((g, i) =>
      i === groupIndex ? { ...g, tags: [...g.tags, trimmed] } : g
    );
    onChange(updated);
    setTagInputs((prev) => ({ ...prev, [groupIndex]: "" }));
  };

  const removeTag = (groupIndex: number, tagIndex: number) => {
    const updated = tagGroups.map((g, i) =>
      i === groupIndex
        ? { ...g, tags: g.tags.filter((_, ti) => ti !== tagIndex) }
        : g
    );
    onChange(updated);
  };

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    groupIndex: number
  ) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(groupIndex, tagInputs[groupIndex] ?? "");
    }
  };

  return (
    <div className="tag-group-editor">
      {tagGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="tag-group-item">
          <div className="tag-group-header">
            <input
              type="text"
              value={group.name}
              onChange={(e) => updateGroupName(groupIndex, e.target.value)}
              placeholder="Group name"
            />
            <button
              type="button"
              className="tag-group-remove"
              onClick={() => removeGroup(groupIndex)}
              aria-label="Remove group"
            >
              <IoClose />
            </button>
          </div>
          <div className="tag-chips">
            {group.tags.map((tag, tagIndex) => (
              <span key={tag} className="tag-chip">
                {tag}
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => removeTag(groupIndex, tagIndex)}
                  aria-label={`Remove tag ${tag}`}
                >
                  <IoClose />
                </button>
              </span>
            ))}
            <input
              type="text"
              className="tag-input"
              value={tagInputs[groupIndex] ?? ""}
              onChange={(e) =>
                setTagInputs((prev) => ({
                  ...prev,
                  [groupIndex]: e.target.value,
                }))
              }
              onKeyDown={(e) => handleTagKeyDown(e, groupIndex)}
              placeholder="Add tag..."
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={addGroup}
      >
        <IoAddCircleOutline /> Add Group
      </button>
    </div>
  );
}
