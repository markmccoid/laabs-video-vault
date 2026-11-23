import { forgetAll, isSaved, showBadge } from "@/lib/badge";
import { PENDING_LINK_TTL_MS, type Message } from "@/lib/messages";
import { onSessionChange } from "@/lib/session";
import { pageVideo, VIDEO_LINK_PATTERNS } from "@/lib/youtube";

const MENU_ID = "save-to-vault";

export default defineBackground(() => {
  // A right-clicked link, handed to the popup it opens.
  let pending: { url: string; at: number } | null = null;

  browser.runtime.onInstalled.addListener(() => {
    // 0.1.0 stored one session for any deployment; sessions are now per deployment.
    void browser.storage.local.remove("session");
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Save to Vault",
      contexts: ["link"],
      targetUrlPatterns: VIDEO_LINK_PATTERNS,
    });
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== MENU_ID || !info.linkUrl) return;
    pending = { url: info.linkUrl, at: Date.now() };
    // Call openPopup straight away so it still counts as the user's click.
    browser.action.openPopup().catch(() =>
      browser.windows.create({ url: browser.runtime.getURL("/popup.html"), type: "popup", width: 380, height: 560 }),
    );
  });

  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type !== "takePendingLink") return;
    const fresh = pending && Date.now() - pending.at < PENDING_LINK_TTL_MS ? pending.url : null;
    pending = null;
    sendResponse(fresh);
  });

  // ✓ badge: only the active tab, only watch and Shorts pages.
  async function refresh(tabId: number, url: string | undefined) {
    const video = pageVideo(url);
    if (!video) return showBadge(tabId, false);
    try {
      await showBadge(tabId, await isSaved(video.videoId));
    } catch {
      await showBadge(tabId, false); // Signed out or offline: no mark.
    }
  }

  async function refreshActive() {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== undefined) await refresh(tab.id, tab.url);
  }

  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    // YouTube navigates without reloading, so a URL change is the signal.
    if (tab.active && (change.url || change.status === "complete")) void refresh(tabId, tab.url);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs.get(tabId).then((tab) => refresh(tabId, tab.url));
  });

  onSessionChange(() => {
    void forgetAll().then(refreshActive);
  });
});
