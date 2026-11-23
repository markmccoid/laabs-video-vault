import {
  coreRadius,
  distanceToNorm,
  normRadius,
  orbitRadius,
  orbitVelocity,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  rateAtDistance,
  rateToNorm,
  snapRate,
  wellBand,
  wellBandLabel,
  wellRates,
} from "@lvv/core";
import { useEffect, useRef, useState } from "react";

export const rateLabel = (rate: number) => `${rate.toFixed(1)}×`;

const TRAIL = 8;

type Props = {
  value: number;
  /** Fires on every 0.1× detent while dragging, so the video follows live. */
  onChange: (rate: number) => void;
  /** The satellite orbits only while the video plays. */
  playing?: boolean;
  size?: number;
};

/**
 * Gravity-well speed picker (trial). Each rate is an orbit: drag outward to
 * slow down, inward to speed up; the satellite orbits faster the faster the
 * rate. Click the core for 1.0×. Mouse wheel and arrow keys step by 0.1×.
 *
 * Per-frame motion writes SVG attributes directly, so React renders only
 * when the rate changes.
 */
export function GravityWell({ value, onChange, playing = true, size = 260 }: Props) {
  const c = size / 2;
  const core = coreRadius(size);
  const current = snapRate(value);
  const band = wellBand(current);

  const svg = useRef<SVGSVGElement>(null);
  const tether = useRef<SVGLineElement>(null);
  const satellite = useRef<SVGGElement>(null);
  const trail = useRef<(SVGCircleElement | null)[]>([]);
  const [dragging, setDragging] = useState(false);

  // Animation state lives in refs: read by the frame loop, never rendered.
  const anim = useRef({ angle: -Math.PI / 2, norm: rateToNorm(current), target: rateToNorm(current), speed: current });
  const drag = useRef<{ onCore: boolean } | null>(null);
  const live = useRef({ playing, onChange });
  live.current = { playing, onChange };

  // Follow outside changes, but never fight the pointer mid-drag.
  useEffect(() => {
    anim.current.speed = current;
    if (!drag.current) anim.current.target = rateToNorm(current);
  }, [current]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const a = anim.current;
      if (!drag.current) {
        if (live.current.playing) a.angle = (a.angle + orbitVelocity(a.speed) * dt) % (Math.PI * 2);
        // Critically-damped-ish ease onto the chosen orbit.
        a.norm += (a.target - a.norm) * Math.min(1, dt * 14);
      }
      const r = normRadius(a.norm, size);
      const x = c + Math.cos(a.angle) * r;
      const y = c + Math.sin(a.angle) * r;
      tether.current?.setAttribute("x2", String(x));
      tether.current?.setAttribute("y2", String(y));
      satellite.current?.setAttribute("transform", `translate(${x} ${y})`);
      trail.current.forEach((dot, i) => {
        if (!dot) return;
        const t = a.angle - (i + 1) * (0.08 + a.speed * 0.045);
        dot.setAttribute("cx", String(c + Math.cos(t) * r));
        dot.setAttribute("cy", String(c + Math.sin(t) * r));
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [c, size]);

  const commit = (next: number) => {
    if (next === anim.current.speed) return;
    anim.current.speed = next;
    live.current.onChange(next);
  };

  /** Pointer position in well coordinates (the SVG may be scaled by CSS). */
  const local = (e: React.PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * size, y: ((e.clientY - box.top) / box.height) * size };
  };

  const track = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = local(e);
    const dist = Math.hypot(x - c, y - c);
    if (d.onCore) {
      if (dist <= core) return;
      d.onCore = false;
      setDragging(true);
    }
    const a = anim.current;
    a.angle = Math.atan2(y - c, x - c);
    a.norm = distanceToNorm(dist, size);
    commit(rateAtDistance(dist, size));
  };

  const step = (delta: number) => {
    commit(snapRate(anim.current.speed + delta));
    anim.current.target = rateToNorm(anim.current.speed);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  // Wheel steps the rate. Native listener: React's is passive, and the page
  // behind must not scroll while the pointer is over the well.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpads send many small deltas: step once per ~40px of scroll.
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      stepRef.current(acc < 0 ? RATE_STEP : -RATE_STEP);
      acc = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="gwell">
      <svg
        ref={svg}
        className={`gwell-svg band-${band}${dragging ? " dragging" : ""}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        tabIndex={0}
        aria-label="Playback speed"
        aria-valuemin={RATE_MIN}
        aria-valuemax={RATE_MAX}
        aria-valuenow={current}
        aria-valuetext={rateLabel(current)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const { x, y } = local(e);
          const onCore = Math.hypot(x - c, y - c) <= core;
          drag.current = { onCore };
          if (!onCore) setDragging(true);
          track(e);
        }}
        onPointerMove={track}
        onPointerUp={() => {
          if (drag.current?.onCore) commit(1);
          drag.current = null;
          setDragging(false);
          anim.current.target = rateToNorm(anim.current.speed);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          anim.current.target = rateToNorm(anim.current.speed);
        }}
        onKeyDown={(e) => {
          const keys: Record<string, () => void> = {
            ArrowUp: () => step(RATE_STEP),
            ArrowRight: () => step(RATE_STEP),
            ArrowDown: () => step(-RATE_STEP),
            ArrowLeft: () => step(-RATE_STEP),
            Home: () => commit(RATE_MIN),
            End: () => commit(RATE_MAX),
            "1": () => commit(1),
          };
          const run = keys[e.key];
          if (!run) return;
          e.preventDefault();
          run();
          anim.current.target = rateToNorm(anim.current.speed);
        }}
      >
        <defs>
          <radialGradient id="gwell-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" className="gwell-bg-0" />
            <stop offset="65%" className="gwell-bg-1" />
            <stop offset="100%" className="gwell-bg-2" />
          </radialGradient>
        </defs>
        <circle cx={c} cy={c} r={size * 0.49} fill="url(#gwell-bg)" className="gwell-rim" />

        {wellRates().map((r) => (
          <circle
            key={r}
            cx={c}
            cy={c}
            r={orbitRadius(r, size)}
            className={r === current ? "gwell-ring active" : r === 1 ? "gwell-ring normal" : "gwell-ring"}
          />
        ))}

        <text x={c} y={c - orbitRadius(RATE_MIN, size) - 5} className="gwell-mark">
          {rateLabel(RATE_MIN)}
        </text>
        <text x={c} y={c - orbitRadius(1, size) - 4} className="gwell-mark normal">
          {rateLabel(1)}
        </text>
        <text x={c} y={c - orbitRadius(RATE_MAX, size) - 4} className="gwell-mark turbo">
          {rateLabel(RATE_MAX)}
        </text>

        <line ref={tether} x1={c} y1={c} x2={c} y2={c} className="gwell-tether" />
        {Array.from({ length: TRAIL }, (_, i) => {
          const fade = 1 - (i + 1) / (TRAIL + 1);
          return (
            <circle
              key={i}
              ref={(el) => {
                trail.current[i] = el;
              }}
              r={Math.max(1.5, fade * 5.5)}
              className="gwell-tone"
              style={{ fillOpacity: fade * 0.55 }}
            />
          );
        })}

        <circle cx={c} cy={c} r={core} className="gwell-core" />
        <text x={c} y={c + 5} className="gwell-core-text">
          {rateLabel(current)}
        </text>

        <g ref={satellite} className="gwell-satellite">
          <circle r={14} className="gwell-tone gwell-glow" />
          <circle r={8.5} className="gwell-tone" />
          <circle r={3} className="gwell-sat-dot" />
        </g>
      </svg>
      <div className="gwell-pill" aria-hidden>
        <span className={`gwell-pill-dot band-${band}`} />
        {rateLabel(current)} · {wellBandLabel(current)}
      </div>
    </div>
  );
}

/**
 * The player's speed button: shows the rate and opens the gravity well in a
 * popover. Escape or a click outside closes it.
 */
export function SpeedControl({ rate, onChange, playing }: { rate: number; onChange: (rate: number) => void; playing: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="speed-control" ref={root}>
      <button
        className="btn speed-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Playback speed"
        onClick={() => setOpen((o) => !o)}
      >
        {rateLabel(rate)}
      </button>
      {open && (
        <div className="menu speed-pop" role="dialog" aria-label="Playback speed">
          <GravityWell value={rate} onChange={onChange} playing={playing} />
          <p className="meta speed-hint">Drag in to speed up, out to slow down. Scroll or use arrow keys to step. Click the center for 1.0×.</p>
        </div>
      )}
    </div>
  );
}
