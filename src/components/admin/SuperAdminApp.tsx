import { AdminProvider, useAdmin } from '../../context/AdminContext';
import { FullScreenLoader } from '../common/Skeletons';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminShell } from './AdminShell';
import { AdminOverviewView } from './views/AdminOverviewView';
import { AdminUsersView } from './views/AdminUsersView';
import { AdminGamesView } from './views/AdminGamesView';
import { AdminRoomsView } from './views/AdminRoomsView';
import { AdminModerationView } from './views/AdminModerationView';
import { AdminAnnouncementsView } from './views/AdminAnnouncementsView';
import { AdminTournamentsView } from './views/AdminTournamentsView';
import { AdminLeaderboardsView } from './views/AdminLeaderboardsView';
import { AdminSettingsView } from './views/AdminSettingsView';
import { AdminAuditLogsView } from './views/AdminAuditLogsView';

function SuperAdminRouter() {
  const { authChecking, actor, activeSection } = useAdmin();

  if (authChecking) {
    return <FullScreenLoader label="Verifying Super Admin clearance..." />;
  }

  if (!actor) {
    return <AdminAuthGate />;
  }

  return (
    <AdminShell>
      {activeSection === 'overview' && <AdminOverviewView />}
      {activeSection === 'users' && <AdminUsersView />}
      {activeSection === 'games' && <AdminGamesView />}
      {activeSection === 'rooms' && <AdminRoomsView />}
      {activeSection === 'moderation' && <AdminModerationView />}
      {activeSection === 'announcements' && <AdminAnnouncementsView />}
      {activeSection === 'tournaments' && <AdminTournamentsView />}
      {activeSection === 'leaderboards' && <AdminLeaderboardsView />}
      {activeSection === 'settings' && <AdminSettingsView />}
      {activeSection === 'logs' && <AdminAuditLogsView />}
    </AdminShell>
  );
}

export function SuperAdminApp() {
  return (
    <AdminProvider>
      <SuperAdminRouter />
    </AdminProvider>
  );
}
