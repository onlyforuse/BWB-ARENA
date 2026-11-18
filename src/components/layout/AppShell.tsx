import React, { useState } from 'react';
import {
  Award,
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  Coins,
  Gamepad2,
  Home,
  LogOut,
  Menu,
  Settings,
  Swords,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { UserNavSection } from '../../types/arena';
import { BrandMark } from '../common/BrandMark';
import { Avatar } from '../common/Avatar';
import { arenaSound } from '../../lib/sound';

const DESKTOP_NAV: Array<{ id: UserNavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'games', label: 'Discover Games', icon: Compass },
  { id: 'multiplayer', label: 'Multiplayer', icon: Swords },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MOBILE_BOTTOM_NAV: Array<{ id: UserNavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'multiplayer', label: 'Play', icon: Swords },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'profile', label: 'Profile', icon: UserIcon },
];

const MOBILE_DRAWER_EXTRA: Array<{ id: UserNavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    player,
    isGuestPractice,
    activeNav,
    setActiveNav,
    platformSettings,
    unreadNotificationsCount,
    friendRequests,
    activeRoom,
    logout,
    exitGuestPractice,
  } = useArena();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!player) return null;

  const currentNavItem = DESKTOP_NAV.find((n) => n.id === activeNav) ?? DESKTOP_NAV[0];

  const handleSelectNav = (id: UserNavSection) => {
    arenaSound.click();
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* Desktop Fixed Collapsible Sidebar */}
      <aside
        aria-label="Player navigation"
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-panel border-r border-line transition-[width] duration-200 z-30 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[252px]'
        }`}
      >
        <div className="h-16 px-4 border-b border-line flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleSelectNav('home')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <BrandMark size={30} />
            {!sidebarCollapsed && (
              <span className="font-display text-base font-extrabold tracking-wide text-ink truncate">
                {platformSettings.platformName}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-colors shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {DESKTOP_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            const badgeCount =
              item.id === 'notifications'
                ? unreadNotificationsCount
                : item.id === 'friends'
                  ? friendRequests.length
                  : item.id === 'multiplayer' && activeRoom
                    ? Object.keys(activeRoom.participants).length
                    : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors relative ${
                  active
                    ? 'bg-gradient-to-r from-[#8B5CF6]/20 to-[#3B82F6]/15 text-ink border border-[#8B5CF6]/35'
                    : 'text-muted hover:text-ink hover:bg-white/5 border border-transparent'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#22D3EE]' : 'text-muted'}`}
                  aria-hidden="true"
                />
                {!sidebarCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                {badgeCount > 0 && !sidebarCollapsed && (
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-[#22D3EE]">
                    {badgeCount}
                  </span>
                )}
                {badgeCount > 0 && sidebarCollapsed && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#22D3EE]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line space-y-2">
          {!sidebarCollapsed && (
            <div className="px-2.5 py-2 rounded-xl bg-surface flex items-center gap-2.5">
              <Avatar
                avatarId={player.avatarId}
                avatarUrl={player.avatarUrl}
                name={player.displayName}
                size="sm"
                online={player.online}
                showPresence
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink truncate">{player.displayName}</p>
                <p className="text-[11px] font-mono text-muted truncate tabular-nums">
                  Lvl {player.level} · {player.coins} Coins
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            title="Log Out"
            className={`w-full h-10 px-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span>{isGuestPractice ? 'Exit Practice' : 'Sign Out'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Navigation Bar (Compact 52px on Mobile, 64px on Desktop) */}
        <header className="sticky top-0 z-30 h-[52px] md:h-16 bg-panel/90 backdrop-blur-md border-b border-line px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden min-w-[40px] min-h-[40px] -ml-1.5 flex items-center justify-center rounded-xl text-muted hover:text-ink"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="md:hidden">
              <BrandMark size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-base md:text-lg font-bold text-ink truncate">
                {currentNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectNav('achievements')}
              aria-label={`Arena Coins balance ${player.coins}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-mono font-semibold text-ink tabular-nums hover:border-[#8B5CF6]/40 transition-colors whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{player.coins.toLocaleString()}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNav('notifications')}
              aria-label={`Notifications (${unreadNotificationsCount} unread)`}
              className="relative min-w-[40px] min-h-[40px] rounded-xl bg-surface border border-line flex items-center justify-center text-muted hover:text-ink hover:border-[#8B5CF6]/40 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B5CF6] text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectNav('profile')}
              aria-label={`Open profile for ${player.displayName}`}
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-white/5 transition-colors"
            >
              <Avatar
                avatarId={player.avatarId}
                avatarUrl={player.avatarUrl}
                name={player.displayName}
                size="sm"
                online={player.online}
                showPresence
              />
            </button>
          </div>
        </header>

        {/* Guest Practice Banner (Transparent & Compact) */}
        {isGuestPractice && (
          <div className="bg-[#8B5CF6]/12 border-b border-[#8B5CF6]/25 px-4 md:px-6 py-2 flex items-center justify-between gap-2 text-xs">
            <p className="text-ink truncate">
              <span className="font-semibold text-[#22D3EE]">Practice Mode</span>
              <span className="text-muted hidden sm:inline">
                {' '}
                · All 5 games playable vs bots. Sign in for live multiplayer & verified rankings.
              </span>
              <span className="text-muted sm:hidden"> · Solo bot mode active</span>
            </p>
            <button
              type="button"
              onClick={exitGuestPractice}
              className="font-semibold text-[#22D3EE] hover:underline whitespace-nowrap shrink-0"
            >
              Sign In →
            </button>
          </div>
        )}

        {/* Suspended Account Notice */}
        {player.status !== 'active' && (
          <div
            role="alert"
            className="bg-[#EF4444]/15 border-b border-[#EF4444]/35 px-4 md:px-6 py-3 text-xs text-[#EF4444] font-medium"
          >
            Your account status is currently {player.status}. Protected multiplayer features are restricted until
            reactivated by platform administration.
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-7 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (56px height + 52px top bar = 108px / 844px = 12.8% <= 15% cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur-md border-t border-line pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-[#22D3EE]' : 'text-muted'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] font-semibold tracking-tight leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer for Extra Sections */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation links"
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex"
        >
          <div className="w-72 max-w-[85vw] bg-panel border-r border-line h-full flex flex-col p-4">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <BrandMark size={26} />
                <span className="font-display font-bold text-ink">{platformSettings.platformName}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation drawer"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 flex-1 space-y-1">
              {[...MOBILE_BOTTOM_NAV, ...MOBILE_DRAWER_EXTRA].map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm font-medium ${
                      active ? 'bg-[#8B5CF6]/20 text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-line space-y-2">
              <p className="text-[11px] text-muted px-2">CREATED BY SATYAM (BWB)</p>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm font-semibold text-[#EF4444] hover:bg-[#EF4444]/10"
              >
                <LogOut className="w-4 h-4" />
                <span>{isGuestPractice ? 'Exit Practice' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss drawer backdrop"
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
