import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  isValidApkFileName,
  canTransitionStatus,
  getStatusBadgeInfo,
  getNavigationKeyAction
} from './vmLogic';

test('formatBytes formats correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1024 * 1024), '1 MB');
  assert.equal(formatBytes(500 * 1024 * 1024), '500 MB');
});

test('isValidApkFileName validates APK extension', () => {
  assert.equal(isValidApkFileName('app.apk'), true);
  assert.equal(isValidApkFileName('my-game-v1.0.APK'), true);
  assert.equal(isValidApkFileName('test.exe'), false);
  assert.equal(isValidApkFileName(''), false);
});

test('canTransitionStatus enforces valid state transitions', () => {
  assert.equal(canTransitionStatus('STOPPED', 'STARTING'), true);
  assert.equal(canTransitionStatus('STOPPED', 'RUNNING'), false); // Cannot jump directly to running
  assert.equal(canTransitionStatus('STARTING', 'RUNNING'), true);
  assert.equal(canTransitionStatus('STARTING', 'ERROR'), true);
  assert.equal(canTransitionStatus('RUNNING', 'STOPPING'), true);
  assert.equal(canTransitionStatus('RUNNING', 'ERROR'), true);
  assert.equal(canTransitionStatus('STOPPING', 'STOPPED'), true);
});

test('getStatusBadgeInfo returns correct styles and label', () => {
  assert.equal(getStatusBadgeInfo('RUNNING').label, 'Running');
  assert.equal(getStatusBadgeInfo('ERROR').label, 'Error');
  assert.equal(getStatusBadgeInfo('STOPPED').label, 'Stopped');
});

test('getNavigationKeyAction maps key to real ADB keycodes', () => {
  assert.equal(getNavigationKeyAction('BACK')?.adbKeycode, 4);
  assert.equal(getNavigationKeyAction('HOME')?.adbKeycode, 3);
  assert.equal(getNavigationKeyAction('RECENT_APPS')?.adbKeycode, 187);
  assert.equal(getNavigationKeyAction('POWER')?.adbKeycode, 26);
  assert.equal(getNavigationKeyAction('UNKNOWN'), null);
});
