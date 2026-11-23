import { parseTimestamp, parseYouTubeUrl, thumbnailUrl, timestampPrefill } from "@lvv/core";
import { useEffect, useRef, useState } from "react";
import { api, type FolderDoc, type Id, type LookupResult } from "@/lib/api";
import { rememberSaved, showBadge } from "@/lib/badge";
import { isNotSignedIn, saveErrorMessage } from "@/lib/errors";
import { takePendingLink } from "@/lib/messages";
import { authedClient, NotSignedInError, signOut } from "@/lib/session";
import { cleanTabTitle, oembed, pageVideo, playerSeconds } from "@/lib/youtube";
import { FolderSelect } from "./FolderSelect";

/** The video the popup is about: the open tab, a right-clicked link, or a pasted one. */
type Source = {
  input: string;
  videoId: string;
  /** Set when it's the video playing in the open tab (the timestamp comes from its player). */
  tabId?: number;
  title: string;
  channel: string;
};

async function resolveSource(): Promise<Source | null> {
  const link = await takePendingLink();
  const linked = link ? parseYouTubeUrl(link) : null;
  if (link && linked) return { input: link, videoId: linked.videoId, title: "", channel: "" };

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const video = pageVideo(tab?.url);
  if (tab?.id !== undefined && tab.url && video) {
    return { input: tab.url, videoId: video.videoId, tabId: tab.id, title: cleanTabTitle(tab.title), channel: "" };
  }
  return null;
}

/** Update the ✓ on every tab showing this video, not just the one we came from. */
async function markSaved(videoId: string) {
  await rememberSaved(videoId, true);
  const tabs = await browser.tabs.query({ url: "https://*.youtube.com/*" });
  await Promise.all(
    tabs.filter((t) => t.id !== undefined && pageVideo(t.url)?.videoId === videoId).map((t) => showBadge(t.id!, true)),
  );
}

const closeSoon = () => setTimeout(() => window.close(), 1200);

