import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveUserFullName,
  getDisplayName,
  getAvatarInitials,
  getFirstName
} from '../../utils/userDisplay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('User Identity & Display Name Canonical Regression Suite', async (t) => {

  await t.test('1. resolveUserFullName extracts genuine names and rejects emails, IDs, and empty values', () => {
    // Valid full names
    assert.equal(resolveUserFullName({ full_name: 'Mittal Halarnekar' }), 'Mittal Halarnekar');
    assert.equal(resolveUserFullName({ name: 'Rahul Naik' }), 'Rahul Naik');
    assert.equal(resolveUserFullName({ first_name: 'Sunil', last_name: 'Fernandes' }), 'Sunil Fernandes');

    // Reject email addresses masquerading as names
    assert.equal(resolveUserFullName({ full_name: '7896789@gmail.com' }), null);
    assert.equal(resolveUserFullName({ email: '7896789@gmail.com' }), null);

    // Reject pure numeric IDs or UUIDs
    assert.equal(resolveUserFullName({ full_name: '7896789' }), null);
    assert.equal(resolveUserFullName({ full_name: 'b80d3ca7-f78a-40b8-93b4-3ff8df0949da' }), null);

    // Multiple sources priority (profile before user)
    assert.equal(resolveUserFullName({ full_name: 'Profile Name' }, { full_name: 'User Name' }), 'Profile Name');
    assert.equal(resolveUserFullName({ full_name: null }, { full_name: 'User Name' }), 'User Name');
  });

  await t.test('2. getDisplayName returns saved full name or neutral fallback "User" (never email prefix or numeric ID)', () => {
    assert.equal(getDisplayName({ full_name: 'Mittal Halarnekar' }), 'Mittal Halarnekar');
    assert.equal(getDisplayName({ name: 'Rahul Naik' }), 'Rahul Naik');

    // Missing name fallback
    assert.equal(getDisplayName({ email: '7896789@gmail.com' }), 'User');
    assert.equal(getDisplayName({ id: 'b80d3ca7-f78a-40b8-93b4-3ff8df0949da', email: 'user@careergps.local' }), 'User');
    assert.equal(getDisplayName(null), 'User');
    assert.equal(getDisplayName({}), 'User');
  });

  await t.test('3. getAvatarInitials derives correct initials from names and falls back to "U" (never "7" or numeric chars)', () => {
    // Multi-word names: First + Last initial
    assert.equal(getAvatarInitials({ full_name: 'Mittal Halarnekar' }), 'MH');
    assert.equal(getAvatarInitials({ name: 'Rahul Naik' }), 'RN');
    assert.equal(getAvatarInitials({ full_name: 'Dr. Shruti Sharma' }), 'DS');

    // Single-word name
    assert.equal(getAvatarInitials({ full_name: 'NaviGoa' }), 'N');
    assert.equal(getAvatarInitials({ name: 'Rahul' }), 'R');

    // Missing name: must be neutral "U", NEVER "7" from "7896789@gmail.com"
    assert.equal(getAvatarInitials({ email: '7896789@gmail.com' }), 'U');
    assert.notEqual(getAvatarInitials({ email: '7896789@gmail.com' }), '7');
    assert.equal(getAvatarInitials(null), 'U');
    assert.equal(getAvatarInitials({}), 'U');
  });

  await t.test('4. getFirstName extracts first name for dashboard greeting or neutral fallback (never email prefix)', () => {
    assert.equal(getFirstName({ full_name: 'Mittal Halarnekar' }), 'Mittal');
    assert.equal(getFirstName({ name: 'Rahul Naik' }), 'Rahul');
    assert.equal(getFirstName({ full_name: 'rahul' }), 'Rahul');

    // Missing name
    assert.equal(getFirstName({ email: '7896789@gmail.com' }), 'there');
    assert.notEqual(getFirstName({ email: '7896789@gmail.com' }), '7896789');
    assert.equal(getFirstName(null), 'there');
  });

  await t.test('5. AppShell topbar and sidebar render canonical identity helpers', () => {
    const mainJs = fs.readFileSync(path.resolve(__dirname, '../../main.jsx'), 'utf-8');

    // AppShell sidebar avatar and display name
    assert.match(mainJs, /\{getAvatarInitials\(user\)\}/);
    assert.match(mainJs, /\{getDisplayName\(user\)\}/);

    // AppShell topbar avatar
    assert.match(mainJs, /<Link[^>]*to="\/profile"[^>]*className="avatar small"[^>]*>\s*\{getAvatarInitials\(user\)\}\s*<\/Link>/s);

    // Dashboard greeting
    assert.match(mainJs, /const firstName = getFirstName\(user\);/);
    assert.match(mainJs, /Welcome back, \{firstName\}/);

    // Verify email splitting for forged name is eradicated
    assert.ok(!mainJs.includes('user.email.split("@")[0]'));
    assert.ok(!mainJs.includes("user.email.split('@')[0]"));
  });

  await t.test('6. ProfilePage initializes from resolveUserFullName and saves full_name in api.updateProfile', () => {
    const profileJs = fs.readFileSync(path.resolve(__dirname, '../../pages/ProfilePage.jsx'), 'utf-8');

    // Initialization avoids email splitting
    assert.match(profileJs, /localName:\s*resolveUserFullName\(p,\s*user/);
    assert.ok(!profileJs.includes('user.email.split("@")[0]'));

    // Payload passes full_name to backend
    assert.match(profileJs, /await api\.updateProfile\(\{\s*full_name:\s*form\.localName/);
  });

  await t.test('7. ProfileSummaryCard uses canonical getDisplayName and getAvatarInitials', () => {
    const summaryCardJs = fs.readFileSync(path.resolve(__dirname, '../../components/profile/ProfileSummaryCard.jsx'), 'utf-8');

    assert.match(summaryCardJs, /const displayName = getDisplayName\(form,\s*user/);
    assert.match(summaryCardJs, /const initials = getAvatarInitials\(form,\s*user/);
  });

  await t.test('8. Register form includes Full Name input and passes full_name to api.register', () => {
    const registerJs = fs.readFileSync(path.resolve(__dirname, '../../pages/Register.jsx'), 'utf-8');

    assert.match(registerJs, /Full Name/);
    assert.match(registerJs, /full_name:\s*form\.fullName/);
  });

  await t.test('9. LegacyPages is synchronized with canonical user identity helpers', () => {
    const legacyJs = fs.readFileSync(path.resolve(__dirname, '../../pages/LegacyPages.jsx'), 'utf-8');

    assert.match(legacyJs, /\{getAvatarInitials\(user\)\}/);
    assert.match(legacyJs, /\{getDisplayName\(user\)\}/);
    assert.match(legacyJs, /const firstName = getFirstName\(user\);/);
    assert.match(legacyJs, /full_name:\s*form\.localName/);
    assert.ok(!legacyJs.includes('user.email.split("@")[0]'));
  });
});
