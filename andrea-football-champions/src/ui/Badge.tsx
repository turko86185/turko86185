import { useEffect, useRef } from 'react';
import type { Kit, Team } from '../game/teams/teams';
import { drawKit } from '../game/teams/kitTexture';

/** Stemma originale (non ufficiale): scudo con i colori sociali e le iniziali */
export function Badge({ team, size = 56 }: { team: Team; size?: number }) {
  const [a, b] = team.colors;
  const id = `g-${team.id}`;
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" aria-label={team.name}>
      <defs>
        <clipPath id={id}><path d="M50 4 L94 18 L90 70 Q80 98 50 111 Q20 98 10 70 L6 18 Z" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="115" fill={a} />
        <rect x="50" width="50" height="115" fill={b} opacity="0.9" />
        <rect y="40" width="100" height="30" fill="rgba(0,0,0,0.25)" />
      </g>
      <path d="M50 4 L94 18 L90 70 Q80 98 50 111 Q20 98 10 70 L6 18 Z" fill="none" stroke="#fff" strokeWidth="5" />
      <text x="50" y="63" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff" stroke="#000" strokeWidth="1" fontFamily="Arial">{team.short}</text>
    </svg>
  );
}

export function KitPreview({ kit, size = 70, number = 10 }: { kit: Kit; size?: number; number?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const w = 100, h = 100;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    // sagoma della maglia
    ctx.moveTo(30, 8); ctx.lineTo(70, 8); ctx.lineTo(96, 26); ctx.lineTo(86, 44); ctx.lineTo(76, 38); ctx.lineTo(76, 96); ctx.lineTo(24, 96); ctx.lineTo(24, 38); ctx.lineTo(14, 44); ctx.lineTo(4, 26); ctx.closePath();
    ctx.clip();
    drawKit(ctx, kit, w, h, number);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 8); ctx.lineTo(70, 8); ctx.lineTo(96, 26); ctx.lineTo(86, 44); ctx.lineTo(76, 38); ctx.lineTo(76, 96); ctx.lineTo(24, 96); ctx.lineTo(24, 38); ctx.lineTo(14, 44); ctx.lineTo(4, 26); ctx.closePath();
    ctx.stroke();
  }, [kit, number]);
  return <canvas ref={ref} width={100} height={100} className="kit-preview" style={{ width: size, height: size }} />;
}
