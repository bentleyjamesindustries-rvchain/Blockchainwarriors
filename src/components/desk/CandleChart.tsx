import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ema, impulseChannel, volumeProfile } from "@/lib/indicators";
import { fibBand } from "@/lib/engine";
import type { Candle, ThesisLock } from "@/lib/types";

const C = {
  bg: "#07080a",
  grid: "rgba(232,228,220,0.05)",
  text: "#8b9088",
  up: "#3f9d72",
  down: "#c45c4a",
  ema21: "#9aabba",
  ema50: "#c4a574",
  fib50: "rgba(154,171,186,0.9)",
  gz: "rgba(63,157,114,0.9)",
  inv: "#c45c4a",
  tp: "#3f9d72",
  poc: "#9aabba",
  channel: "rgba(154,171,186,0.45)",
  cross: "rgba(230,228,220,0.35)",
};

const MIN_BARS = 16;
const DEFAULT_BARS = 100;
const PAD = { l: 8, r: 64, t: 16, b: 48 };

type View = { start: number; count: number };

function fitView(n: number): View {
  if (n < 2) return { start: 0, count: n };
  const count = Math.min(n, Math.max(MIN_BARS, DEFAULT_BARS));
  return { start: Math.max(0, n - count), count };
}

function clampView(v: View, n: number): View {
  if (n < 2) return { start: 0, count: n };
  const count = Math.max(MIN_BARS, Math.min(n, v.count || n));
  const start = Math.max(0, Math.min(v.start, Math.max(0, n - count)));
  return { start, count };
}

