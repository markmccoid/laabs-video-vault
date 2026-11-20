# LAABS Video Vault

A personal library for saving, organizing, and finding YouTube videos.

## Language

**Video**:
A YouTube video saved in a user's library, identified by its YouTube video ID. A user can save a given YouTube video at most once.
_Avoid_: Item, link, bookmark (bookmark means a timestamp within a video)

**Inbox**:
Where a **Video** lives when it isn't in any folder. New captures land here unless a folder is chosen.
_Avoid_: Unsorted, uncategorized

**Just Added**:
A view listing every **Video** captured in the last 12 hours, whichever folder it's in. A video restored from Trash by capturing it again counts as just added; restoring it from the Trash view doesn't. It's a view, not a folder: videos can't be moved into it.
_Avoid_: Recent, new, Just Added folder

**Capture**:
Getting a YouTube link from outside the app into the library: pasting, sharing from another app, the clipboard, or Shortcuts. Every capture route ends in the same "add a video" behavior (duplicate detection, restore from Trash, metadata fetch).
_Avoid_: Import (reserved for `.vfolder` files)

**Share Extension**:
The app's entry in the iOS share sheet. It shows the shared video and lets the user pick a folder (Inbox by default) and add a note, then save or cancel. Nothing is saved until the user taps Save. If the video is already saved, it says where it is and offers to update its folder and note instead. It never opens the main app.

**Share Queue**:
Saves from the **Share Extension** that couldn't be sent right away (offline, or an error). They wait on the device and are added to the library the next time the main app runs.
_Avoid_: Outbox, pending list
