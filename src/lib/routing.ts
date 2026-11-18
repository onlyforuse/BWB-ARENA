/**
 * Subpath- and GitHub Pages-safe route helpers for Player Panel (/) and Super Admin Panel (/admin or #/admin).
 */

export function isAdminLocation(pathname: string, hash: string): boolean {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const cleanHash = (hash || '').trim().toLowerCase();

  if (cleanPath === '/admin' || cleanPath.endsWith('/admin')) {
    return true;
  }

  if (
    cleanHash === '#/admin' ||
    cleanHash === '#admin' ||
    cleanHash.startsWith('#/admin/') ||
    cleanHash.startsWith('#/admin?') ||
    cleanHash.startsWith('#admin?')
  ) {
    return true;
  }

  return false;
}

export function getPlayerPanelHref(pathname: string, hash: string): string {
  const rawPath = pathname || '/';
  const cleanHash = (hash || '').trim().toLowerCase();

  // If navigated via hash (#/admin), stay on the same base pathname without hash
  if (cleanHash.startsWith('#/admin') || cleanHash.startsWith('#admin')) {
    return rawPath.endsWith('/') ? rawPath : `${rawPath}`;
  }

  // If navigated via path (/admin or /BWB-ARENA/admin), strip the trailing /admin segment
  const stripped = rawPath.replace(/\/admin\/?$/i, '');
  if (!stripped) {
    return '/';
  }
  return stripped.endsWith('/') ? stripped : `${stripped}/`;
}

export function getCurrentPlayerPanelHref(): string {
  if (typeof window === 'undefined') return '/';
  return getPlayerPanelHref(window.location.pathname, window.location.hash);
}

export function hasAutostartFlag(search: string, hash: string): boolean {
  if (new URLSearchParams(search || '').get('autostart') === '1') {
    return true;
  }
  const qIndex = (hash || '').indexOf('?');
  if (qIndex >= 0) {
    return new URLSearchParams(hash.slice(qIndex + 1)).get('autostart') === '1';
  }
  return false;
}
