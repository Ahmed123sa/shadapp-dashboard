'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { isAuthenticated, getUser, logout } from '@/lib/auth';
import { setLocaleCookie } from '@/lib/locale';
import NotificationBell from '@/components/NotificationBell';
import ToastNotification from '@/components/ToastNotification';
import { useBadgeCounts } from '@/hooks/queries/useBadgeCounts';
import Link from 'next/link';
import {
  LayoutDashboard, Users, FileText, Calendar, CreditCard,
  Folder, ClipboardList, Settings, UserCog, BarChart3, Sun, Moon,
} from 'lucide-react';
import { resolveFileUrl } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: number;
  badgeColor?: string;
  exact?: boolean;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // بند 4.5 (دفعة 1) — الافتراضي غامق دايمًا؛ الاختيار بيتحفظ في localStorage
  // فقط بعد أول تبديل يدوي من المستخدم (مفيش متابعة لـ prefers-color-scheme
  // بقرار صريح من المستخدم).
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const user = getUser();
  const isSA = user?.role === 'super_admin';

  const currentView = searchParams.get('view') || '';

  // plans/notifications-badges-toasts-plan.md ن8 — the sidebar has no
  // dedicated "Approvals" or "Messages" links (approvals live per-client
  // under ApprovalsTab, chat lives per-client too), so their unread counts
  // ride on the two closest existing entry points instead: Home (where both
  // AMView and SAManagersView already surface pending approvals) and My/All
  // Clients (where every client's chat thread lives) — same mapping the
  // mobile app's bottom nav uses (chat → Home tab, approvals → Approvals tab).
  const { data: badgeCounts } = useBadgeCounts();

  const amNavGroups = [
    {
      label: t('nav_group_main'),
      items: [
        { href: '/dashboard', label: t('home'), icon: LayoutDashboard, exact: true, badge: badgeCounts?.approvals, badgeColor: 'gold' },
        { href: '/dashboard/clients', label: t('my_clients'), icon: Users, badge: badgeCounts?.chat, badgeColor: 'crimson' },
      ],
    },
    {
      label: t('nav_group_comm'),
      items: [
        { href: '/dashboard?view=contracts', label: t('contracts_nav'), icon: FileText },
        { href: '/dashboard?view=meetings', label: t('meetings_nav'), icon: Calendar },
      ],
    },
    {
      label: t('nav_group_finance'),
      items: [
        { href: '/dashboard?view=payments', label: t('payments_nav'), icon: CreditCard },
        { href: '/dashboard?view=files', label: t('files_nav'), icon: Folder },
      ],
    },
    {
      label: t('nav_group_system'),
      items: [
        { href: '/dashboard/audit-log', label: t('audit_log'), icon: ClipboardList },
        { href: '/dashboard/settings', label: t('settings'), icon: Settings },
      ],
    },
  ];

  const saNavGroups = [
    {
      label: t('nav_group_admin'),
      items: [
        { href: '/dashboard', label: t('home'), icon: LayoutDashboard, exact: true, badge: badgeCounts?.approvals, badgeColor: 'gold' },
        { href: '/dashboard/clients', label: t('all_clients'), icon: Users, badge: badgeCounts?.chat, badgeColor: 'crimson' },
        { href: '/dashboard/finance', label: locale === 'ar' ? 'المالية' : 'Finance', icon: CreditCard },
        { href: '/dashboard/reports', label: t('reports'), icon: BarChart3 },
        { href: '/dashboard/audit-log', label: t('audit_log'), icon: ClipboardList },
      ],
    },
    {
      label: t('nav_group_team'),
      items: [
        { href: '/dashboard/account-managers', label: t('account_managers'), icon: UserCog },
      ],
    },
    {
      label: t('nav_group_system'),
      items: [
        { href: '/dashboard/settings', label: t('settings'), icon: Settings },
      ],
    },
  ];

  const navGroups = isSA ? saNavGroups : amNavGroups;

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !isAuthenticated()) {
      router.push('/login');
    }
    const storedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('shadapp-theme') : null;
    if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);
  }, [router]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('shadapp-theme', next);
  };

  const switchLocale = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    setLocaleCookie(next);
    const params = new URLSearchParams(searchParams.toString());
    const qs = params.toString();
    window.location.href = pathname + (qs ? '?' + qs : '');
  };

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === '/dashboard' && !currentView;
    const itemPath = item.href.split('?')[0];
    const itemView = new URL(item.href, 'http://localhost').searchParams.get('view') || '';
    if (itemView) return pathname === itemPath && currentView === itemView;
    return pathname === itemPath || (itemPath !== '/dashboard' && pathname.startsWith(itemPath));
  };

  const getPageTitle = () => {
    if (pathname === '/dashboard' && currentView) {
      const viewTitles: Record<string, string> = {
        contracts: t('contracts_nav'),
        messages: t('messages'),
        meetings: t('meetings_nav'),
        payments: t('payments_nav'),
        files: t('files_nav'),
      };
      return viewTitles[currentView] || t('title');
    }
    if (pathname === '/dashboard') return t('title');
    if (pathname.startsWith('/dashboard/clients')) return t('my_clients');
    if (pathname.startsWith('/dashboard/account-managers')) return t('account_managers');
    if (pathname.startsWith('/dashboard/reports')) return t('reports');
    // /dashboard/finance was missing from this list, so the header fell
    // through to the default and showed "Home" while the page itself said
    // "Finance & Payments".
    if (pathname.startsWith('/dashboard/finance')) return locale === 'ar' ? 'المالية' : 'Finance';
    if (pathname.startsWith('/dashboard/audit-log')) return t('audit_log');
    if (pathname.startsWith('/dashboard/settings')) return t('settings');
    return t('title');
  };

  const currentDate = new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">{c('loading')}</div>;

  return (
    <div className="flex min-h-screen">
      <ToastNotification />

      {/* Sidebar */}
      {/* end-0/border-s (logical CSS) flip under dir="rtl": end-0 resolves to
          left:0, so in Arabic the off-canvas drawer opened flush against the
          LEFT edge while its own toggle button sits at the top-right (the
          header mirrors correctly via flex, this element didn't). Physical
          right-0/border-l keep the drawer pinned to the same edge — and
          hidden off-screen via the same rightward translate-x-full — in
          both languages, matching the already-correct English behavior.
          Only affects the <lg off-canvas state; lg:relative/lg:translate-x-0
          make these values no-ops on desktop, where flex's own bidi-aware
          ordering still places the sidebar left (en) / right (ar). */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-[220px] bg-[var(--bg-dark,#0D0D0D)] border-l border-[var(--border)] flex flex-col transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>

        {/* Logo */}
        <div className="px-3.5 py-5 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-[length:var(--fs-6)] italic font-bold font-display">d</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mb-[-2px]" />
            <span className="text-[length:var(--fs-4)] tracking-[3px] text-[var(--color-gold)] font-display">SHAD</span>
          </div>
        </div>

        {/* User Card */}
        <div className="mx-3.5 mb-5 p-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold border-[1.5px] border-[var(--color-gold)] overflow-hidden shrink-0">
            {user?.avatar_url ? (
              <img src={resolveFileUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.slice(0, 2) || '?'
            )}
          </div>
          <div>
            <div className="text-xs font-bold">{user?.name}</div>
            <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">
              {isSA ? t('role_admin') : t('role_am')}
            </div>
            <span className="inline-block mt-0.5 px-1.5 py-px text-[length:var(--fs-1)] rounded-[10px] bg-[var(--color-crimson-soft)] text-[var(--color-primary-light)] border border-[var(--color-crimson-border)]">
              {isSA ? 'SUPER ADMIN' : 'ACCOUNT MANAGER'}
            </span>
          </div>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] uppercase tracking-[1.2px] mb-1.5 px-2">{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-[length:var(--fs-2)] transition-all mb-0.5 ${
                      active
                        ? 'text-[var(--color-foreground)] bg-[var(--color-crimson-soft)] nav-item-active'
                        : 'text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-foreground)]'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span
                        className={`ms-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[length:var(--fs-1)] font-bold ${
                          item.badgeColor === 'gold'
                            ? 'bg-[var(--color-gold)] text-black'
                            : 'bg-[var(--color-primary)] text-white'
                        }`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3.5 py-2.5">
          <button onClick={logout} className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer w-full text-end py-2 -my-2">
            {t('logout')} →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-[rgba(13,13,13,0.9)] border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-[var(--color-foreground)]" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold font-display">
                {getPageTitle()}
              </h2>
              <span className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] font-normal">
                {currentDate}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <input
              placeholder={t('search_placeholder')}
              className="bg-white/[0.04] border border-[var(--border)] rounded-full px-3.5 py-1.5 text-[length:var(--fs-2)] text-[var(--color-text-secondary)] w-[150px]"
            />
            <NotificationBell />
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)] transition"
            >
              {theme === 'dark' ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
            </button>
            <button onClick={switchLocale} className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors py-2.5 -my-2.5">
              {locale === 'ar' ? 'English' : 'العربية'}
            </button>
            <div className="w-[30px] h-[30px] rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[length:var(--fs-1)] font-bold border-[1.5px] border-[var(--color-gold)] overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <img src={resolveFileUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0] || '?'
              )}
            </div>
          </div>
        </header>

        <main data-theme={theme === 'light' ? 'light' : undefined} className="flex-1 p-5 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
