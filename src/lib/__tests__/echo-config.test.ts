import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { reverbOptions } from '../echo';

describe('Echo Reverb configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses local defaults when no env variables are set', () => {
    delete process.env.NEXT_PUBLIC_REVERB_HOST;
    delete process.env.NEXT_PUBLIC_REVERB_PORT;
    delete process.env.NEXT_PUBLIC_REVERB_SCHEME;
    delete process.env.NEXT_PUBLIC_REVERB_KEY;

    const opts = reverbOptions();
    expect(opts.broadcaster).toBe('reverb');
    expect(opts.key).toBe('shadapp-key');
    expect(opts.wsHost).toBe('localhost');
    expect(opts.wsPort).toBe(8080);
    expect(opts.wssPort).toBe(8080);
    expect(opts.forceTLS).toBe(false);
  });

  it('configures custom production domain and TLS correctly', () => {
    process.env.NEXT_PUBLIC_REVERB_HOST = 'ws.shadmanagement.co';
    process.env.NEXT_PUBLIC_REVERB_PORT = '443';
    process.env.NEXT_PUBLIC_REVERB_SCHEME = 'https';
    process.env.NEXT_PUBLIC_REVERB_KEY = 'prod-key';

    const opts = reverbOptions();
    expect(opts.broadcaster).toBe('reverb');
    expect(opts.key).toBe('prod-key');
    expect(opts.wsHost).toBe('ws.shadmanagement.co');
    expect(opts.wsPort).toBe(443);
    expect(opts.wssPort).toBe(443);
    expect(opts.forceTLS).toBe(true);
  });

  it('never defaults wsHost to pusher.com cloud hosts', () => {
    const opts = reverbOptions();
    expect(opts.wsHost).not.toContain('pusher.com');
  });
});