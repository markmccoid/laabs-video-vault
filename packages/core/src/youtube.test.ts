import { describe, expect, it } from "vitest";
import {
  formatDuration,
  parseIsoDuration,
  parseTimestamp,
  parseYouTubeUrl,
  watchUrl,
  youtubeAppUrl,
} from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&list=PL123&index=2`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&feature=share`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abcDEF123`],
    [`youtu.be/${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}?rel=0`],
    [`https://www.youtube.com/live/${ID}?feature=shared`],
    [`https://www.youtube.com/v/${ID}`],
    [ID],
    [`Check this out! https://youtu.be/${ID} so good`],
  ])("extracts the id from %s", (input) => {
    expect(parseYouTubeUrl(input)?.videoId).toBe(ID);
  });

  it("flags /shorts/ URLs", () => {
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${ID}?si=x`)).toEqual({
      videoId: ID,
      isShortUrl: true,
    });
  });

  it.each([
    [`https://youtu.be/${ID}?t=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, 3723],
    [`https://www.youtube.com/embed/${ID}?start=42`, 42],
    [`https://www.youtube.com/watch?v=${ID}#t=15`, 15],
  ])("reads the start time from %s", (input, seconds) => {
    expect(parseYouTubeUrl(input)?.startSeconds).toBe(seconds);
  });

  it("omits startSeconds for t=0", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=0`)).not.toHaveProperty("startSeconds");
  });

  it.each([
    [""],
    ["hello world"],
    ["https://vimeo.com/123456"],
    ["https://www.youtube.com/@somechannel"],
    ["https://www.youtube.com/playlist?list=PL123"],
    ["https://youtu.be/tooShort"],
    ["https://notyoutube.com/watch?v=dQw4w9WgXcQ"],
  ])("returns null for %s", (input) => {
    expect(parseYouTubeUrl(input)).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it.each([
    ["90", 90],
    ["90s", 90],
    ["1m30s", 90],
    ["2h", 7200],
    ["1:30", 90],
    ["01:02:03", 3723],
  ])("%s → %d", (input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });

  it("rejects junk", () => {
    expect(parseTimestamp("abc")).toBeUndefined();
    expect(parseTimestamp("1:2")).toBeUndefined();
  });
});

describe("durations", () => {
  it("parses ISO-8601", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
    expect(parseIsoDuration("nope")).toBeUndefined();
  });

  it("formats", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("link builders", () => {
  it("builds watch and app links", () => {
    expect(watchUrl(ID)).toBe(`https://youtu.be/${ID}`);
    expect(watchUrl(ID, 95.7)).toBe(`https://youtu.be/${ID}?t=95`);
    expect(youtubeAppUrl(ID, 10)).toBe(`youtube://watch?v=${ID}&t=10`);
  });
});
