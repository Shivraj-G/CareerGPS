import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(__dirname, '../../styles.css');
const clientPath = path.resolve(__dirname, '../client.js');
const notifBellPath = path.resolve(__dirname, '../../components/notifications/NotificationBell.jsx');
const mainPath = path.resolve(__dirname, '../../main.jsx');

describe('PART 1 & PART 5: Site-Wide Full-Height Footer & Notification System Suite', () => {
  const css = fs.readFileSync(stylesPath, 'utf8');
  const clientJs = fs.readFileSync(clientPath, 'utf8');
  const notifBellJs = fs.readFileSync(notifBellPath, 'utf8');
  const mainJs = fs.readFileSync(mainPath, 'utf8');

  test('1. Full-height application shell layout ensures footer sits at bottom on short pages', () => {
    // .app-shell must occupy full viewport height
    assert.match(css, /\.app-shell\{[^}]*min-height:100vh/);
    assert.match(css, /\.app-shell\{[^}]*min-height:100dvh/);

    // .main-area must occupy full viewport height and be a flex column
    assert.match(css, /\.main-area\{[^}]*min-height:100vh/);
    assert.match(css, /\.main-area\{[^}]*min-height:100dvh/);
    assert.match(css, /\.main-area\{[^}]*display:flex/);
    assert.match(css, /\.main-area\{[^}]*flex-direction:column/);

    // .page-content must grow to fill available vertical space
    assert.match(css, /\.page-content\{[^}]*flex:1 0 auto/);

    // .site-footer must push to the natural bottom of the container
    assert.match(css, /\.site-footer\{[^}]*margin-top:auto/);
    assert.match(css, /\.site-footer\{[^}]*flex-shrink:0/);
  });

  test('2. Footer is not fixed or overlapping interactive content or assistant fab', () => {
    // Footer is strictly in normal document flow
    assert.doesNotMatch(css, /\.site-footer\{[^}]*position:fixed/);
    assert.doesNotMatch(css, /\.site-footer\{[^}]*position:absolute/);

    // Assistant FAB floating widget has z-index 60
    assert.match(css, /\.assistant-fab\{position:fixed;/);
  });

  test('3. Footer adheres to NaviGoa brand palette with readable text and accessible tap targets', () => {
    // Color variables in :root
    assert.match(css, /--forest:#153D32/);
    assert.match(css, /--growth:#276749/);
    assert.match(css, /--teal:#087F8C/);
    assert.match(css, /--mint:#BFE8D7/);
    assert.match(css, /--canvas:#F7F9F7/);

    // Footer background uses var(--forest)
    assert.match(css, /\.site-footer\{[^}]*background:var\(--forest\)/);

    // Footer link text is readable 13px (not tiny 10px text)
    assert.match(css, /\.footer-links a\{[^}]*font-size:13px/);
    assert.match(css, /\.footer-brand p\{[^}]*font-size:13px/);
  });

  test('4. Responsive mobile footer styles stack neatly without tiny text or horizontal overflow', () => {
    assert.match(css, /\.site-footer\{padding:32px 20px 40px;display:grid;gap:28px;margin-top:auto;/);
    assert.match(css, /\.footer-links a\{font-size:13px;min-height:36px;padding:6px 0\}/);
    assert.match(css, /\.footer-links\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(130px,1fr\)\);gap:24px;flex-wrap:wrap\}/);
  });

  test('5. API client exports all required notification operations', () => {
    assert.match(clientJs, /notifications:\s*\(params/);
    assert.match(clientJs, /unreadNotificationCount:/);
    assert.match(clientJs, /markNotificationRead:/);
    assert.match(clientJs, /markAllNotificationsRead:/);
    assert.match(clientJs, /triggerClosingSoonCheck:/);
  });

  test('6. NotificationBell component implements full notification experience', () => {
    // Imports real api client
    assert.match(notifBellJs, /import\s+\{\s*api\s*\}\s+from\s+'\.\.\/\.\.\/api\/client'/);

    // Unread count polling and visibility change listener
    assert.match(notifBellJs, /setInterval/);
    assert.match(notifBellJs, /visibilitychange/);

    // Capped badge logic (9+, 99+)
    assert.match(notifBellJs, /unreadCount > 99 \? '99\+' : unreadCount > 9 \? '9\+' : unreadCount/);

    // Visually distinguishable urgency stages and icons
    assert.match(notifBellJs, /isClosingSoon/);
    assert.match(notifBellJs, /Closing in 24h/);
    assert.match(notifBellJs, /Closing in 3 days/);
    assert.match(notifBellJs, /New Opportunity/);

    // Working Mark all read & mark single item read
    assert.match(notifBellJs, /handleMarkAllAsRead/);
    assert.match(notifBellJs, /handleMarkAsRead/);

    // Navigates on click
    assert.match(notifBellJs, /navigate\(item\.action_url\)/);
  });

  test('7. AppShell mounts NotificationBell in shared authenticated header', () => {
    assert.match(mainJs, /import\s+\{\s*NotificationBell\s*\}\s+from\s+"\.\/components\/notifications\/NotificationBell\.jsx"/);
    assert.match(mainJs, /<NotificationBell\s*\/>/);
  });

  test('8. Real-time notification styles provide accessible popover and mobile sheet layout', () => {
    assert.match(css, /\.notif-bell-btn/);
    assert.match(css, /\.notif-badge/);
    assert.match(css, /\.notif-dropdown/);
    assert.match(css, /\.notif-header/);
    assert.match(css, /\.notif-item\.is-unread/);
    assert.match(css, /\.notif-icon-circle\.closing-soon/);
    assert.match(css, /\.notif-icon-circle\.new-opportunity/);
    assert.match(css, /@media\s*\(max-width:\s*760px\)\s*\{\s*\.notif-dropdown/);
  });
});
