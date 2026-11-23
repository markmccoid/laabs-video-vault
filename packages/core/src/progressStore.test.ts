import { describe, expect, it } from "vitest";
import { createProgressStore, type ProgressEntry, type ProgressStorage, type ServerProgress } from "./progressStore";

function memoryStorage(): ProgressStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getString: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
    keys: () => [...data.keys()],
  };
}

/** A fake server that applies the same newer-wins rule as watchProgress.save. */
function fakeServer() {
  const rows = new Map<string, ServerProgress>();
  let clock = 100;
  let failing = false;
  const saves: ProgressEntry[][] = [];
  return {
    rows,
    saves,
    fail: (f: boolean) => (failing = f),
    remote: {
      async save(entries: ProgressEntry[]) {
        if (failing) throw new Error("offline");
        saves.push(entries);
        for (const e of entries) {
          const prev = rows.get(e.videoId);
          if (!prev || e.savedAt > prev.savedAt) rows.set(e.videoId, { ...e, updatedAt: ++clock });
        }
      },
      async changedSince(since: number, cursor: string | null) {
        if (failing) throw new Error("offline");
        const all = [...rows.values()].filter((r) => r.updatedAt > since).sort((a, b) => a.updatedAt - b.updatedAt);
        const start = cursor ? Number(cursor) : 0;
        const page = all.slice(start, start + 1); // one per page, to exercise paging
        return { page, isDone: start + 1 >= all.length, continueCursor: String(start + 1) };
      },
    },
  };
}

describe("progress store", () => {
  it("records locally as unsent and pushes once", async () => {
    const server = fakeServer();
    const store = createProgressStore(memoryStorage(), server.remote);
    store.record("v1", 61.8, 300, 1000);
    expect(store.get("v1")).toEqual({ seconds: 61, durationSec: 300, savedAt: 1000, unsent: true });

    await store.push(["v1"]);
    expect(store.get("v1")?.unsent).toBe(false);
    await store.push(["v1"]);
    expect(server.saves).toHaveLength(1);
  });

  it("keeps copies unsent when offline, and sends them on the next sync", async () => {
    const server = fakeServer();
    const store = createProgressStore(memoryStorage(), server.remote);
    server.fail(true);
    store.record("v1", 30, undefined, 1000);
    await expect(store.push()).rejects.toThrow();
    expect(store.get("v1")?.unsent).toBe(true);

    server.fail(false);
    await store.sync();
    expect(store.get("v1")?.unsent).toBe(false);
    expect(server.rows.get("v1")?.seconds).toBe(30);
  });

  it("pulls what another device saved, across pages, newer wins", async () => {
    const server = fakeServer();
    const mac = createProgressStore(memoryStorage(), server.remote);
    const phone = createProgressStore(memoryStorage(), server.remote);

    mac.record("v1", 100, 600, 1000);
    mac.record("v2", 200, 600, 1000);
    await mac.push();

    phone.record("v2", 50, 600, 2000); // watched v2 later on the phone, not sent yet
    await phone.sync();
    expect(phone.get("v1")?.seconds).toBe(100);
    expect(phone.get("v2")?.seconds).toBe(50); // the phone's later copy wins
    expect(server.rows.get("v2")?.seconds).toBe(50);

    await mac.sync();
    expect(mac.get("v2")?.seconds).toBe(50);
  });

  it("only pulls changes since the last sync", async () => {
    const server = fakeServer();
    const store = createProgressStore(memoryStorage(), server.remote);
    server.rows.set("v1", { videoId: "v1", seconds: 10, savedAt: 1, updatedAt: 5 });
    await store.sync();
    let calls = 0;
    const orig = server.remote.changedSince;
    server.remote.changedSince = async (since, cursor) => {
      calls++;
      expect(since).toBe(5);
      return orig(since, cursor);
    };
    await store.sync();
    expect(calls).toBe(1);
  });

  it("reloads from storage and clears on sign-out", async () => {
    const server = fakeServer();
    const storage = memoryStorage();
    createProgressStore(storage, server.remote).record("v1", 30, 100, 1);
    const reopened = createProgressStore(storage, server.remote);
    expect(reopened.get("v1")?.seconds).toBe(30);

    let notified = 0;
    reopened.subscribe(() => notified++);
    reopened.clear();
    expect(reopened.get("v1")).toBeUndefined();
    expect(storage.data.size).toBe(0);
    expect(notified).toBe(1);
  });
});
