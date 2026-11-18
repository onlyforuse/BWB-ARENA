/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShieldAlert, Wrench } from 'lucide-react';
import { ArenaProvider, useArena } from './context/ArenaContext';
import { FullScreenLoader } from './components/common/Skeletons';
import { ToastViewport } from './components/common/ToastViewport';
import { BrandMark } from './components/common/BrandMark';
import { LandingAuthView } from './components/auth/LandingAuthView';
import { AppShell } from './components/layout/AppShell';
import { HomeDashboardView } from './components/views/HomeDashboardView';
import { GamesLibraryView } from './components/views/GamesLibraryView';
import { MultiplayerRoomsView } from './components/views/MultiplayerRoomsView';
import { FriendsView } from './components/views/FriendsView';
import { LeaderboardView } from './components/views/LeaderboardView';
import { AchievementsView } from './components/views/AchievementsView';
import { NotificationsView } from './components/views/NotificationsView';
import { ProfileView } from './components/views/ProfileView';
import { SettingsView } from './components/views/SettingsView';
import { GameArenaModal } from './components/games/GameArenaModal';

function ArenaRouter() {
  const { authReady, player, activeNav, platformSettings } = useArena();

  const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminPath) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="arena-surface rounded-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="flex justify-center">
            <BrandMark size={40} />
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#22D3EE]">
            <ShieldAlert className="w-4 h-4" />
            <span>Private Route · /admin</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">BWB ARENA Super Admin Panel</h1>
          <p className="text-sm text-muted leading-relaxed">
            The Player Panel is live on <code className="font-mono text-ink">/</code>. The Super Admin Panel is staged
            for installation when you request it next, wired directly to this same <code className="font-mono text-ink">bwb-arena</code>{' '}
            Firebase Realtime Database.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl arena-gradient-btn text-xs font-semibold"
          >
            Return to Player Panel
          </a>
        </div>
      </div>
    );
  }

  if (!authReady && !player) {
    return <FullScreenLoader label="Connecting to BWB ARENA..." />;
  }

  if (platformSettings.maintenanceMode) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="arena-surface rounded-2xl max-w-md w-full p-6 text-center space-y-4">
          <Wrench className="w-8 h-8 mx-auto text-[#8B5CF6]" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-ink">{platformSettings.platformName} Maintenance</h1>
          <p className="text-sm text-muted leading-relaxed">
            Scheduled arena maintenance is currently underway. Live rooms and matchmaking will reopen shortly.
          </p>
          <p className="text-xs font-mono text-muted">CREATED BY SATYAM (BWB)</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return <LandingAuthView />;
  }

  return (
    <>
      <AppShell>
        {activeNav === 'home' && <HomeDashboardView />}
        {activeNav === 'games' && <GamesLibraryView />}
        {activeNav === 'multiplayer' && <MultiplayerRoomsView />}
        {activeNav === 'friends' && <FriendsView />}
        {activeNav === 'leaderboard' && <LeaderboardView />}
        {activeNav === 'achievements' && <AchievementsView />}
        {activeNav === 'notifications' && <NotificationsView />}
        {activeNav === 'profile' && <ProfileView />}
        {activeNav === 'settings' && <SettingsView />}
      </AppShell>
      <GameArenaModal />
    </>
  );
}

export default function App() {
  return (
    <ArenaProvider>
      <ArenaRouter />
      <ToastViewport />
    </ArenaProvider>
  );
}
