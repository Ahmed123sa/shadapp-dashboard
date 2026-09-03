'use client';

import AMListView from '@/components/dashboard/AMListView';
import type { Client, Contract, Payment, Manager, TFunc } from '@/components/dashboard/types';

// The super admin's paginated table view (?view=contracts|meetings|payments|files)
// — identical to the account manager's, so it just delegates to AMListView.
// managers is accepted (and clients passed straight through) for symmetry
// with SAManagersView's props, even though AMListView itself doesn't use managers.
export default function SAListView({ t, locale, view, clients, allContracts, allPayments, managers }: {
  t: TFunc; locale: string; view: string; clients: Client[];
  allContracts: Contract[]; allPayments: Payment[]; managers: Manager[];
}) {
  return <AMListView t={t} locale={locale} view={view} clients={clients} allContracts={allContracts} allPayments={allPayments} />;
}
