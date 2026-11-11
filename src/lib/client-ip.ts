import type { NextRequest } from 'next/server';

const IP_LITERAL_RE = /^[0-9a-fA-F:.]+$/;

function normalizeIp(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length > 45 || !IP_LITERAL_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Extracts the real visitor IP from nginx-set headers.
 *
 * `yourdomain.conf` sets `X-Real-IP $remote_addr` directly (cannot be spoofed
 * by the browser) and appends `$remote_addr` to `X-Forwarded-For` (so the
 * rightmost valid entry is the real peer when `X-Real-IP` is absent).
 */
export function extractClientIp(headers: Headers): string | null {
  const realIp = normalizeIp(headers.get('x-real-ip'));
  if (realIp) return realIp;

  const xff = headers.get('x-forwarded-for');
  if (!xff) return null;

  const parts = xff.split(',');
  for (let i = parts.length - 1; i >= 0; i--) {
    const ip = normalizeIp(parts[i]);
    if (ip) return ip;
  }

  return null;
}

export function forwardClientIpHeaders(req: NextRequest): Record<string, string> {
  const ip = extractClientIp(req.headers);
  return ip ? { 'X-Forwarded-For': ip } : {};
}
