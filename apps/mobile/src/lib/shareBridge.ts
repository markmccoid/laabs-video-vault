/**
 * The app's side of the iOS Share Extension (apps/mobile/targets/share).
 * The extension can't use the Convex client, so the app hands it what it needs
 * through the App Group: a share token (Keychain, docs/adr/0001), the
 * HTTP-actions URL, and a folder snapshot. In return it leaves the Share
 * Queue: saves that couldn't reach the server, which the app sends here.
 *
 * Keep the names in sync with targets/share/Shared.swift.
 */
import { ExtensionStorage } from "@bacons/apple-targets";
import { buildFolderTree, convexSiteUrl, type FolderNode } from "@lvv/core";
import { useAction, useConvex, useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { api, type Doc, type Id } from "@/lib/api";

const APP_GROUP = "group.com.markmccoid.laabs-video-vault";
const KEYS = { siteUrl: "convexSiteUrl", folders: "folders", queue: "shareQueue" } as const;

const TOKEN_KEY = "shareToken";
const TOKEN_ID_KEY = "shareTokenId";
const sharedKeychain: SecureStore.SecureStoreOptions = { keychainService: "lvvShare", accessGroup: APP_GROUP };

const enabled = Platform.OS === "ios";
const storage = new ExtensionStorage(APP_GROUP);

type QueuedShare = { url: string; folderId?: string; notes?: string; update?: boolean; sharedAt: number };

function readQueue(): QueuedShare[] {
  try {
    const parsed: unknown = JSON.parse(storage.get(KEYS.queue) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((q): q is QueuedShare => typeof q?.url === "string") : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedShare[]) {
  storage.set(KEYS.queue, queue.length ? JSON.stringify(queue) : undefined);
}

/** Folders flattened in display order, as the extension's picker shows them. */
function flatten(nodes: FolderNode<Doc<"folders">>[]): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((n) => [{ id: n._id, name: n.name, depth: n.depth }, ...flatten(n.children)]);
}

export type QueueReport = { added: number; dropped: number };

/**
 * Mount once inside the signed-in app. Keeps the extension's token, URL, and
 * folders current, and sends the Share Queue whenever the app is foregrounded.
 */
export function useShareBridge(onQueueSent: (report: QueueReport) => void) {
  const { isAuthenticated } = useConvexAuth();
  const createToken = useAction(api.shareTokens.create);
  const folders = useQuery(api.folders.list, enabled && isAuthenticated ? {} : "skip");
  const sendQueue = useSendQueue();
  const report = useRef(onQueueSent);
  report.current = onQueueSent;

  // Token + URL, once per sign-in.
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;
    storage.set(KEYS.siteUrl, convexSiteUrl(process.env.EXPO_PUBLIC_CONVEX_URL!));
    void (async () => {
      if (await SecureStore.getItemAsync(TOKEN_KEY, sharedKeychain)) return;
      const { token, tokenId } = await createToken({});
      await SecureStore.setItemAsync(TOKEN_KEY, token, sharedKeychain);
      await SecureStore.setItemAsync(TOKEN_ID_KEY, tokenId);
    })().catch((err) => console.warn("Couldn't set up the share extension:", err));
  }, [isAuthenticated, createToken]);

  // Folder snapshot, whenever folders change.
  useEffect(() => {
    if (folders) storage.set(KEYS.folders, JSON.stringify(flatten(buildFolderTree(folders))));
  }, [folders]);

  // Share Queue, on launch and every return to the foreground.
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;
    const run = () =>
      void sendQueue().then((r) => {
        if (r.added || r.dropped) report.current(r);
      });
    run();
    const sub = AppState.addEventListener("change", (state) => state === "active" && run());
    return () => sub.remove();
  }, [isAuthenticated, sendQueue]);
}

/** Send every queued share. Items that fail for a network reason stay queued. */
function useSendQueue() {
  const convex = useConvex();
  const sending = useRef(false);
  return useCallback(async (): Promise<QueueReport> => {
    const result = { added: 0, dropped: 0 };
    if (!enabled || sending.current) return result;
    sending.current = true;
    try {
      const queue = readQueue();
      const remaining: QueuedShare[] = [];
      for (const item of queue) {
        const save = (folderId: string | undefined) =>
          convex.mutation(api.videos.saveShared, {
            input: item.url,
            folderId: folderId as Id<"folders"> | undefined,
            notes: item.notes,
            update: item.update,
          });
        try {
          let saved;
          try {
            saved = await save(item.folderId);
          } catch (err) {
            // A malformed folder id fails argument validation: save to the Inbox instead.
            if (!item.folderId || err instanceof ConvexError || !/Validator|ArgumentValidation/i.test(String(err))) throw err;
            saved = await save(undefined);
          }
          if (saved.status !== "duplicate") result.added++;
        } catch (err) {
          // ConvexError = the server rejected it for good (e.g. not a YouTube link). Anything else: retry later.
          if (err instanceof ConvexError) result.dropped++;
          else remaining.push(item);
        }
      }
      // The extension may have queued more while we were sending.
      const sent = new Set(queue.map((q) => q.url));
      const newer = readQueue().filter((q) => !sent.has(q.url));
      writeQueue([...remaining, ...newer]);
      return result;
    } finally {
      sending.current = false;
    }
  }, [convex]);
}

/**
 * Run before signing out: send what's queued, then (once the caller confirms
 * anything left may be discarded) revoke this device's token and clear the
 * extension's data so it shows "Sign in first".
 */
export function useShareSignOut() {
  const sendQueue = useSendQueue();
  const convex = useConvex();

  const pendingAfterSend = useCallback(async () => {
    if (!enabled) return 0;
    await sendQueue();
    return readQueue().length;
  }, [sendQueue]);

  const teardown = useCallback(async () => {
    if (!enabled) return;
    const tokenId = await SecureStore.getItemAsync(TOKEN_ID_KEY);
    if (tokenId) {
      await convex.mutation(api.shareTokens.revoke, { tokenId: tokenId as Id<"shareTokens"> }).catch(() => {});
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY, sharedKeychain);
    await SecureStore.deleteItemAsync(TOKEN_ID_KEY);
    for (const key of Object.values(KEYS)) storage.remove(key);
  }, [convex]);

  return { pendingAfterSend, teardown };
}
