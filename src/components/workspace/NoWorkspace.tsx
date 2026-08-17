'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { Client } from '@/types';

export default function NoWorkspace({ client }: { client: Client }) {
  const t = useTranslations('dashboard');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createWorkspace = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/workspaces', { client_id: client.id });
      window.location.reload();
    } catch (err: any) {
      const msg = err?.response?.data?.message || '';
      if (err?.response?.status === 403) {
        setError(t('workspace_unauthorized'));
      } else {
        setError(msg || t('workspace_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    createWorkspace();
  }, [client.id]);

  const isSA = getUser()?.role === 'super_admin';

  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">📁</div>
      <p className="text-[var(--color-text-secondary)] mb-2">{t('workspace_no_space')}</p>
      {loading && !error && (
        <p className="text-[var(--color-text-disabled)] text-sm">{t('workspace_creating')}</p>
      )}
      {error && (
        <div className="space-y-4">
          <p className="text-red-400 text-sm max-w-md mx-auto">{error}</p>
          {isSA && (
            <p className="text-[var(--color-text-disabled)] text-xs">
              {t('workspace_info')}
            </p>
          )}
          <button onClick={createWorkspace} disabled={loading}
            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
            {loading ? t('workspace_retrying') : t('workspace_retry')}
          </button>
        </div>
      )}
    </div>
  );
}
