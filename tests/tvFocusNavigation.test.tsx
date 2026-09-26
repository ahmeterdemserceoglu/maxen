import React from 'react';
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};
import { Platform, findNodeHandle, TVFocusGuideView } from 'react-native';
import { TVFocusGroup } from '../src/components/TVFocusGroup';
import { getTVNodeHandle, requestTVFocus } from '../src/utils/tvNodeHandle';
import { isFreshTvRemoteAction } from '../src/utils/tvRemoteAction';
import type { TvRemoteAction } from '../src/services/tvRemotePlayService';
import {
  getPreferredPlayerFocusTarget,
  getTVPlaybackIntent,
  getTVSeekStepSeconds,
  getVirtualRemotePlaybackIntent,
} from '../src/utils/tvPlaybackControls';
import { getNextEpisodeCountdownSeconds, withoutStaleEpisodePlayback } from '../src/utils/episodePlayback';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'android', isTV: true },
    findNodeHandle: jest.fn(() => 42),
    View: ({ children }: any) => React.createElement('div', null, children),
    TVFocusGuideView: jest.fn(({ children }: any) => React.createElement('section', null, children)),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(Platform, { OS: 'android', isTV: true });
});

test('TV groups remember their last child and only trap requested directions', () => {
  renderToStaticMarkup(<TVFocusGroup trapFocusLeft trapFocusUp><span>Menu</span></TVFocusGroup>);
  const props = (TVFocusGuideView as unknown as jest.Mock).mock.calls[0][0];
  expect(props.autoFocus).toBe(true);
  expect(props.trapFocusLeft).toBe(true);
  expect(props.trapFocusUp).toBe(true);
  expect(props.trapFocusRight).toBeUndefined();
});

test.each(['web', 'android', 'ios'])('non-TV %s keeps a plain container', OS => {
  Object.assign(Platform, { OS, isTV: false });
  expect(renderToStaticMarkup(<TVFocusGroup trapFocusLeft><span>Content</span></TVFocusGroup>))
    .toBe('<div><span>Content</span></div>');
  expect(TVFocusGuideView).not.toHaveBeenCalled();
});

test('TV focus uses the native TV command instead of the text-input command', () => {
  const target = { requestTVFocus: jest.fn(), focus: jest.fn() };
  requestTVFocus({ current: target });
  expect(target.requestTVFocus).toHaveBeenCalledTimes(1);
  expect(target.focus).not.toHaveBeenCalled();
});

test('phone/web focus and missing targets stay safe', () => {
  Object.assign(Platform, { OS: 'web', isTV: false });
  const target = { requestTVFocus: jest.fn(), focus: jest.fn() };
  requestTVFocus(target);
  requestTVFocus(null);
  requestTVFocus({ current: null });
  expect(target.focus).toHaveBeenCalledTimes(1);
  expect(target.requestTVFocus).not.toHaveBeenCalled();
});

test('native directional handles resolve refs, and are never looked up on web', () => {
  const target = {};
  expect(getTVNodeHandle({ current: target })).toBe(42);
  expect(findNodeHandle).toHaveBeenCalledWith(target);
  Object.assign(Platform, { OS: 'web' });
  jest.clearAllMocks();
  expect(getTVNodeHandle(target)).toBeUndefined();
  expect(findNodeHandle).not.toHaveBeenCalled();
});

test('virtual remote actions are not replayed after a TV listener reconnects', () => {
  const action: TvRemoteAction = {
    actionId: 'action-1',
    requestedAt: 10_000,
    type: 'dpad_right',
  };
  expect(isFreshTvRemoteAction(action, undefined, 10_500)).toBe(true);
  expect(isFreshTvRemoteAction(action, 'action-1', 10_500)).toBe(false);
  expect(isFreshTvRemoteAction(action, undefined, 12_000)).toBe(false);
});

test('left and right seek only while the timeline owns focus', () => {
  const timeline = { controlsVisible: true, menuOpen: false, isMovie: true, timelineFocused: true };
  expect(getTVPlaybackIntent('left', timeline)).toBe('rewind');
  expect(getTVPlaybackIntent('right', timeline)).toBe('forward');

  const actionButton = { ...timeline, timelineFocused: false };
  expect(getTVPlaybackIntent('left', actionButton)).toBeNull();
  expect(getTVPlaybackIntent('right', actionButton)).toBeNull();
  expect(getTVPlaybackIntent('down', actionButton)).toBeNull();
});

test('center toggles playback on the timeline without selecting another button', () => {
  expect(getTVPlaybackIntent('select', {
    controlsVisible: true,
    menuOpen: false,
    isMovie: false,
    timelineFocused: true,
  })).toBe('toggle');
  expect(getTVPlaybackIntent('select', {
    controlsVisible: true,
    menuOpen: false,
    isMovie: false,
    timelineFocused: false,
  })).toBeNull();
});

test('held TV seeking accelerates in bounded stages', () => {
  expect(getTVSeekStepSeconds(0)).toBe(10);
  expect(getTVSeekStepSeconds(5)).toBe(20);
  expect(getTVSeekStepSeconds(12)).toBe(30);
  expect(getTVSeekStepSeconds(24)).toBe(60);
});

test('virtual D-pad never seeks unless the timeline owns focus', () => {
  const state = { controlsVisible: true, menuOpen: false, isMovie: false, timelineFocused: false };
  expect(getVirtualRemotePlaybackIntent('dpad_right', state)).toBeNull();
  expect(getVirtualRemotePlaybackIntent('seek_forward', state)).toBe('forward');
  expect(getVirtualRemotePlaybackIntent('dpad_center', state)).toBeNull();
  expect(getVirtualRemotePlaybackIntent('play_pause', state)).toBe('toggle');
});

test('only one player surface owns preferred TV focus', () => {
  expect(getPreferredPlayerFocusTarget({ countdownVisible: true, actionVisible: true, controlsVisible: true }))
    .toBe('countdown');
  expect(getPreferredPlayerFocusTarget({ countdownVisible: false, actionVisible: true, controlsVisible: true }))
    .toBe('action');
  expect(getPreferredPlayerFocusTarget({ countdownVisible: false, actionVisible: false, controlsVisible: true }))
    .toBe('timeline');
});

test('episode transitions discard stream and progress state from the previous episode', () => {
  expect(withoutStaleEpisodePlayback({
    tmdbId: '123',
    season_number: 5,
    episode_number: 2,
    savedStreamUrl: 'https://cdn.example/season5-episode1.m3u8',
    savedStreamHeaders: { Referer: 'old' },
    preheatedData: { episode: 1 },
    progress: 0.99,
    durationSeconds: 2400,
    positionSeconds: 2390,
  })).toEqual({
    tmdbId: '123',
    season_number: 5,
    episode_number: 2,
    positionSeconds: 0,
  });
});

test('next episode countdown exists only during the final ten seconds', () => {
  expect(getNextEpisodeCountdownSeconds(89, 100)).toBeNull();
  expect(getNextEpisodeCountdownSeconds(90, 100)).toBe(10);
  expect(getNextEpisodeCountdownSeconds(95.2, 100)).toBe(5);
  expect(getNextEpisodeCountdownSeconds(100, 100)).toBeNull();
});
