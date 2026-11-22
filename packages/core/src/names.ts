/** Name rules for folders and tags, shared by the backend (enforced) and the apps (pre-checked). */

export const MAX_FOLDER_NAME_LENGTH = 60;
export const MAX_TAG_NAME_LENGTH = 40;

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Trim and collapse whitespace. */
function tidy(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function checkFolderName(raw: string): NameCheck {
  const name = tidy(raw);
  if (!name) return { ok: false, reason: "Folder name can't be empty." };
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return { ok: false, reason: `Folder names can be at most ${MAX_FOLDER_NAME_LENGTH} characters.` };
  }
  return { ok: true, name };
}

/**
 * Tags are shown as `#name`, so a leading `#` the user typed is dropped.
 * Tags are always lowercase: whatever case is typed, this returns the name
 * lowercased, and that's what gets stored.
 */
export function checkTagName(raw: string): NameCheck {
  const name = tidy(raw).replace(/^#+/, "").trim().toLowerCase();
  if (!name) return { ok: false, reason: "Tag name can't be empty." };
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return { ok: false, reason: `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.` };
  }
  if (name.includes("#")) return { ok: false, reason: "Tag names can't contain #." };
  return { ok: true, name };
}

/** Case-insensitive identity for a tag (stored as `tags.nameLower`). */
export function tagKey(name: string): string {
  return name.toLowerCase();
}