export function CandleChart({
  candles,
  lock,
  height = 420,
}: {
  candles: Candle[];
  lock?: ThesisLock | null;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ start: 0, count: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const n = candles.length;
  const shown = clampView(view.count ? view : fitView(n), n);

  const zoomAt = (factor: number, anchorFrac: number) => {
    setView((prev) => {
      const cur = clampView(prev.count ? prev : fitView(n), n);
      const frac = Math.min(1, Math.max(0, anchorFrac));
      const anchor = cur.start + frac * cur.count;
      const count = Math.max(MIN_BARS, Math.min(n, cur.count * factor));
      return clampView({ start: anchor - frac * count, count }, n);
    });
  };

  const panBy = (dxPx: number, plotW: number) => {
    if (plotW <= 0) return;
    setView((prev) => {
      const cur = clampView(prev.count ? prev : fitView(n), n);
      return clampView({ start: cur.start - (dxPx / plotW) * cur.count, count: cur.count }, n);
    });
  };

  const resetView = () => setView(fitView(n));

  const lockId = lock?.id ?? "";
  const firstT = candles[0]?.time ?? 0;
  useEffect(() => {
    setView(fitView(candles.length));
  }, [lockId, firstT, n]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = wrapRef.current;
    if (!canvas || !host) return;

    let hoverX: number | null = null;
    let hoverY: number | null = null;
    let raf = 0;
    let dragging = false;
    let lastPx = 0;
    let pinchDist: number | null = null;

    const plotW = () => Math.max(40, (host.clientWidth || 640) - PAD.l - PAD.r);

    const draw = () => {
      const data = candles;
      const lockNow = lock;
      const w = host.clientWidth || 640;
      const h = height;
      const pW = plotW();
      const plotH = h - PAD.t - PAD.b;
      const volH = 36;
      const priceH = plotH - volH - 8;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);

      if (data.length < 2) {
        ctx.fillStyle = C.text;
        ctx.font = "12px IBM Plex Sans, sans-serif";
        ctx.fillText("Waiting on candles…", 16, 24);
        return;
      }

      const v = clampView(viewRef.current.count ? viewRef.current : { start: 0, count: data.length }, data.length);
      const i0 = Math.max(0, Math.floor(v.start));
      const i1 = Math.min(data.length - 1, Math.ceil(v.start + v.count));
      const slice = data.slice(i0, i1 + 1);
      if (!slice.length) return;
      const cw = pW / v.count;
      const x = (i: number) => PAD.l + (i - v.start) * cw + cw / 2;

      let min = Infinity;
      let max = -Infinity;
      let maxVol = 1;
      for (const c of slice) {
        min = Math.min(min, c.low);
        max = Math.max(max, c.high);
        maxVol = Math.max(maxVol, c.volume);
      }
      const span = max - min || 1;
      if (lockNow) {
        const levels = [lockNow.invalidation, lockNow.tp1, lockNow.pivots.w2End, lockNow.pivots.w1End];
        for (const lv of levels) {
          if (lv >= min - span * 0.12 && lv <= max + span * 0.12) {
            min = Math.min(min, lv);
            max = Math.max(max, lv);
          }
        }
      }
      const pad = (max - min) * 0.06 || 1;
      min -= pad;
      max += pad;
      const y = (px: number) => PAD.t + ((max - px) / (max - min)) * priceH;

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const yy = PAD.t + (priceH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(PAD.l, yy);
        ctx.lineTo(w - PAD.r, yy);
        ctx.stroke();
      }

      if (lockNow) {
        const band = fibBand(lockNow);
        const y50 = y(band.fifty);
        const ygz = y(band.gz);
        ctx.fillStyle = "rgba(63,157,114,0.08)";
        ctx.fillRect(PAD.l, Math.min(y50, ygz), pW, Math.abs(ygz - y50));
        const ch = impulseChannel(lockNow.pivots);
        ctx.strokeStyle = C.channel;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y(ch.baseA));
        ctx.lineTo(w - PAD.r, y(ch.baseB));
        ctx.moveTo(PAD.l, y(ch.parallelA));
        ctx.lineTo(w - PAD.r, y(ch.parallelB));
        ctx.stroke();
        ctx.setLineDash([]);

        const rails: Array<[number, string, string]> = [
          [lockNow.invalidation, C.inv, "Stop"],
          [lockNow.tp1, C.tp, "T1"],
          [lockNow.tp2, C.tp, "T2"],
          [band.fifty, C.fib50, "Dip"],
          [band.gz, C.gz, "Deep"],
        ];
        ctx.font = "10px IBM Plex Mono, monospace";
        const used: number[] = [];
        const place = (yy: number) => {
          let yPos = yy;
          for (const u of used) {
            if (Math.abs(u - yPos) < 11) yPos = u + 11;
          }
          used.push(yPos);
          return yPos;
        };
        for (const [px, color, label] of rails) {
          if (px < min || px > max) continue;
          const yy = y(px);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(PAD.l, yy);
          ctx.lineTo(w - PAD.r, yy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.fillText(label, w - PAD.r + 6, place(yy) + 3);
        }
      }

      const vp = volumeProfile(slice.slice(-Math.min(80, slice.length)));
      if (vp && vp.poc >= min && vp.poc <= max) {
        ctx.strokeStyle = C.poc;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD.l, y(vp.poc));
        ctx.lineTo(w - PAD.r, y(vp.poc));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.poc;
        ctx.font = "10px IBM Plex Mono, monospace";
        ctx.fillText("POC", w - PAD.r + 6, y(vp.poc) + 3);
      }

      const closes = data.map((c) => c.close);
      const e21 = ema(closes, 21);
      const e50 = ema(closes, 50);
      const strokeEma = (series: number[], color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.25;
        let started = false;
        for (let i = i0; i <= i1; i++) {
          const val = series[i];
          if (val == null) continue;
          const xx = x(i);
          const yy = y(val);
          if (!started) {
            ctx.moveTo(xx, yy);
            started = true;
          } else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      };
      strokeEma(e21, C.ema21);
      strokeEma(e50, C.ema50);

      for (let i = i0; i <= i1; i++) {
        const c = data[i];
        if (!c) continue;
        const xx = x(i);
        if (xx < PAD.l - cw || xx > w - PAD.r + cw) continue;
        const up = c.close >= c.open;
        ctx.strokeStyle = up ? C.up : C.down;
        ctx.fillStyle = up ? C.up : C.down;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(xx, y(c.high));
        ctx.lineTo(xx, y(c.low));
        ctx.stroke();
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBot = y(Math.min(c.open, c.close));
        const bw = Math.max(3, cw * 0.7);
        ctx.fillRect(xx - bw / 2, bodyTop, bw, Math.max(1, bodyBot - bodyTop));
        const volY = PAD.t + priceH + 8;
        const vh = (c.volume / maxVol) * volH;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(xx - bw / 2, volY + volH - vh, bw, vh);
        ctx.globalAlpha = 1;
      }

      const lastPx = data[data.length - 1]?.close;
      if (lastPx != null && lastPx >= min && lastPx <= max) {
        const yy = y(lastPx);
        ctx.strokeStyle = "#e6e4dc";
        ctx.lineWidth = 1.25;
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD.l, yy);
        ctx.lineTo(w - PAD.r, yy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#e6e4dc";
        ctx.font = "11px IBM Plex Mono, monospace";
        ctx.fillText("NOW", w - PAD.r + 6, yy + 4);
      }

      ctx.fillStyle = C.text;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const px = max - ((max - min) / 4) * i;
        const yy = PAD.t + (priceH / 4) * i;
        ctx.fillText(formatAxis(px), w - 8, yy + 3);
      }
      ctx.textAlign = "left";
      ctx.fillText("scroll / pinch to zoom · drag to pan · double-click to fit", PAD.l, h - 10);

      if (!dragging && hoverX != null && hoverY != null) {
        const i = Math.min(data.length - 1, Math.max(0, Math.round(v.start + ((hoverX - PAD.l) / pW) * v.count)));
        const c = data[i];
        if (c) {
          ctx.strokeStyle = C.cross;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x(i), PAD.t);
          ctx.lineTo(x(i), PAD.t + priceH);
          ctx.moveTo(PAD.l, hoverY);
          ctx.lineTo(w - PAD.r, hoverY);
          ctx.stroke();
          ctx.setLineDash([]);
          const boxW = 168;
          const bx = Math.min(hoverX + 12, w - PAD.r - boxW);
          const by = Math.max(PAD.t, hoverY - 70);
          ctx.fillStyle = "rgba(17,19,24,0.94)";
          ctx.strokeStyle = "#23282f";
          ctx.fillRect(bx, by, boxW, 64);
          ctx.strokeRect(bx, by, boxW, 64);
          ctx.fillStyle = "#e6e4dc";
          ctx.font = "11px IBM Plex Mono, monospace";
          ctx.fillText(`O ${formatAxis(c.open)}  H ${formatAxis(c.high)}`, bx + 8, by + 18);
          ctx.fillText(`L ${formatAxis(c.low)}  C ${formatAxis(c.close)}`, bx + 8, by + 36);
          ctx.fillStyle = C.text;
          ctx.fillText(new Date(c.time * 1000).toUTCString().slice(0, 22), bx + 8, by + 54);
        }
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      if (dragging) {
        panBy(mx - lastPx, plotW());
        lastPx = mx;
        canvas.style.cursor = "grabbing";
      } else {
        hoverX = mx;
        hoverY = my;
        canvas.style.cursor = "crosshair";
        schedule();
      }
    };
    const onLeave = () => {
      hoverX = null;
      hoverY = null;
      dragging = false;
      canvas.style.cursor = "crosshair";
      draw();
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastPx = e.clientX - canvas.getBoundingClientRect().left;
      canvas.style.cursor = "grabbing";
    };
    const onUp = () => {
      dragging = false;
      canvas.style.cursor = "crosshair";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const frac = (e.clientX - r.left - PAD.l) / plotW();
      zoomAt(e.deltaY > 0 ? 1.18 : 0.85, frac);
    };
    const onDbl = () => resetView();

    const pt = (t: Touch, r: DOMRect) => ({ x: t.clientX - r.left, y: t.clientY - r.top });
    const onTouchStart = (e: TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      if (e.touches.length === 1) {
        dragging = true;
        lastPx = pt(e.touches[0]!, r).x;
      } else if (e.touches.length === 2) {
        dragging = false;
        const a = pt(e.touches[0]!, r);
        const b = pt(e.touches[1]!, r);
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      if (e.touches.length === 1 && dragging) {
        const mx = pt(e.touches[0]!, r).x;
        panBy(mx - lastPx, plotW());
        lastPx = mx;
      } else if (e.touches.length === 2 && pinchDist) {
        const a = pt(e.touches[0]!, r);
        const b = pt(e.touches[1]!, r);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const midFrac = ((a.x + b.x) / 2 - PAD.l) / plotW();
        zoomAt(pinchDist / d, midFrac);
        pinchDist = d;
      }
    };
    const onTouchEnd = () => {
      dragging = false;
      pinchDist = null;
    };

    const ro = new ResizeObserver(() => draw());
    ro.observe(host);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.style.cursor = "crosshair";
    draw();
    return () => {
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      cancelAnimationFrame(raf);
    };
  }, [candles, lock, height, view]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-lg bg-background">
      <canvas ref={canvasRef} className="block w-full touch-none" />
      <div className="absolute top-2 left-2 flex items-center gap-1">
        <Button type="button" size="icon" variant="secondary" className="size-9" aria-label="Zoom in" onClick={() => zoomAt(0.65, 0.82)}>
          <ZoomIn className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="secondary" className="size-9" aria-label="Zoom out" onClick={() => zoomAt(1.45, 0.82)}>
          <ZoomOut className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="secondary" className="size-9" aria-label="Reset zoom" onClick={resetView}>
          <Maximize2 className="size-4" />
        </Button>
        <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[0.625rem] text-muted-foreground">
          {Math.round(shown.count)} / {n || 0}
        </span>
      </div>
    </div>
  );
}

function formatAxis(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(5);
}
