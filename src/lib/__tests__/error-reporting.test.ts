import { describe, it, expect, vi, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { reportError } from '../error-reporting';

describe('reportError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('logs a real Error with its message and stack', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    reportError('some.context', err);

    expect(spy).toHaveBeenCalledTimes(1);
    const [, payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ context: 'some.context', message: 'boom' });
    expect(payload.stack).toContain('boom');
  });

  it('forwards the error to Sentry, tagged with the call-site context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    reportError('some.context', err, { id: 42 });

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { context: 'some.context' },
      extra: { id: 42 },
    });
  });

  it('stringifies a non-Error value instead of throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('some.context', 'plain string failure');

    const [, payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ context: 'some.context', message: 'plain string failure' });
    expect(payload.stack).toBeUndefined();
  });

  it('includes extra context when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('some.context', new Error('boom'), { id: 42 });

    const [, payload] = spy.mock.calls[0];
    expect(payload.extra).toEqual({ id: 42 });
  });
});
