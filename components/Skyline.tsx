"use client";

import { useEffect, useRef } from "react";

type Building = {
  x: number;
  width: number;
  height: number;
  target: number;
  lit: boolean[];
  delay: number;
  blinkOffset: number;
  isDistrict: boolean;
};

export default function Skyline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let buildings: Building[] = [];
    let t = 0;

    function seedBuildings() {
      buildings = [];
      const count = 46;
      let x = -20;
      for (let i = 0; i < count; i++) {
        const width = 18 + Math.random() * 34;
        const target = 40 + Math.random() * 260;
        buildings.push({
          x,
          width,
          height: 0,
          target,
          lit: Array.from({ length: 40 }, () => Math.random() > 0.55),
          delay: i * 28,
          blinkOffset: Math.random() * 1000,
          isDistrict: Math.random() > 0.82,
        });
        x += width + (6 + Math.random() * 10);
      }
    }

    function resize() {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      t += 1;
      ctx!.clearRect(0, 0, w, h);

      const baseline = h - 2;
      const totalWidth = buildings.reduce((a, b) => a + b.width + 12, 0);
      const startX = (w - totalWidth) / 2;
      let x = startX;

      for (const b of buildings) {
        const growTarget = b.isDistrict ? b.target * 1.6 : b.target;
        if (t > b.delay) {
          b.height += (growTarget - b.height) * 0.045;
        }
        const bx = x;
        const by = baseline - b.height;

        const grad = ctx!.createLinearGradient(0, by, 0, baseline);
        grad.addColorStop(0, "#1c2333");
        grad.addColorStop(1, "#12161f");
        ctx!.fillStyle = grad;
        ctx!.fillRect(bx, by, b.width, b.height);

        ctx!.strokeStyle = "rgba(94,234,212,0.06)";
        ctx!.lineWidth = 1;
        ctx!.strokeRect(bx + 0.5, by + 0.5, b.width - 1, b.height - 1);

        const cols = Math.max(2, Math.floor(b.width / 10));
        const rows = Math.max(2, Math.floor(b.height / 14));
        const padX = 4;
        const padY = 6;
        const cellW = (b.width - padX * 2) / cols;
        const cellH = (b.height - padY * 2) / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = (r * cols + c) % b.lit.length;
            const blink = Math.sin((t + b.blinkOffset + idx * 13) * 0.02) > 0.75;
            const on = b.lit[idx] && (idx % 7 !== 0 || blink);
            if (!on) continue;
            const wx = bx + padX + c * cellW + cellW * 0.15;
            const wy = by + padY + r * cellH + cellH * 0.15;
            ctx!.fillStyle = b.isDistrict
              ? "rgba(255,180,84,0.9)"
              : "rgba(255,180,84,0.55)";
            ctx!.fillRect(wx, wy, cellW * 0.55, cellH * 0.5);
          }
        }

        x += b.width + 12;
      }

      const roadGrad = ctx!.createLinearGradient(0, 0, w, 0);
      roadGrad.addColorStop(0, "rgba(94,234,212,0)");
      roadGrad.addColorStop(0.5, "rgba(94,234,212,0.5)");
      roadGrad.addColorStop(1, "rgba(94,234,212,0)");
      ctx!.fillStyle = roadGrad;
      ctx!.fillRect(0, baseline, w, 1.5);

      raf = requestAnimationFrame(draw);
    }

    resize();
    seedBuildings();
    draw();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="skyline-canvas" />;
}
