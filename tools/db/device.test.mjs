// What each platform can do (core/device/capabilities.ts): the one table every
// screen asks, so an iPhone hides what only Android's Java does today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilitiesOf } from '../../src/app/core/device/capabilities.ts';

const APP = join(dirname(fileURLToPath(import.meta.url)), '../../src/app');

test('Android can do everything the app has today but the iPhone-only Shortcuts door', () => {
  const android = capabilitiesOf('android');
  assert.equal(android.platform, 'android');
  for (const [name, value] of Object.entries(android)) {
    if (name !== 'platform') assert.equal(value, name !== 'shortcutMessages', name);
  }
});

test('a browser is no phone and can do none of it', () => {
  const web = capabilitiesOf('web');
  for (const [name, value] of Object.entries(web)) {
    if (name !== 'platform') assert.equal(value, false, name);
  }
});

test('an iPhone is a phone, rings its own notices, and reads no other app', () => {
  const ios = capabilitiesOf('ios');
  assert.equal(ios.native, true);
  assert.equal(ios.localNotifications, true);
  assert.equal(ios.readsNotifications, false);
  assert.equal(ios.readsSms, false);
  assert.equal(ios.readsImages, true);
  assert.equal(ios.nativeVoice, true);
  assert.equal(ios.iconShortcuts, true);
  assert.equal(ios.shortcutMessages, true);
  assert.equal(capabilitiesOf('android').shortcutMessages, false);
});

test('what an iPhone says it can do has its Swift plugin, registered and built', () => {
  const root = join(APP, '..', '..');
  const app = join(root, 'ios', 'App', 'App');
  const bridge = readFileSync(join(app, 'FinanceBridgeViewController.swift'), 'utf8');
  const project = readFileSync(join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  const plugins = { readsImages: ['OcrPlugin', 'Ocr'], nativeVoice: ['SpeechPlugin', 'Speech'], iconShortcuts: ['ShortcutsPlugin', 'Shortcuts'], shortcutMessages: ['MessageInboxPlugin', 'MessageInbox'] };
  const ios = capabilitiesOf('ios');
  for (const [can, [plugin, jsName]] of Object.entries(plugins)) {
    if (!ios[can]) continue;
    const source = readFileSync(join(app, `${plugin}.swift`), 'utf8');
    assert.match(source, new RegExp(`jsName = "${jsName}"`), `${plugin} answers as ${jsName}`);
    assert.match(bridge, new RegExp(`registerPluginInstance\\(${plugin}\\(\\)\\)`), `${plugin} registered`);
    assert.match(project, new RegExp(`${plugin}\\.swift in Sources \\*/,`), `${plugin} in the build`);
  }
  // The Shortcuts' intents and the inbox they write to are built too.
  for (const file of ['MessageInbox', 'FinanceIntents']) {
    assert.match(project, new RegExp(`${file}\\.swift in Sources \\*/,`), `${file} in the build`);
  }
});

test('an unknown platform is a browser', () => {
  assert.equal(capabilitiesOf('electron').platform, 'web');
  assert.equal(capabilitiesOf('electron').native, false);
});

test('no screen asks Capacitor for the platform itself', () => {
  const found = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.ts') && !path.includes(join('core', 'device'))) {
        if (/Capacitor\.(getPlatform|isNativePlatform)\(/.test(readFileSync(path, 'utf8'))) found.push(path);
      }
    }
  };
  walk(APP);
  assert.deepEqual(found, [], 'ask DEVICE (core/device/device.ts) instead');
});
