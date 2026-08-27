import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import ActivityFeed from '../ActivityFeed';

describe('ActivityFeed', () => {
  it('shows the empty-state message when there are no items', () => {
    renderWithIntl(<ActivityFeed items={[]} />);
    expect(screen.getByText('No activities')).toBeInTheDocument();
  });

  it('renders each item\'s text and time', () => {
    renderWithIntl(
      <ActivityFeed
        items={[
          { color: 'green', text: 'Client approved contract #12', time: '2m ago' },
          { color: 'blue', text: 'New message from Acme Corp', time: '5m ago' },
        ]}
      />
    );
    expect(screen.getByText('Client approved contract #12')).toBeInTheDocument();
    expect(screen.getByText('New message from Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('2m ago')).toBeInTheDocument();
  });

  // Regression test for a real XSS bug: activity text can come from
  // user-controlled data (a client's company name, a chat message preview,
  // etc). It must render as inert text, never as markup — no injected
  // element should ever actually appear in the DOM, and no event handler
  // from the payload should ever be attached to anything.
  it('renders attacker-controlled text as plain text, not as HTML', () => {
    const payload = '<img src=x onerror="window.__pwned = true">';
    renderWithIntl(
      <ActivityFeed items={[{ color: 'red', text: payload, time: 'now' }]} />
    );

    // The literal string is visible as text...
    expect(screen.getByText(payload)).toBeInTheDocument();
    // ...and was never parsed into a real <img> element.
    expect(document.querySelectorAll('img').length).toBe(0);
    expect((window as any).__pwned).toBeUndefined();
  });

  it('renders a script-tag payload as text without executing it', () => {
    const payload = '<script>window.__pwned2 = true</script>';
    renderWithIntl(
      <ActivityFeed items={[{ color: 'red', text: payload, time: 'now' }]} />
    );

    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(document.querySelectorAll('script').length).toBe(0);
    expect((window as any).__pwned2).toBeUndefined();
  });
});
