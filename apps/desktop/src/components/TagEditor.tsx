import { checkTagName, fuzzyRank, tagKey } from "@lvv/core";
import { useMutation, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { api, type Id } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/** The tag field on the video detail; Edit › Edit Tags (⌘T) focuses it. */
export const TAG_INPUT_ID = "detail-tag-input";

const MAX_SUGGESTIONS = 8;

/**
 * Tags for one or more videos. Changes apply as you go. With several videos,
 * the chips are the tags all of them share, adding a tag adds it to every
 * one, and removing a chip removes it from every one (as on iOS).
 */
export function TagEditor({
  videoIds,
  inputId,
  autoFocus = false,
}: {
  videoIds: Id<"videos">[];
  inputId?: string;
  autoFocus?: boolean;
}) {
  const tags = useQuery(api.tags.list);
  const current = useQuery(api.videos.tagsForVideos, { videoIds });
  const apply = useMutation(api.tags.applyToVideos);
  const createTag = useMutation(api.tags.create);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  const shared = (tags ?? []).filter((t) => current && current.length > 0 && current.every((ids) => ids.includes(t._id)));
  const sharedIds = new Set(shared.map((t) => t._id));
  const check = checkTagName(draft);
  const q = tagKey(check.ok ? check.name : draft.trim());
  const exact = tags?.find((t) => t.nameLower === q);
  const canCreate = !!q && !exact && check.ok;

  type Option = { key: string; label: string; act: () => void; create?: boolean };
  const options: Option[] = [
    ...fuzzyRank(q, (tags ?? []).filter((t) => !sharedIds.has(t._id)), (t) => t.name)
      .slice(0, MAX_SUGGESTIONS)
      .map((t) => ({ key: t._id, label: t.name, act: () => add(t._id) })),
    ...(canCreate ? [{ key: "create", label: `Create “${q}”`, act: () => void create(), create: true }] : []),
  ];
  const at = Math.min(active, Math.max(options.length - 1, 0));

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const add = (tagId: Id<"tags">) => {
    setDraft("");
    setActive(0);
    void run(() => apply({ videoIds, add: [tagId], remove: [] }));
  };
  const remove = (tagId: Id<"tags">) => void run(() => apply({ videoIds, add: [], remove: [tagId] }));
  const create = () =>
    run(async () => {
      if (!check.ok) return;
      setDraft("");
      const tagId = await createTag({ name: check.name });
      await apply({ videoIds, add: [tagId], remove: [] });
    });

  const showList = open && draft.trim() !== "" && options.length > 0;

  return (
    <div className="tag-editor">
      <div className="tag-editor-row">
        {shared.map((t) => (
          <span key={t._id} className="tag tag-sage-solid tag-chip">
            {t.name}
            {!t.system && (
              <button className="tag-chip-x" aria-label={`Remove tag ${t.name}`} title="Remove tag" onClick={() => remove(t._id)}>
                <Icon as={X} size={12} />
              </button>
            )}
          </span>
        ))}
        <span className="tag-editor-field">
          <Icon as={Plus} size={14} />
          <input
            id={inputId}
            data-video-id={videoIds.length === 1 ? videoIds[0] : undefined}
            className="tag-editor-input"
            placeholder={shared.length ? "Add tag" : "Add a tag"}
            aria-label="Add a tag"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={showList ? `${listId}-${at}` : undefined}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            maxLength={60}
            autoCapitalize="none"
            onChange={(e) => {
              // Tags are always lowercase; show them that way as they're typed.
              setDraft(e.target.value.toLowerCase());
              setActive(0);
              setOpen(true);
              setError(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!options.length) return;
                setActive((at + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (exact) {
                  if (sharedIds.has(exact._id)) setDraft("");
                  else add(exact._id);
                } else if (showList) options[at]?.act();
                else if (draft.trim() && !check.ok) setError(check.reason);
              } else if (e.key === "Backspace" && !draft) {
                const last = shared.filter((t) => !t.system).at(-1);
                if (last) remove(last._id);
              } else if (e.key === "Escape") {
                // Clear first; a second Escape leaves the field (or closes the dialog).
                if (draft) {
                  e.stopPropagation();
                  setDraft("");
                } else if (!e.currentTarget.closest("[role=dialog]")) e.currentTarget.blur();
              }
            }}
          />
          {showList && (
            <ul className="menu tag-suggest" role="listbox" id={listId}>
              {options.map((o, i) => (
                <li
                  key={o.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === at}
                  className="menu-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== at && setActive(i)}
                  onClick={o.act}
                >
                  {o.create && <Icon as={Plus} size={14} />}
                  {o.label}
                </li>
              ))}
            </ul>
          )}
        </span>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Edit › Edit Tags with several videos selected. */
export function TagsDialog({ videoIds, onClose }: { videoIds: Id<"videos">[]; onClose: () => void }) {
  return (
    <Dialog
      title={videoIds.length === 1 ? "Tags" : `Tags for ${videoIds.length} videos`}
      onClose={onClose}
      onSubmit={onClose}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="stack">
        {videoIds.length > 1 && (
          <p className="text-muted small">The tags all of them share. Adding or removing a tag changes every one.</p>
        )}
        <TagEditor videoIds={videoIds} autoFocus />
      </div>
    </Dialog>
  );
}
