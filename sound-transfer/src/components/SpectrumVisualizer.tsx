import { useRef, useEffect } from 'react';
import { ALL_FREQS, FREQ_SYNC, FREQ_END, DATA_FREQS } from '../lib/protocol';

interface Props {
  powers: number[]; // normalised 0–1, one per ALL_FREQS entry
  active: boolean;
}

export function SpectrumVisualizer({ powers, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, width, height);

    if (!active) {
      ctx.fillStyle = '#1e3a5f33';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      ctx.fillText('Spectrum inactive', width / 2, height / 2);
      return;
    }

    const barW    = (width - 8) / ALL_FREQS.length;
    const spacing = 2;

    ALL_FREQS.forEach((freq, i) => {
      const p      = powers[i] ?? 0;
      const barH   = p * (height - 24);
      const x      = 4 + i * barW;
      const y      = height - barH - 16;

      // Colour by role
      let color: string;
      if (freq === FREQ_SYNC) {
        color = `rgba(251, 191, 36, ${0.4 + p * 0.6})`; // amber
      } else if (freq === FREQ_END) {
        color = `rgba(239, 68, 68, ${0.4 + p * 0.6})`;  // red
      } else {
        const dataIdx = DATA_FREQS.indexOf(freq);
        const hue     = 160 + (dataIdx / (DATA_FREQS.length - 1)) * 60; // cyan → teal
        color = `hsla(${hue}, 80%, ${40 + p * 40}%, ${0.5 + p * 0.5})`;
      }

      // Bar
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW - spacing, barH + 1, [2, 2, 0, 0]);
      ctx.fill();

      // Glow on strong signal
      if (p > 0.5) {
        ctx.shadowColor  = color;
        ctx.shadowBlur   = 8;
        ctx.fillRect(x, y, barW - spacing, barH + 1);
        ctx.shadowBlur = 0;
      }

      // Frequency label (every 4th)
      if (i % 4 === 0) {
        ctx.fillStyle   = '#475569';
        ctx.font        = '9px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText(`${freq}`, x + (barW - spacing) / 2, height - 2);
      }
    });
  }, [powers, active]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={120}
      className="w-full rounded-lg border border-slate-700/50 bg-[#0a1628]"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
