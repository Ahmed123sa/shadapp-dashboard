import api from '@/lib/api';

/**
 * Staff entry into a Zoom meeting. The backend decides: the first manager /
 * super admin becomes host (fresh start_url), anyone after that gets the
 * participant join_url — so this can never kick an existing host.
 *
 * The blank tab is opened synchronously, before the request, because
 * browsers block window.open() once it runs after an await.
 */
export async function enterMeeting(meetingId: number): Promise<'host' | 'participant'> {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const { data } = await api.post(`/meetings/${meetingId}/enter`);
    if (tab) {
      tab.location.href = data.url;
    } else if (typeof window !== 'undefined') {
      window.location.href = data.url;
    }
    return data.as;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
