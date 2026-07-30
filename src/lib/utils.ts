export interface MeetingJoinStatus {
  canJoin: boolean;
  label: string;
}

export function getMeetingJoinStatus(scheduledAt: string): MeetingJoinStatus {
  const now = new Date();
  const start = new Date(scheduledAt);
  const diffMs = start.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin <= 0) {
    if (diffMin >= -15) return { canJoin: true, label: 'انضم الآن' };
    return { canJoin: false, label: 'انتهى' };
  }
  if (diffMin <= 15) return { canJoin: true, label: 'متبقي $diffMin دقيقة' };
  if (diffMin < 60) return { canJoin: false, label: 'متبقي $diffMin دقيقة' };
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return { canJoin: false, label: 'متبقي $diffHrs ساعة' };
  return { canJoin: false, label: 'متبقي ${Math.floor(diffHrs / 24)} يوم' };
}

export function formatMeetingDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('ar-SA', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}
