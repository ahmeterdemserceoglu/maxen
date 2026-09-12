import React from 'react';
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};
import { Platform, findNodeHandle, TVFocusGuideView } from 'react-native';
import { TVFocusGroup } from '../src/components/TVFocusGroup';
import { getTVNodeHandle, requestTVFocus } from '../src/utils/tvNodeHandle';

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
