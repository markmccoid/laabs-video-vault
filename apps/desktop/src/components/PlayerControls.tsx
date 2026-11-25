import { formatDuration } from "@lvv/core";
import { MoreHorizontal, Pause, Play, RotateCcw, RotateCw, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { SpeedControl } from "./GravityWell";
import { Icon } from "./Icon";
import { ContextMenu } from "./Menu";

/** Seconds the skip back / skip forward buttons jump (iOS's default). */
export const JUMP_SECONDS = 10;

export type Timeline = {
  get: () => { t: number; d: number };
  set: (t: number, d?: number) => void;
  subscribe: (fn: () => void) => () => void;
};

/**
 * The player's position, outside React state: it changes several times a
 * second, so only the controls that show it re-render, not the whole detail.
 */
export function createTimeline(t = 0, d = 0): Timeline {
  let value = { t, d };
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (nt, nd = value.d) => {
      if (nt === value.t && nd === value.d) return;
      value = { t: nt, d: nd };
      subs.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

type Props = {
  timeline: Timeline;
  /** Fallback length while the player hasn't reported one. */
  knownDuration: number;
  playing: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number, opts: { play: boolean }) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  captions: boolean;
  onCaptionsChange: (on: boolean) => void;
  onFullscreen: () => void;
  onOpenInYouTube: () => void;
  /** Extra buttons at the right end of the bar. */
  children?: ReactNode;
};

/** Our controls under the player, as on iOS: progress bar, then skip / play / skip and speed. */
export function PlayerControls({ timeline, knownDuration, playing, onTogglePlay, onSeek, rate, onRateChange, captions, onCaptionsChange, onFullscreen, onOpenInYouTube, children }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { t, d } = useSyncExternalStore(timeline.subscribe, timeline.get);
  const duration = d || knownDuration;
  // Keep a paused video paused; a running one keeps playing.
  const jump = (delta: number) => onSeek(Math.max(0, Math.min(duration || Infinity, timeline.get().t + delta)), { play: playing });

  return (
    <div className="player-controls">
      <Scrubber position={t} duration={duration} onSeek={(s) => onSeek(s, { play: playing })} />
      <div className="player-bar">
        <div className="transport">
          <JumpButton icon={RotateCcw} seconds={JUMP_SECONDS} label={`Back ${JUMP_SECONDS} seconds`} onClick={() => jump(-JUMP_SECONDS)} />
          <button
            className="btn play-btn"
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause (Space)" : "Play (Space)"}
            onClick={onTogglePlay}
          >
            <Icon as={playing ? Pause : Play} size={20} className={playing ? undefined : "play-icon"} />
          </button>
          <JumpButton icon={RotateCw} seconds={JUMP_SECONDS} label={`Forward ${JUMP_SECONDS} seconds`} onClick={() => jump(JUMP_SECONDS)} />
        </div>
        <SpeedControl rate={rate} onChange={onRateChange} playing={playing} />
        <span style={{ flex: 1 }} />
        {children}
        <button
          className="btn btn-icon"
          aria-label="More player options"
          aria-haspopup="menu"
          title="Full screen, captions, open in YouTube"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            // Open upward from the button, which sits near the bottom of the pane.
            setMenu({ x: r.right - 200, y: r.top - 120 });
          }}
        >
          <Icon as={MoreHorizontal} size={20} />
        </button>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Full Screen", onSelect: onFullscreen },
            { label: captions ? "Turn Captions Off" : "Turn Captions On", kbd: "C", onSelect: () => onCaptionsChange(!captions) },
            { label: "Open in YouTube", onSelect: onOpenInYouTube },
          ]}
        />
      )}
    </div>
  );
}

/** A circular arrow with the skip length inside, like SF Symbols' gobackward.10. */
function JumpButton({ icon, seconds, label, onClick }: { icon: LucideIcon; seconds: number; label: string; onClick: () => void }) {
  return (
    <button className="btn btn-icon jump-btn" aria-label={label} title={label} onClick={onClick}>
      <Icon as={icon} size={28} />
      <span className="jump-num" aria-hidden="true">
        {seconds}
      </span>
    </button>
  );
}

/**
 * The progress bar. Click anywhere to jump there, or drag to scrub (the time
 * follows the pointer and the seek happens on release). ←/→ step 10 seconds.
 */
function Scrubber({ position, duration, onSeek }: { position: number; duration: number; onSeek: (seconds: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // Where we last seeked to, shown until the player reports a nearby time, so
  // the bar doesn't snap back before the next time update.
  const [held, setHeld] = useState<number | null>(null);

  useEffect(() => {
    if (held === null) return;
    if (Math.abs(position - held) < 2) return setHeld(null);
    const timer = window.setTimeout(() => setHeld(null), 2500);
    return () => window.clearTimeout(timer);
  }, [position, held]);

  const enabled = duration > 0;
  const toSeconds = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };
  const commit = (s: number) => {
    setHeld(s);
    onSeek(s);
  };

  const shown = drag ?? held ?? position;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(toSeconds(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag !== null) setDrag(toSeconds(e.clientX));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    setDrag(null);
    commit(toSeconds(e.clientX));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const step = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    commit(Math.max(0, Math.min(duration, shown + step)));
  };

  return (
    <div className="scrubber">
      <div
        ref={track}
        className={`scrub-hit${drag !== null ? " scrubbing" : ""}${enabled ? "" : " disabled"}`}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatDuration(shown)} of ${duration ? formatDuration(duration) : "unknown"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={onKeyDown}
      >
        <div className="scrub-track">
          <div className="scrub-fill" style={{ width: `${pct}%` }} />
        </div>
        {enabled && <div className="scrub-thumb" style={{ left: `${pct}%` }} />}
      </div>
      <div className="scrub-times meta">
        <span className={drag !== null ? "scrub-time-active" : undefined}>{formatDuration(shown)}</span>
        <span>{duration ? formatDuration(duration) : "–:––"}</span>
      </div>
    </div>
  );
}
