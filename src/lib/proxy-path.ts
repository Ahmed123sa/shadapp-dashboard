/**
 * Rejects path-traversal or encoded-separator segments before joining onto the
 * upstream Laravel API base URL.
 */
export function hasUnsafePathSegment(segments: string[]): boolean {
  return segments.some((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return true;
    }

    return (
      segment === '.'
      || segment === '..'
      || decoded === '.'
      || decoded === '..'
      || decoded.includes('..')
      || decoded.includes('/')
      || decoded.includes('\\')
    );
  });
}
