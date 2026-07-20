"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = {
  score: number;
  max: number;
  size?: number;
};

export function ScoreRing({ score, max, size = 128 }: Props) {
  const ringRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(score / max, 1) : 0;

  useEffect(() => {
    if (!ringRef.current || !labelRef.current) return;
    const obj = { val: 0 };
    gsap.fromTo(
      ringRef.current,
      { strokeDashoffset: circumference },
      {
        strokeDashoffset: circumference * (1 - pct),
        duration: 1.25,
        ease: "power3.out",
      }
    );
    gsap.to(obj, {
      val: score,
      duration: 1.25,
      ease: "power3.out",
      onUpdate: () => {
        if (labelRef.current) {
          labelRef.current.textContent = obj.val.toFixed(0);
        }
      },
    });
  }, [score, pct, circumference]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(200,245,66,0.12)"
          strokeWidth="8"
        />
        <circle
          ref={ringRef}
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span ref={labelRef} className="font-display text-3xl font-bold text-[var(--paper)]">
          0
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--mist)]">
          / {max}
        </span>
      </div>
    </div>
  );
}
