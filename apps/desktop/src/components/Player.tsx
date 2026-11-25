import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

export type PlayerHandle = {
  /** Seek, then play unless `play` is false (a paused video stays paused). */
  seekTo: (seconds: number, opts?: { play?: boolean }) => void;
  /** The last position the player reported, in seconds. */
  currentTime: () => number;
  /** Play if paused or not started, pause if playing. */
  togglePlay: () => void;
  /** Show the player full screen (Esc leaves). */
  enterFullscreen: () => void;
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
  /** Show YouTube's own control bar. Changing it reloads the embed (YouTube reads it only at load). */
  controls?: boolean;
  /** Start playing as soon as the embed loads (used when it reloads mid-viewing). */
  autoplay?: boolean;
  /** Captions on or off, applied when playback starts and whenever it changes. */
  captions?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Each position the player reports, with its duration (0 until known). */
  onTime?: (seconds: number, duration: number) => void;
};

export const Player = forwardRef<PlayerHandle, Props>(
  function Player({ youtubeId, start, title, rate = 1, controls = false, autoplay = false, captions = false, onPlayingChange, onTime }, ref) {
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

    // Captions go through the embed's (undocumented) captions module:
    // unloading it hides them, loading it shows the default track. The player
    // reloads the module when playback starts and after every seek, so this
    // runs each time it reports playing (again a moment later, in case the
    // module loads after that report).
    const captionsRef = useRef(captions);
    captionsRef.current = captions;
    const applyCaptions = () => post({ event: "command", func: captionsRef.current ? "loadModule" : "unloadModule", args: ["captions"] });
    /** The playerState the embed last reported (state.current is updated early by togglePlay). */
    const reported = useRef(-1);

    useEffect(() => {
      applyRate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rate]);

    useEffect(() => {
      applyCaptions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captions]);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds, opts) => {
        post({ event: "command", func: "seekTo", args: [seconds, true] });
        if (opts?.play !== false) post({ event: "command", func: "playVideo", args: [] });
        time.current = seconds;
      },
      currentTime: () => time.current,
      enterFullscreen: () => {
        // The iframe is `allow="fullscreen"`; fall back to the player box if the webview refuses it.
        const el = frame.current;
        const box = el?.parentElement;
        el?.requestFullscreen?.().catch(() => box?.requestFullscreen?.().catch(() => {}));
      },
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
      reported.current = -1;
      let reapply: number | undefined;
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
          if (typeof ps === "number" && ps !== reported.current) {
            reported.current = ps;
            if (ps === 1) {
              applyCaptions();
              window.clearTimeout(reapply);
              reapply = window.setTimeout(applyCaptions, 1000);
            }
          }
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
      return () => {
        window.removeEventListener("message", onMessage);
        window.clearTimeout(reapply);
      };
    }, [youtubeId, start, controls]);

    // Built only when the video, start or controls change: a new src reloads the embed,
    // so captions and autoplay are read here but don't rebuild it.
    const src = useMemo(() => {
      const params = new URLSearchParams({
        enablejsapi: "1",
        // Our own controls sit under the player (PlayerControls) unless View › Show YouTube Controls is on.
        controls: controls ? "1" : "0",
        // The starting caption state; applyCaptions keeps it in step after that.
        cc_load_policy: captionsRef.current ? "1" : "0",
        ...(autoplay ? { autoplay: "1" } : {}),
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        origin: window.location.origin,
        ...(start ? { start: String(Math.floor(start)) } : {}),
      });
      return `${ORIGIN}/embed/${youtubeId}?${params}`;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [youtubeId, start, controls]);

    return (
      <div className="player">
        <iframe
          ref={frame}
          src={src}
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
