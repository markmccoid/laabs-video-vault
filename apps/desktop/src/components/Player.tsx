import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type PlayerHandle = {
  seekTo: (seconds: number) => void;
  /** The last position the player reported, in seconds. */
  currentTime: () => number;
  /** Play if paused or not started, pause if playing. */
  togglePlay: () => void;
};

const ORIGIN = "https://www.youtube-nocookie.com";

/**
 * The YouTube embed, driven over the IFrame API's postMessage protocol
 * (enablejsapi=1), so no extra script is loaded. The player reports its
 * position through "infoDelivery" messages once we send "listening".
 */
export const Player = forwardRef<PlayerHandle, { youtubeId: string; start?: number; title: string }>(
  function Player({ youtubeId, start, title }, ref) {
    const frame = useRef<HTMLIFrameElement>(null);
    const time = useRef(start ?? 0);
    /** The IFrame API's playerState: 1 is playing. */
    const state = useRef(-1);

    const post = (msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(msg), ORIGIN);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds) => {
        post({ event: "command", func: "seekTo", args: [seconds, true] });
        post({ event: "command", func: "playVideo", args: [] });
        time.current = seconds;
      },
      currentTime: () => time.current,
      togglePlay: () => {
        const playing = state.current === 1;
        post({ event: "command", func: playing ? "pauseVideo" : "playVideo", args: [] });
        state.current = playing ? 2 : 1;
      },
    }));

    useEffect(() => {
      time.current = start ?? 0;
      state.current = -1;
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return;
        try {
          const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          const t = data?.info?.currentTime;
          if (typeof t === "number") time.current = t;
          const ps = data?.info?.playerState;
          if (typeof ps === "number") state.current = ps;
        } catch {
          // Not a player message.
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [youtubeId, start]);

    const params = new URLSearchParams({
      enablejsapi: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      origin: window.location.origin,
      ...(start ? { start: String(Math.floor(start)) } : {}),
    });

    return (
      <div className="player">
        <iframe
          ref={frame}
          src={`${ORIGIN}/embed/${youtubeId}?${params}`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={() => post({ event: "listening", id: youtubeId, channel: "widget" })}
        />
      </div>
    );
  },
);
