import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import MeetingBanner, { nextMeeting } from '../MeetingBanner';
import { enterMeeting } from '@/lib/zoom';
import type { Meeting } from '@/types';

// The next meeting is pinned above the manager's chat. Join follows one rule
// everywhere: from 15 minutes before it starts until it ends.

vi.mock('@/lib/zoom', () => ({ enterMeeting: vi.fn() }));

const MIN = 60000;
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * MIN).toISOString();

function meeting(over: Partial<Meeting>): Meeting {
  return {
    id: 5,
    workspace_id: 9,
    title: 'Kickoff',
    link: 'https://zoom.example/j/1',
    scheduled_at: at(58),
    duration_minutes: 30,
    status: 'scheduled',
    ...over,
  } as Meeting;
}

beforeEach(() => {
  vi.mocked(enterMeeting).mockReset();
  vi.mocked(enterMeeting).mockResolvedValue('host');
});

describe('nextMeeting', () => {
  it('picks the nearest meeting that has not ended', () => {
    const later = meeting({ id: 2, scheduled_at: at(300) });
    const sooner = meeting({ id: 3, scheduled_at: at(60) });
    expect(nextMeeting([later, sooner])?.id).toBe(3);
  });

  it('ignores cancelled, completed and ended meetings', () => {
    const cancelled = meeting({ id: 1, status: 'cancelled', scheduled_at: at(10) });
    const completed = meeting({ id: 2, status: 'completed', scheduled_at: at(10) });
    const ended = meeting({ id: 3, scheduled_at: at(-60), duration_minutes: 30 });
    expect(nextMeeting([cancelled, completed, ended])).toBeNull();
  });

  it('keeps a meeting that is still running', () => {
    const running = meeting({ id: 4, scheduled_at: at(-20), duration_minutes: 60 });
    expect(nextMeeting([running])?.id).toBe(4);
  });

  it('handles no meetings at all', () => {
    expect(nextMeeting(undefined)).toBeNull();
    expect(nextMeeting([])).toBeNull();
  });
});

describe('MeetingBanner', () => {
  it('draws nothing without an upcoming meeting', () => {
    renderWithIntl(<MeetingBanner meetings={[]} canJoin />);
    expect(screen.queryByTestId('meeting-banner')).toBeNull();
  });

  it('shows the title and the time left, with no Join button an hour out', () => {
    renderWithIntl(<MeetingBanner meetings={[meeting({})]} canJoin />);

    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText(/min left/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows Join 10 minutes before the start and enters through the backend', async () => {
    const user = userEvent.setup();
    renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(10) })]} canJoin />);

    await user.click(screen.getByRole('button', { name: 'Start meeting' }));

    expect(enterMeeting).toHaveBeenCalledWith(5);
  });

  it('keeps Join while the meeting is running, even past 15 minutes in', () => {
    renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(-20), duration_minutes: 60 })]} canJoin />);

    expect(screen.getByRole('button', { name: 'Start meeting' })).toBeInTheDocument();
    expect(screen.getByText('Join Now')).toBeInTheDocument();
  });

  it('offers Join, not Start, when someone else is the host', () => {
    renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(5), host_user_id: 77 })]} canJoin currentUserId={1} />);

    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
  });

  it('hides Join without the permission, without a link, and after the meeting ended', () => {
    const { unmount } = renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(5) })]} canJoin={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    const { unmount: unmount2 } = renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(5), link: undefined })]} canJoin />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount2();

    renderWithIntl(<MeetingBanner meetings={[meeting({ scheduled_at: at(-60), duration_minutes: 30 })]} canJoin />);
    expect(screen.queryByTestId('meeting-banner')).toBeNull();
  });
});
