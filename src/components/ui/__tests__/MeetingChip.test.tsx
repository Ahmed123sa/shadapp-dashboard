import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import MeetingChip from '../MeetingChip';

const NOW = new Date('2026-08-26T10:00:00.000Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('MeetingChip', () => {
  it('shows a "Join Now" link when the meeting is joinable and still scheduled', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          title: 'Kickoff call',
          scheduled_at: new Date(NOW.getTime() + 5 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'scheduled',
        }}
      />
    );

    const joinLink = screen.getByText('Join Now');
    expect(joinLink.closest('a')).toHaveAttribute('href', 'https://meet.example.com/xyz');
  });

  it('shows the countdown label instead of a join link when not yet joinable', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          title: 'Kickoff call',
          scheduled_at: new Date(NOW.getTime() + 30 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'scheduled',
        }}
      />
    );

    expect(screen.queryByText('Join Now')).not.toBeInTheDocument();
    expect(screen.getByText('30 min left')).toBeInTheDocument();
  });

  it('shows "Ended" (not a stale join link) once the meeting is well past its time', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() - 30 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'scheduled',
        }}
      />
    );

    expect(screen.queryByText('Join Now')).not.toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('never shows a join link for a cancelled meeting even if it would be joinable', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() + 2 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'cancelled',
        }}
      />
    );

    expect(screen.queryByText('Join Now')).not.toBeInTheDocument();
  });

  it('falls back to the default title when none is given', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(<MeetingChip metadata={{}} />);
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('shows the passcode when provided', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(<MeetingChip metadata={{ passcode: '1234' }} />);
    expect(screen.getByText('Passcode: 1234')).toBeInTheDocument();
  });
});
