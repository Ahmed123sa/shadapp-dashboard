'use client';

import { useEffect, useRef } from 'react';
import { back, ease, prefersReducedMotion, toD } from './shad-motion';

const CYCLE = 1200;

/**
 * The loader inside the sign-in button: a loose line loops, straightens, and a
 * dot drops at its end, on repeat. It keeps running through the navigation that
 * follows a successful sign-in. Under reduced motion it is one still frame.
 */
export default function ButtonLoader() {
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const p = path.current, d = dot.current;
    if (!p || !d) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      p.setAttribute('d', 'M48 10L16 10');
      d.style.transform = 'scale(1)';
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const k = ((now - t0) % CYCLE) / CYCLE;
      const r = 6 * (1 - ease((k - 0.25) / 0.4));
      const pts: [number, number][] = [];
      const n = 40, x0 = 48, x1 = 16;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), a = Math.PI * 2 * 2.4 * t - now / 120, taper = Math.sin(Math.PI * t);
        pts.push([x0 + (x1 - x0) * t + r * Math.sin(a) * taper, 10 + (r * Math.cos(a) - r) * taper * 0.9]);
      }
      p.setAttribute('d', toD(pts));
      p.style.opacity = String(1 - ease((k - 0.8) / 0.18));
      d.style.transform = `scale(${back((k - 0.62) / 0.2) * (1 - ease((k - 0.9) / 0.1))})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg className="btn-loader" viewBox="0 0 52 20" aria-hidden="true">
      <path ref={path} d="" />
      <circle ref={dot} cx="9" cy="10" r="2.8" style={{ transform: 'scale(0)' }} />
    </svg>
  );
}
