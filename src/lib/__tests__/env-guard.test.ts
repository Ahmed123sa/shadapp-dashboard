import { describe, it, expect } from 'vitest';
import { assertProductionEnv } from '../env-guard';

// assertProductionEnv() reads from `process.env` by default (so proxy.ts can
// call it with no arguments), but accepts an explicit env object here so
// these tests don't have to mutate the real process.env.

describe('assertProductionEnv', () => {
  it('does nothing outside production, even with every var missing', () => {
    expect(() => assertProductionEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: 'test' })).not.toThrow();
    // Cast, not a NODE_ENV added to the object: "every var missing" means
    // NODE_ENV missing too, which is the case this line exists to cover.
    // Next's global.d.ts declares NODE_ENV as a required property of
    // ProcessEnv, so an empty object literal doesn't type-check even though
    // it is a perfectly possible runtime value here.
    expect(() => assertProductionEnv({} as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('throws in production when required vars are missing', () => {
    expect(() => assertProductionEnv({ NODE_ENV: 'production' })).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('names every missing var, not just the first one', () => {
    try {
      assertProductionEnv({ NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.example.com' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('NEXT_PUBLIC_REVERB_HOST');
      expect(message).toContain('NEXT_PUBLIC_REVERB_KEY');
      expect(message).not.toContain('NEXT_PUBLIC_API_URL');
    }
  });

  it('does not throw in production once all required vars are set', () => {
    expect(() => assertProductionEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.example.com',
      NEXT_PUBLIC_REVERB_HOST: 'reverb.example.com',
      NEXT_PUBLIC_REVERB_KEY: 'real-key',
    })).not.toThrow();
  });
});
