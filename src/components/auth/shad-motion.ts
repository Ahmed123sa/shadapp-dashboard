/**
 * Shared maths for the Shad login motion: a loose line that loops, straightens
 * along the stem of the "d" and ends in the dot. Used by the logo (ShadMark)
 * and by the sign-in button loader (ButtonLoader).
 */
export const MARK_PATH =
  'M438.5 792.4C409.9 785.1 392.9 765.2 384.3 729.0C380.9 714.7 380.0 680.7 382.4 659.5C389.8 595.8 417.2 533.2 455.3 493.3C487.1 460.1 525.1 448.0 553.7 462.0C569.6 469.9 581.3 491.6 583.5 517.8C583.9 522.3 584.6 526.2 585.0 526.5C585.4 526.7 586.8 522.3 588.2 516.7C589.6 511.1 599.8 470.6 610.9 426.6C622.0 382.7 631.7 342.5 632.5 337.3C634.2 326.1 633.2 314.2 630.0 308.1C627.8 303.7 622.3 297.7 615.0 291.8L610.5 288.1L655.4 288.0L700.2 288.0L699.8 291.2C699.5 293.0 674.0 395.7 643.0 519.4L586.6 744.3L587.8 750.8C589.0 758.0 591.1 761.6 595.8 764.3C599.8 766.6 609.1 766.7 614.6 764.5L618.5 763.0L618.5 750.7C618.5 738.9 618.6 738.2 621.8 731.8C630.0 715.1 648.2 705.7 665.5 709.3C676.0 711.5 683.2 715.3 689.4 722.1C695.9 729.1 699.0 736.5 699.7 747.0C701.0 765.1 692.5 779.6 676.1 787.4C669.9 790.3 668.8 790.5 658.5 790.5C648.7 790.5 646.9 790.2 641.8 787.8C635.5 784.9 627.9 778.3 624.4 772.8L622.1 769.2L615.0 776.0C607.0 783.6 595.5 790.0 585.9 792.1C577.1 793.9 563.6 792.9 556.9 789.8C541.8 782.9 534.0 768.7 534.0 748.1C534.0 742.8 534.5 736.8 535.1 734.7C536.7 728.9 535.6 729.2 532.0 735.7C521.5 754.4 502.7 774.9 488.7 782.8C475.6 790.3 468.5 792.3 453.5 792.6C446.4 792.8 439.6 792.7 438.5 792.4ZM481.6 769.5C493.0 766.1 510.5 750.2 522.4 732.2C535.6 712.4 544.5 691.9 551.9 664.5C559.3 637.1 572.8 581.6 574.4 572.0C579.6 541.1 578.2 518.8 570.0 501.3C559.8 479.4 537.8 473.7 516.9 487.6C481.4 511.2 449.4 586.2 438.8 671.0C438.1 677.1 437.5 691.7 437.5 706.0C437.5 728.0 437.8 731.4 439.8 739.4C445.1 760.3 455.5 770.7 471.6 770.9C474.4 771.0 478.9 770.3 481.6 769.5Z';

/** Stem axis of the d (top serif to foot) and the dot, in the logo's own coordinates. */
export const A = { x: 657, y: 298 };
export const B = { x: 596, y: 744 };
export const DOT = { x: 659, y: 749, r: 42 };
export const VIEW_H = 516;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const back = (t: number) => {
  t = clamp(t, 0, 1);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const N = 140;

/** A prolate trochoid along A to B: loops while r is large, a straight line when r is 0. */
export function linePoints(r: number, phase: number, draw: number): [number, number][] {
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, vx = -uy, vy = ux;
  const w = Math.PI * 2 * 3.2;
  const n = Math.max(2, Math.round(N * draw));
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (N - 1);
    const a = w * t + phase;
    const taper = Math.sin(Math.PI * Math.min(1, t * 1.02));
    const u = t * len - r * Math.sin(a) * taper;
    const v = (r * Math.cos(a) - r) * taper;
    pts.push([A.x + ux * u + vx * v, A.y + uy * u + vy * v]);
  }
  return pts;
}

export const toD = (pts: [number, number][]) =>
  pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
