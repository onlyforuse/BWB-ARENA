import React, { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Radio,
  ScrollText,
  Settings,
  Trophy,
  Users,
  X,
  Award,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { getCurrentPlayerPanelHref } from '../../lib/routing';
import { BrandMark } from '../common/BrandMark';
import type { AdminNavSection } from '../../types/arena';

interface AdminNavItem {
  id: AdminNavSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', shortLabel: 'Users', icon: Users },
  { id: 'games', label: 'Games', shortLabel: 'Games', icon: Gamepad2 },
  { id: 'rooms', label: 'Live Rooms', shortLabel: 'Rooms', icon: Radio },
  { id: 'moderation', label: 'Moderation', shortLabel: 'Reports', icon: Flag },
  { id: 'announcements', label: 'Announcements', shortLabel: 'Notices', icon: Megaphone },
  { id: 'tournaments', label: 'Tournaments', shortLabel: 'Events', icon: Trophy },
  { id: 'leaderboards', label: 'Leaderboards', shortLabel: 'Ranks', icon: Award },
  { id: 'settings', label: 'Platform Settings', shortLabel: 'Settings', icon: Settings },
  { id: 'logs', label: 'Audit Logs', shortLabel: 'Logs', icon: ScrollText },
];

const MOBILE_PRIMARY_TABS: AdminNavSection[] = ['overview', 'users', 'rooms', 'moderation'];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const {
    actor,
    isSandboxMode,
    activeSection,
    setActiveSection,
    analytics,
    deletionRequests,
    platformSettings,
    signOutAdmin,
  } = useAdmin();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const playerPanelHref = getCurrentPlayerPanelHref();

  const currentItem = ADMIN_NAV_ITEMS.find((item) => item.id === activeSection) || ADMIN_NAV_ITEMS[0];
  const pendingDeletions = deletionRequests.filter((d) => d.status === 'pending').length;

  const badgeFor = (id: AdminNavSection): number => {
    if (id === 'moderation') return analytics.openReportsCount;
    if (id === 'rooms') return analytics.activeRooms;
    if (id === 'users') return pendingDeletions;
    return 0;
  };

  const handleSelect = (id: AdminNavSection) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* Desktop Fixed Collapsible Sidebar */}
      <aside
        aria-label="Super Admin navigation"
        className={`hidden md:flex flex-col shrink-0 bg-panel border-r border-line sticky top-0 h-screen transition-[width] duration-200 ${
          collapsed ? 'w-[76px]' : 'w-[252px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-line">
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <BrandMark size={30} />
            {!collapsed && (
              <div className="min-w-0">
                <span className="block font-display font-bold text-sm tracking-wide text-ink whitespace-nowrap truncate">
                  BWB ARENA
                </span>
                <span className="block text-[11px] font-mono text-[#22D3EE] whitespace-nowrap">
                  Super Admin
                </span>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface-elevated transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const badge = badgeFor(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#8B5CF6]/18 text-ink border border-[#8B5CF6]/35'
                    : 'text-muted hover:text-ink hover:bg-surface-elevated/70 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#22D3EE]' : ''}`} />
                {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                {!collapsed && badge > 0 && (
                  <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-surface-elevated text-ink">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line space-y-2">
          {!collapsed && (
            <div className="px-2 py-1.5">
              <p className="text-xs font-semibold text-ink truncate">{actor?.displayName || 'Super Admin'}</p>
              <p className="text-[11px] font-mono text-muted truncate">{actor?.email}</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <a
              href={playerPanelHref}
              className="w-full h-9 px-3 rounded-xl border border-line text-xs font-medium text-muted hover:text-ink hover:bg-surface-elevated transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
              title="Open Player Panel"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>Player Panel</span>}
            </a>
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="w-full h-9 px-3 rounded-xl border border-line text-xs font-medium text-muted hover:text-red-400 hover:border-red-500/35 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
              title={isSandboxMode ? 'Exit Sandbox' : 'Sign Out'}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>{isSandboxMode ? 'Exit Sandbox' : 'Sign Out'}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (Desktop 64px / Mobile 52px) */}
        <header className="sticky top-0 z-30 h-[52px] md:h-16 px-4 md:px-8 bg-panel/90 backdrop-blur-md border-b border-line flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className="md:hidden shrink-0"
              aria-label="Go to Admin Overview"
            >
              <BrandMark size={26} />
            </button>
            <div className="min-w-0">
              <div className="hidden md:flex items-center gap-2 text-xs text-muted">
                <span>Super Admin</span>
                <span aria-hidden="true">/</span>
                <span className="text-ink font-medium">{currentItem.label}</span>
              </div>
              <h1 className="font-display text-base md:text-lg font-bold text-ink truncate">
                {currentItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {platformSettings.maintenanceMode && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
                <Activity className="w-3.5 h-3.5" />
                <span>Maintenance Active</span>
              </span>
            )}
            <span className="hidden sm:inline text-xs font-mono text-muted whitespace-nowrap">
              {isSandboxMode ? 'Sandbox Mode' : 'Firebase Live · bwb-arena'}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open all admin sections"
              className="md:hidden min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-muted hover:text-ink"
            >
              <Menu className="w-5 h-5" />
            </button>
            <a
              href={playerPanelHref}
              className="hidden md:inline-flex h-9 px-3.5 rounded-xl bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Player View</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#22D3EE]" />
            </a>
          </div>
        </header>

        {/* Subtle Non-Sticky Sandbox Notice Strip */}
        {isSandboxMode && (
          <div className="px-4 md:px-8 py-2 bg-[#8B5CF6]/10 border-b border-[#8B5CF6]/20 flex items-center justify-between gap-3 text-xs">
            <p className="text-ink/90 truncate">
              <span className="font-semibold text-[#22D3EE]">Admin Sandbox</span>
              <span className="hidden sm:inline text-muted">
                {' '}
                · Interactive local preview dataset. Sign in with Firebase Admin credentials to mutate live bwb-arena data.
              </span>
            </p>
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="text-xs font-semibold text-[#22D3EE] hover:underline whitespace-nowrap shrink-0"
            >
              Firebase Sign In →
            </button>
          </div>
        )}

        {/* Active Admin View */}
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (56px, 5 items) */}
      <nav
        aria-label="Mobile admin navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur-md border-t border-line pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {MOBILE_PRIMARY_TABS.map((id) => {
            const item = ADMIN_NAV_ITEMS.find((x) => x.id === id)!;
            const Icon = item.icon;
            const active = activeSection === id;
            const badge = badgeFor(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#22D3EE]' : 'text-muted'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.shortLabel}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-3 min-w-[16px] h-4 px-1 rounded-full bg-[#8B5CF6] text-white text-[9px] font-mono tabular-nums flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              !MOBILE_PRIMARY_TABS.includes(activeSection) ? 'text-[#22D3EE]' : 'text-muted'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Full Section Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin sections menu"
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full bg-panel border-t border-line rounded-t-3xl p-5 pb-8 max-h-[82vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-base text-ink">Admin Sections</p>
                <p className="text-xs font-mono text-muted">{actor?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close admin sections menu"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                const badge = badgeFor(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-left text-xs font-medium ${
                      active
                        ? 'bg-[#8B5CF6]/18 border-[#8B5CF6]/40 text-ink'
                        : 'bg-surface border-line text-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge > 0 && (
                      <span className="font-mono text-[11px] text-[#22D3EE] tabular-nums">{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-line grid grid-cols-2 gap-2.5">
              <a
                href={playerPanelHref}
                className="min-h-[44px] rounded-xl bg-surface border border-line text-xs font-semibold text-ink inline-flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4 text-[#22D3EE]" />
                <span>Player Panel</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void signOutAdmin();
                }}
                className="min-h-[44px] rounded-xl bg-surface border border-line text-xs font-semibold text-red-400 inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{isSandboxMode ? 'Exit Sandbox' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
