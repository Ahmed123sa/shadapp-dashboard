'use client';

import { useTranslations } from 'next-intl';
import { getUser } from '@/lib/auth';
import { canUseAssistantsTeam } from '@/lib/permissions';
import StaffTeamPanel from '@/components/team/StaffTeamPanel';
import AssistantsPanel from '@/components/team/AssistantsPanel';

// "Team" — the account manager's company-staff team (PLAN_2_MANAGER_TEAMS.md).
// Account managers only: the backend answers 403 to everyone else and proxy.ts
// keeps the page from being served. The old-style assistants panel is kept
// below, but only while that feature is switched on (it is off today).

export default function TeamPage() {
  const t = useTranslations('dashboard');
  const user = getUser();

  if (user?.role !== 'account_manager') {
    return <div className="text-center py-20 text-[var(--color-text-secondary)]">{t('team_unauthorized')}</div>;
  }

  return (
    <div>
      <StaffTeamPanel />
      {canUseAssistantsTeam(user) && (
        <section className="mt-16" aria-label={t('mt_assistants_title')}>
          <h3 className="text-lg font-semibold mb-4">{t('mt_assistants_title')}</h3>
          <AssistantsPanel />
        </section>
      )}
    </div>
  );
}