export function Capture() {
  const [source, setSource] = useState<Source | null | undefined>(undefined);
  const [folders, setFolders] = useState<FolderDoc[]>([]);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [folderId, setFolderId] = useState<Id<"folders"> | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verb: string; where: string } | null>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  /** Signed out on the server (or no session): drop ours so the popup shows sign-in. */
  const handle = async (err: unknown) => {
    if (err instanceof NotSignedInError || isNotSignedIn(err)) await signOut();
    else setError(saveErrorMessage(err));
  };

  useEffect(() => {
    void resolveSource().then(setSource);
    void authedClient()
      .then((c) => c.query(api.folders.list, {}))
      .then(setFolders)
      .catch(handle);
  }, []);

  // Once we know the video: where it lives, its title, and the player time.
  useEffect(() => {
    if (!source) return;
    let live = true;
    setLookup(null);
    setError(null);
    void (async () => {
      try {
        const client = await authedClient();
        const [found, seconds, meta] = await Promise.all([
          client.query(api.videos.lookup, { input: source.input }),
          source.tabId !== undefined ? playerSeconds(source.tabId) : Promise.resolve(null),
          source.title ? Promise.resolve(null) : oembed(source.videoId),
        ]);
        if (!live) return;
        setLookup(found);
        if (found.status !== "new") {
          setFolderId(found.folderId ?? undefined);
          setNotes(found.notes);
        }
        setTime(timestampPrefill(seconds));
        if (meta) setSource((s) => (s ? { ...s, title: meta.title, channel: meta.channel } : s));
      } catch (err) {
        if (live) await handle(err);
      }
    })();
    return () => {
      live = false;
    };
    // Only when the video changes, not when its title fills in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.input]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!source || !lookup || busy) return;
    const timeText = time.trim();
    const seconds = timeText ? parseTimestamp(timeText) : undefined;
    if (timeText && seconds === undefined) {
      setError("Use a time like 12:34 or 1:02:03, or clear it.");
      timeRef.current?.focus();
      return;
    }
    const existing = lookup.status !== "new";
    setBusy(true);
    setError(null);
    try {
      const client = await authedClient();
      const result = await client.mutation(api.videos.capture, {
        input: source.input,
        folderId,
        notes: existing ? notes : notes.trim() || undefined,
        update: existing || undefined,
        timestamp: seconds !== undefined ? { seconds, label } : undefined,
      });
      await markSaved(source.videoId);
      const where = folders.find((f) => f._id === result.folderId)?.name ?? "Inbox";
      const verb = result.status === "added" ? "Saved" : result.status === "restored" ? "Restored" : "Updated";
      setDone({ verb, where });
      closeSoon();
    } catch (err) {
      await handle(err);
      setBusy(false);
    }
  };

  const onPaste = (text: string) => {
    setPasted(text);
    const parsed = parseYouTubeUrl(text);
    if (parsed) setSource({ input: text.trim(), videoId: parsed.videoId, title: "", channel: "" });
  };

  if (done) {
    return (
      <div className="done">
        <h4>{done.verb} ✓</h4>
        <p className="text-muted">
          {done.verb === "Updated" ? "In" : "To"} {done.where}
        </p>
      </div>
    );
  }

  const header = (
    <div className="head">
      <h4>Save to Vault</h4>
    </div>
  );

  const footer = (
    <div className="foot">
      <span>⌥⇧V opens this</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );

  if (source === undefined) return header;

  if (source === null) {
    return (
      <div>
        {header}
        <div className="field">
          <label htmlFor="paste">No YouTube video on this page. Paste a link:</label>
          <input id="paste" className="input" placeholder="https://youtu.be/…" value={pasted}
            onChange={(e) => onPaste(e.target.value)} autoFocus />
        </div>
        {pasted.trim() && !parseYouTubeUrl(pasted) && <p className="field-error">That doesn't look like a YouTube link.</p>}
        {error && <p className="field-error">{error}</p>}
        {footer}
      </div>
    );
  }

  const existing = lookup && lookup.status !== "new" ? lookup : null;

  return (
    <form onSubmit={save}>
      {header}
      <div className="video">
        <img src={thumbnailUrl(source.videoId, "mqdefault")} alt="" />
        <div>
          <div className="video-title">{source.title || "YouTube video"}</div>
          {source.channel && <div className="video-channel">{source.channel}</div>}
        </div>
      </div>

      {existing?.status === "saved" && (
        <div className="notice">
          Already saved in <strong>{existing.folderName ?? "Inbox"}</strong>. Saving updates its folder and note
          {time.trim() ? " and adds this timestamp" : ""}.
        </div>
      )}
      {existing?.status === "trashed" && <div className="notice">This video is in the Trash. Saving restores it.</div>}

      <div className="field">
        <label htmlFor="folder">Folder</label>
        <FolderSelect id="folder" folders={folders} value={folderId} onChange={setFolderId} />
      </div>

      <div className="field">
        <label htmlFor="notes">Note</label>
        <textarea id="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }} />
      </div>

      <div className="field">
        <label htmlFor="time">Timestamp</label>
        <div className="stamp">
          <input id="time" ref={timeRef} className="input time" placeholder="none" value={time}
            onChange={(e) => setTime(e.target.value)} inputMode="numeric" />
          {time.trim() ? (
            <>
              <input className="input" aria-label="Timestamp description" placeholder="Description (optional)"
                value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Clear timestamp"
                title="Clear timestamp" onClick={() => { setTime(""); setLabel(""); }}>
                ×
              </button>
            </>
          ) : (
            <span className="text-muted" style={{ fontSize: 12 }}>Type a time to add one</span>
          )}
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={() => window.close()}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!lookup || busy}>
          {busy ? "Saving…" : existing?.status === "saved" ? "Update" : "Save"}
        </button>
      </div>
      {footer}
    </form>
  );
}
