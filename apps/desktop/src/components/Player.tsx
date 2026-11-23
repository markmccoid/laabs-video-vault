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
type Props = {
  youtubeId: string;
  start?: number;
  title: string;
  /** Playback speed, applied once the player is ready and whenever it changes. */
  rate?: number;
  onPlayingChange?: (playing: boolean) => void;
  /** Each position the player reports, with its duration (0 until known). */
  onTime?: (seconds: number, duration: number) => void;
};

export const Player = forwardRef<PlayerHandle, Props>(
  function Player({ youtubeId, start, title, rate = 1, onPlayingChange, onTime }, ref) {
    const frame = useRef<HTMLIFrameElement>(null);
    const time = useRef(start ?? 0);
    /** The IFrame API's playerState: 1 is playing. */
    const state = useRef(-1);

    const post = (msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(msg), ORIGIN);
    const rateRef = useRef(rate);
    rateRef.current = rate;
    const applyRate = () => post({ event: "command", func: "setPlaybackRate", args: [rateRef.current] });
    const playingCb = useRef(onPlayingChange);
    playingCb.current = onPlayingChange;
    const timeCb = useRef(onTime);
    timeCb.current = onTime;
    const duration = useRef(0);

    useEffect(() => {
      applyRate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rate]);

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
        playingCb.current?.(!playing);
      },
    }));

    useEffect(() => {
      time.current = start ?? 0;
      state.current = -1;
      playingCb.current?.(false);
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return;
        try {
          const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          const t = data?.info?.currentTime;
          const d = data?.info?.duration;
          if (typeof d === "number" && d > 0) duration.current = d;
          if (typeof t === "number") {
            time.current = t;
            timeCb.current?.(t, duration.current);
          }
          // The embed forgets the rate when it (re)loads a video.
          if (data?.event === "onReady" || data?.event === "initialDelivery") applyRate();
          const ps = data?.info?.playerState;
          if (typeof ps === "number" && ps !== state.current) {
            const wasPlaying = state.current === 1;
            state.current = ps;
            if (wasPlaying !== (ps === 1)) playingCb.current?.(ps === 1);
          }
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
          onLoad={() => {
            post({ event: "listening", id: youtubeId, channel: "widget" });
            applyRate();
          }}
        />
      </div>
    );
  },
);
