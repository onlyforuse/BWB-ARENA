import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerPanelHref, hasAutostartFlag, isAdminLocation } from './routing';

test('isAdminLocation detects root /admin, GitHub Pages subpath /BWB-ARENA/admin, and hash #/admin', () => {
  assert.equal(isAdminLocation('/', ''), false);
  assert.equal(isAdminLocation('/BWB-ARENA/', ''), false);
  assert.equal(isAdminLocation('/admin', ''), true);
  assert.equal(isAdminLocation('/admin/', ''), true);
  assert.equal(isAdminLocation('/BWB-ARENA/admin', ''), true);
  assert.equal(isAdminLocation('/BWB-ARENA/admin/', ''), true);
  assert.equal(isAdminLocation('/BWB-ARENA/', '#/admin'), true);
  assert.equal(isAdminLocation('/BWB-ARENA/', '#/admin?autostart=1'), true);
  assert.equal(isAdminLocation('/', '#admin'), true);
});

test('getPlayerPanelHref returns correct base URL without escaping GitHub Pages repo subpath', () => {
  assert.equal(getPlayerPanelHref('/admin', ''), '/');
  assert.equal(getPlayerPanelHref('/admin/', ''), '/');
  assert.equal(getPlayerPanelHref('/BWB-ARENA/admin', ''), '/BWB-ARENA/');
  assert.equal(getPlayerPanelHref('/BWB-ARENA/admin/', ''), '/BWB-ARENA/');
  assert.equal(getPlayerPanelHref('/BWB-ARENA/', '#/admin'), '/BWB-ARENA/');
  assert.equal(getPlayerPanelHref('/', '#/admin'), '/');
});

test('hasAutostartFlag parses query params from both search string and hash routes', () => {
  assert.equal(hasAutostartFlag('?autostart=1', ''), true);
  assert.equal(hasAutostartFlag('', '#/admin?autostart=1'), true);
  assert.equal(hasAutostartFlag('', '#/admin'), false);
});
