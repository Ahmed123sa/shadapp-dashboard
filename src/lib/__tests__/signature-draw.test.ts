import { describe, it, expect } from 'vitest';
import { strokesBounds, fitTransform, dataUrlToBlob, SIG_W, SIG_H } from '../signature-draw';

describe('signature-draw', () => {
  it('bounds is null for no points', () => {
    expect(strokesBounds([])).toBeNull();
    expect(strokesBounds([[]])).toBeNull();
    expect(fitTransform([])).toBeNull();
  });

  it('computes the bounding box over all strokes', () => {
    expect(strokesBounds([[[10, 20], [30, 5]], [[50, 60]]])).toEqual({ minX: 10, minY: 5, maxX: 50, maxY: 60 });
  });

  it('fits a wide drawing into the 500x200 canvas without stretching, centred', () => {
    const strokes = [[[0, 0], [1000, 100]]] as [number, number][][];
    const f = fitTransform(strokes)!;
    // width-bound: (500-32)/1000
    expect(f.scale).toBeCloseTo(0.468, 3);
    // centred horizontally and vertically
    expect(f.dx).toBeCloseTo((SIG_W - 1000 * f.scale) / 2, 3);
    expect(f.dy).toBeCloseTo((SIG_H - 100 * f.scale) / 2, 3);
  });

  it('uses the height when the drawing is tall', () => {
    const f = fitTransform([[[0, 0], [50, 400]]])!;
    expect(f.scale).toBeCloseTo((SIG_H - 32) / 400, 5);
  });

  it('turns a data URL into a blob with the right type and size', () => {
    const blob = dataUrlToBlob('data:image/png;base64,AAEC'); // bytes 0,1,2
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });
});
