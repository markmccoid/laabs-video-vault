import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const metadataState = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("unavailable"),
);

export default defineSchema({
  ...authTables,

  /**
   * Nested folders, max 3 levels (depth 0, 1, 2).
   * Rules live in @lvv/core/folders (MAX_FOLDER_DEPTH, canMoveFolder).
   */
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    parentId: v.optional(v.id("folders")), // undefined = top level
    depth: v.number(),
    order: v.number(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  }).index("by_user_parent", ["userId", "parentId"]),

  tags: defineTable({
    userId: v.id("users"),
    name: v.string(),
    nameLower: v.string(),
    color: v.optional(v.string()),
    system: v.optional(v.literal("short")),
  }).index("by_user_name", ["userId", "nameLower"]),

  videos: defineTable({
    userId: v.id("users"),
    youtubeId: v.string(),
    title: v.string(),
    channelId: v.optional(v.string()),
    channelTitle: v.string(),
    description: v.string(),
    durationSec: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    thumbUrl: v.string(),
    thumbStorageId: v.optional(v.id("_storage")),
    isShort: v.boolean(),
    folderId: v.optional(v.id("folders")), // undefined = Inbox
    notes: v.string(),
    favorite: v.boolean(),
    lastOpenedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()), // soft delete (Trash)
    metadataState,
    metadataError: v.optional(v.string()),
    /** title + channel + tags + notes + description. Rebuilt by lib/search.ts. */
    searchText: v.string(),
  })
    .index("by_user_youtubeId", ["userId", "youtubeId"])
    .index("by_user_folder", ["userId", "folderId"]) // ordered by _creationTime
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_user_favorite", ["userId", "favorite"])
    .index("by_user_deleted", ["userId", "deletedAt"]) // Trash: deletedAt set, newest last
    .searchIndex("search", {
      searchField: "searchText",
      filterFields: ["userId", "folderId", "isShort"],
    }),

  /** Join table — Convex can't index into arrays, and "videos with tag X" is a core query. */
  videoTags: defineTable({
    userId: v.id("users"),
    videoId: v.id("videos"),
    tagId: v.id("tags"),
  })
    .index("by_video", ["videoId"])
    .index("by_user_tag", ["userId", "tagId"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    videoId: v.id("videos"),
    seconds: v.number(),
    label: v.string(),
    note: v.optional(v.string()),
    source: v.union(v.literal("user"), v.literal("chapter")),
  })
    .index("by_video_time", ["videoId", "seconds"])
    .searchIndex("search", { searchField: "label", filterFields: ["userId"] }),
});
