'use client';

import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/client-portal/ui';
import type { AuthMode } from './AuthCard';

/** Client vs. managers / super admins / team — same switch on login and forgot-password. */
export default function AuthModeSwitch({ mode, onChange }: { mode: AuthMode; onChange: (m: AuthMode) => void }) {
  const t = useTranslations('client_portal');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
      <Segmented<AuthMode>
        value={mode}
        onChange={onChange}
        options={[
          { value: 'client', label: t('login_mode_client') },
          { value: 'staff', label: t('login_mode_staff') },
        ]}
      />
    </div>
  );
}
