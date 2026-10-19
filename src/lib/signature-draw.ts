/**
 * Helpers for the "draw your signature" pad. Strokes are lists of points in
 * the pad's own pixel space; on export they're fitted (uniform scale, so the
 * handwriting is never stretched) into the same 500×200 PNG the upload and
 * type modes already produce, dark ink on white.
 */

export type Point = [number, number];
export type Stroke = Point[];

export const SIG_W = 500;
export const SIG_H = 200;

export function strokesBounds(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

/** Scale + offset that centres the strokes' bounding box in w×h with padding. */
export function fitTransform(strokes: Stroke[], w = SIG_W, h = SIG_H, pad = 16) {
  const b = strokesBounds(strokes);
  if (!b) return null;
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  return {
    scale,
    dx: (w - bw * scale) / 2 - b.minX * scale,
    dy: (h - bh * scale) / 2 - b.minY * scale,
  };
}

export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  opts: { color: string; width: number; scale?: number; dx?: number; dy?: number },
) {
  const { color, width, scale = 1, dx = 0, dy = 0 } = opts;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.length === 0) continue;
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0][0] * scale + dx, s[0][1] * scale + dy, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0][0] * scale + dx, s[0][1] * scale + dy);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0] * scale + dx, s[i][1] * scale + dy);
    ctx.stroke();
  }
}

/** PNG data URL (black ink on white, 500×200) for the strokes, or null if empty. */
export function strokesToPng(strokes: Stroke[], canvas: HTMLCanvasElement): string | null {
  const fit = fitTransform(strokes);
  if (!fit) return null;
  canvas.width = SIG_W;
  canvas.height = SIG_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIG_W, SIG_H);
  paintStrokes(ctx, strokes, { color: '#111111', width: 3, scale: fit.scale, dx: fit.dx, dy: fit.dy });
  return canvas.toDataURL('image/png');
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
