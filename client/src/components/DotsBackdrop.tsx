import { useEffect, useRef } from "react";
import { rgba } from "../lib/format";
import { COLOR_HEX } from "../lib/format";

// A full-viewport, ambient dotted grid used purely as decoration on the main
// menu. It never receives input and carries no game state.
//
// Besides quietly-drifting pulsing dots with faint connecting lines and a
// parallax proximity glow, it periodically plays a "capture" flourish: it picks
// a loop of grid dots, traces the outline radially outward from an anchor dot,
// then fades in a translucent player-color fill.
const GRID = { rows: 7, cols: 7 };

// Player colors drive the ambient capture flourish so it echoes the real game.
const CAPTURE_COLORS = Object.values(COLOR_HEX);

interface Capture {
  verts: [number, number][]; // grid coords of the polygon vertices
  segs: Array<[number, number]>; // vertex-index pairs forming the closed loop
  color: string; // hex of the "capturing" player
  t0: number; // performance.now() when this flourish began
  segMs: number; // ms spent drawing each outline segment
  fillIn: number; // ms for the fill to fade in
  hold: number; // ms the filled region is held visible
  fadeOut: number; // ms for the fill/outline to fade out
}

export default function DotsBackdrop({ color = "#475569" }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0, movedAt: 0 });
  const capture = useRef<Capture | null>(null);
  const nextSpawn = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t0 = performance.now();
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = Math.min(w, h) * 0.14;
      const stepX = (w - pad * 2) / (GRID.cols - 1);
      const stepY = (h - pad * 2) / (GRID.rows - 1);
      return {
        w,
        h,
        dpr,
        pad,
        stepX,
        stepY,
        baseR:
          Math.min((w - pad * 2) / (GRID.cols - 1), (h - pad * 2) / (GRID.rows - 1)) *
          0.09,
      };
    };

    let g = setup();
    // Parallax offset, eased each frame toward the current mouse position.
    let px = 0;
    let py = 0;

    // Pick a closed polygon of grid cells to "capture".
    const spawnCapture = () => {
      const cells: number[] = [];
      while (cells.length < 4) {
        const i = Math.floor(Math.random() * GRID.rows * GRID.cols);
        if (!cells.includes(i)) cells.push(i);
      }
      const at = (i: number): [number, number] => [
        Math.floor(i / GRID.cols),
        i % GRID.cols,
      ];
      capture.current = {
        verts: cells.map(at),
        segs: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
        ],
        color: CAPTURE_COLORS[Math.floor(Math.random() * CAPTURE_COLORS.length)],
        t0: performance.now(),
        segMs: 240,
        fillIn: 450,
        hold: 1200,
        fadeOut: 650,
      };
    };

    const onPointer = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.movedAt = performance.now();
    };

    mouse.x = g.w / 2;
    mouse.y = g.h / 2;
    mouse.movedAt = performance.now();
    nextSpawn.current = performance.now() + rand(2000, 4000);
    window.addEventListener("pointermove", onPointer);

    const onResize = () => {
      g = setup();
      t0 = performance.now();
    };
    window.addEventListener("resize", onResize);

    const loop = () => {
      const now = performance.now();
      const t = (now - t0) / 1000;

      // Ease parallax toward the mouse; recenter once the pointer is idle.
      const idle = now - mouse.movedAt > 3000;
      const clx = idle
        ? 0
        : Math.max(-1, Math.min(1, (mouse.x - g.w / 2) / (g.w / 2)));
      const cly = idle
        ? 0
        : Math.max(-1, Math.min(1, (mouse.y - g.h / 2) / (g.h / 2)));
      const maxShift = Math.min(g.w, g.h) * 0.045;
      px = lerp(px, clx * maxShift, 0.08);
      py = lerp(py, cly * maxShift, 0.08);

      // Grid-cell position with slow per-cell drift + the shared parallax shift.
      const cellPos = (r: number, c: number) => {
        const dx = Math.cos(t * 0.6 + r + c) * (g.stepX * 0.1);
        const dy = Math.sin(t * 0.7 + r * 0.5 - c * 0.3) * (g.stepY * 0.1);
        return {
          x: g.pad + c * g.stepX + px + dx,
          y: g.pad + r * g.stepY + py + dy,
        };
      };

      ctx.clearRect(0, 0, g.w, g.h);

      // 1) Proximity glow that sits behind everything and follows the pointer.
      const glow = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        Math.min(g.w, g.h) * 0.45
      );
      glow.addColorStop(0, rgba("#94a3b8", 0.12));
      glow.addColorStop(1, rgba("#94a3b8", 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.w, g.h);

      // 2) Faint connecting lines between nearby cells (a constellation/web look).
      ctx.lineWidth = 1;
      const neighDirs: Array<[number, number]> = [
        [0, 1],
        [1, 0],
        [1, 1],
        [-1, 1],
      ];
      for (let r = 0; r < GRID.rows; r++) {
        for (let c = 0; c < GRID.cols; c++) {
          for (const [dr, dc] of neighDirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= GRID.rows || nc < 0 || nc >= GRID.cols) continue;
            const a = cellPos(r, c);
            const b = cellPos(nr, nc);
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist > g.stepX * 1.45) continue;
            const phase = Math.sin(t * 1.3 + (r + c) * 0.55);
            const falloff = 1 - Math.min(1, Math.max(0, (dist - g.stepX) / (g.stepX * 0.5)));
            const alpha =
              (0.05 + 0.14 * (0.5 + phase * 0.5)) * (0.55 + 0.45 * falloff);
            ctx.strokeStyle = rgba(color, clamp01(alpha) * 0.2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 3) Drifting, pulsing dots. Vertices of the current capture glow brighter.
      const cap = capture.current;
      const vertKey = (r: number, c: number) => `${r},${c}`;
      const vertSet = cap ? new Set(cap.verts.map(([r, c]) => vertKey(r, c))) : null;
      for (let r = 0; r < GRID.rows; r++) {
        for (let c = 0; c < GRID.cols; c++) {
          const phase = Math.sin(t * 1.3 + (r + c) * 0.55);
          const rr = g.baseR * (1 + phase * 0.35);
          const isVert = vertSet?.has(vertKey(r, c));
          const fill = isVert ? cap!.color : color;
          const alpha = isVert ? 0.95 : 0.35 + phase * 0.25;
          const radius = isVert ? rr * 1.7 : rr;
          const p = cellPos(r, c);
          ctx.fillStyle = rgba(fill, clamp01(alpha));
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.8, radius), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4) Capture flourish: trace the outline radially, then fade in the fill.
      if (cap) {
        const elapsed = now - cap.t0;
        const endTrace = cap.segs.length * cap.segMs;
        const endFill = endTrace + cap.fillIn;
        const endHold = endFill + cap.hold;
        const endAll = endHold + cap.fadeOut;

        if (elapsed >= endAll) {
          capture.current = null;
          nextSpawn.current = now + rand(2500, 5500);
        } else if (elapsed < endTrace) {
          // Progressive radial drawing: each segment grows from the previous dot.
          const segIndex = Math.min(
            Math.floor(elapsed / cap.segMs),
            cap.segs.length - 1
          );
          const prog = clamp01((elapsed - segIndex * cap.segMs) / cap.segMs);
          ctx.lineWidth = Math.max(2, g.baseR * 0.9);
          for (let i = 0; i < segIndex; i++) {
            const [ai, bi] = cap.segs[i];
            const p0 = cellPos(cap.verts[ai][0], cap.verts[ai][1]);
            const p1 = cellPos(cap.verts[bi][0], cap.verts[bi][1]);
            ctx.strokeStyle = rgba(cap.color, 1);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
          const [cai, cbi] = cap.segs[segIndex];
          const p0 = cellPos(cap.verts[cai][0], cap.verts[cai][1]);
          const p1 = cellPos(cap.verts[cbi][0], cap.verts[cbi][1]);
          ctx.strokeStyle = rgba(cap.color, 1);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p0.x + (p1.x - p0.x) * prog, p0.y + (p1.y - p0.y) * prog);
          ctx.stroke();
        } else {
          // Outline fully drawn; fade it out with the fill at the very end.
          const outAlpha =
            elapsed >= endHold
              ? clamp01(1 - (elapsed - endHold) / cap.fadeOut)
              : 1;
          ctx.lineWidth = Math.max(2, g.baseR * 0.9);
          ctx.strokeStyle = rgba(cap.color, outAlpha);
          ctx.beginPath();
          cap.segs.forEach(([ai, bi]) => {
            const p0 = cellPos(cap.verts[ai][0], cap.verts[ai][1]);
            const p1 = cellPos(cap.verts[bi][0], cap.verts[bi][1]);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
          });
          ctx.stroke();

          // Fade-in (then hold, then fade-out) the translucent polygon fill.
          let fillA: number;
          if (elapsed < endFill) fillA = (elapsed - endTrace) / cap.fillIn;
          else if (elapsed < endHold) fillA = 1;
          else fillA = clamp01(1 - (elapsed - endHold) / cap.fadeOut);
          ctx.fillStyle = rgba(cap.color, 0.25 * clamp01(fillA));
          ctx.beginPath();
          cap.verts.forEach(([vr, vc], i) => {
            const p = cellPos(vr, vc);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();

          // Soft glow halo around each captured vertex.
          cap.verts.forEach(([vr, vc]) => {
            const p = cellPos(vr, vc);
            const rg = ctx.createRadialGradient(
              p.x,
              p.y,
              0,
              p.x,
              p.y,
              g.baseR * 3.2
            );
            rg.addColorStop(0, rgba(cap.color, 0.28));
            rg.addColorStop(1, rgba(cap.color, 0));
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(p.x, p.y, g.baseR * 3.2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
    };
  }, [color]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full -z-10 opacity-50" aria-hidden />;
}
