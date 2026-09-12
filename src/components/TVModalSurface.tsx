import React from 'react';
import { Modal, Platform, View, type ViewProps } from 'react-native';
import { TVFocusGroup } from './TVFocusGroup';

/** Native modal keeps the remote focus inside the open panel. */
export function TVModalSurface({ onClose, children, ...props }: ViewProps & { onClose: () => void }) {
  const content = <TVFocusGroup {...props} trapFocusUp trapFocusDown trapFocusLeft trapFocusRight>{children}</TVFocusGroup>;
  return Platform.isTV ? <Modal transparent visible animationType="fade" onRequestClose={onClose}>{content}</Modal> : content;
}
