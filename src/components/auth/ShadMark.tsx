'use client';

import { useEffect, useId, useRef } from 'react';
import { A, B, DOT, MARK_PATH, VIEW_H, back, clamp, ease, linePoints, prefersReducedMotion, toD } from './shad-motion';

interface Frame { draw: number; r: number; phase: number; fill: number; dot: number }
const STILL: Frame = { draw: 1, r: 0, phase: 0, fill: 1, dot: 1 };

/**
 * The Shad "d" mark. Plays once when the sign-in screen opens (a loose line
 * loops, straightens along the stem, the letter fills, the dot drops) and
 * plays a short "loop and straighten again" when `errorTick` goes up.
 * Under prefers-reduced-motion it is simply the still logo.
 */
export default function ShadMark({ errorTick = 0 }: { errorTick?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const line = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGRectElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const raf = useRef(0);

  const set = (s: Frame) => {
    line.current?.setAttribute('d', s.draw > 0 ? toD(linePoints(s.r, s.phase, s.draw)) : '');
    reveal.current?.setAttribute('height', String(VIEW_H * s.fill));
    if (dot.current) dot.current.style.transform = `scale(${s.dot})`;
  };

  const play = (kind: 'intro' | 'error') => {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') { set(STILL); return; }
    const start = performance.now();
    const dur = kind === 'error' ? 1100 : 1700;
    const frame = (now: number) => {
      const t = (now - start) / dur;
      let s: Frame;
      if (kind === 'intro') {
        s = { draw: ease(t / 0.3), r: 72 * (1 - ease((t - 0.3) / 0.32)), phase: -now / 180, fill: ease((t - 0.55) / 0.3), dot: back((t - 0.8) / 0.2) };
      } else {
        const bump = Math.sin(Math.PI * clamp(t, 0, 1));
        s = { draw: 1, r: 64 * bump, phase: -now / 140, fill: 1 - 0.85 * bump, dot: 1 - 0.25 * bump };
      }
      set(s);
      if (t < 1) raf.current = requestAnimationFrame(frame); else set(STILL);
    };
    raf.current = requestAnimationFrame(frame);
  };

  useEffect(() => { play('intro'); return () => cancelAnimationFrame(raf.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (errorTick > 0) play('error'); }, [errorTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg className="dmark" viewBox="375 282 330 516" role="img" aria-label="Shad">
      <defs>
        <clipPath id={`shadmark-${uid}`}><rect ref={reveal} x="375" y="282" width="330" height="0" /></clipPath>
      </defs>
      <path className="fill" fillRule="evenodd" d={MARK_PATH} clipPath={`url(#shadmark-${uid})`} />
      <path ref={line} className="line" d="" />
      <circle ref={dot} className="dot" cx={DOT.x} cy={DOT.y} r={DOT.r} style={{ transform: 'scale(0)' }} />
    </svg>
  );
}
