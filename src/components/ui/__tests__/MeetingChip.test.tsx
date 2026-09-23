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
  // 23 Sept 2026 — a completed/cancelled meeting used to show the countdown
  // or "Ended" span as if it were still upcoming. It now shows a StatusBadge.
  it('shows a Cancelled badge, not a countdown, for a cancelled upcoming meeting', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() + 120 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'cancelled',
        }}
      />
    );

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it('shows a Completed badge, not "Ended", for a completed meeting', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() - 60 * 60000).toISOString(),
          link: 'https://meet.example.com/xyz',
          status: 'completed',
        }}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Ended')).not.toBeInTheDocument();
  });

  it('shows a Rescheduled pill on a reschedule card', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() + 2 * 86400000).toISOString(),
          status: 'scheduled',
          rescheduled: true,
        }}
      />
    );

    expect(screen.getByText('Rescheduled')).toBeInTheDocument();
  });

  it('a completed reschedule card shows the status badge instead of the pill', () => {
    vi.useFakeTimers().setSystemTime(NOW);
    renderWithIntl(
      <MeetingChip
        metadata={{
          scheduled_at: new Date(NOW.getTime() - 60 * 60000).toISOString(),
          status: 'completed',
          rescheduled: true,
        }}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Rescheduled')).not.toBeInTheDocument();
  });
});
